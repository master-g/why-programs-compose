/**
 * SVG 主题迁移工具的纯核心。
 *
 * 自动路径只接受已登记的标准纸墨颜色。任何渐变、样式块、未知颜色或
 * 语义混用都进入专用队列,不会生成候选改写。
 */
import {
	STANDARD_SVG_ROLES,
	contrastRatio,
	normalizeHex,
	validateSvgTheme,
} from "./svg-theme-contract.mjs";

const PAINT_ATTRIBUTE = /\b(fill|stroke|stop-color|flood-color)\s*=\s*(["'])([^"']*)\2/gi;
const COLOR_VALUE = /#[0-9a-f]{3,8}\b/i;
const NON_PAINT_VALUE = /^(?:none|transparent|url\([^)]*\))$/i;
const TAG_NAME = /<([a-z][a-z0-9:-]*)\b([^>]*?)(\/?)>/gi;
const STANDARD_COLOR_TO_ROLE = new Map();

for (const [role, definition] of Object.entries(STANDARD_SVG_ROLES)) {
	STANDARD_COLOR_TO_ROLE.set(definition.light, role);
	STANDARD_COLOR_TO_ROLE.set(definition.dark, role);
}

function reason(code, message, extra = {}) {
	return { code, message, ...extra };
}

function tagAt(source, index) {
	const prefix = source.slice(Math.max(0, index - 240), index);
	return prefix.match(/<([a-z][a-z0-9:-]*)\b[^>]*$/i)?.[1]?.toLowerCase() || "unknown";
}

function colorContext(source, index, property) {
	const tag = tagAt(source, index);
	if (tag === "text") return "text";
	if (property === "stroke" || tag === "line" || tag === "path" || tag === "polyline") return "graphic";
	return "fill";
}

function collectPaints(source) {
	const paints = [];
	for (const match of source.matchAll(PAINT_ATTRIBUTE)) {
		const property = match[1].toLowerCase();
		const value = match[3].trim();
		if (NON_PAINT_VALUE.test(value)) continue;
		const color = value.match(COLOR_VALUE)?.[0];
		paints.push({
			property,
			value,
			color: color ? normalizeHex(color) : null,
			context: colorContext(source, match.index, property),
			index: match.index,
		});
	}
	return paints;
}

function hasStyleColors(source) {
	return /<style\b[\s\S]*?<\/style>/i.test(source);
}

function hasGradient(source) {
	return /<(?:linear|radial)Gradient\b/i.test(source);
}

export function structuralProjection(source) {
	const withoutComments = String(source)
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
	const projection = [];
	let cursor = 0;
	for (const match of withoutComments.matchAll(TAG_NAME)) {
		const text = withoutComments.slice(cursor, match.index).replace(/\s+/g, " ").trim();
		if (text) projection.push(`text:${text}`);
		const tag = match[1].toLowerCase();
		const attributes = [...match[2].matchAll(/([a-z_:][-a-z0-9_.:]*)\s*=\s*(["'])([^"']*)\2/gi)]
			.filter(([, name]) => !["class", "style", "fill", "stroke", "color", "stop-color", "flood-color", "fill-opacity", "stroke-opacity", "color-opacity", "data-svg-theme"].includes(name.toLowerCase()))
			.map(([, name, , value]) => `${name.toLowerCase()}=${value}`)
			.sort();
		projection.push(`<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}${match[3] ? "/" : ""}>`);
		cursor = match.index + match[0].length;
	}
	const tail = withoutComments.slice(cursor).replace(/\s+/g, " ").trim();
	if (tail) projection.push(`text:${tail}`);
	return projection.join("\n");
}

export function analyzeSvgMigration(source, { asset = "<inline-svg>" } = {}) {
	const text = String(source);
	const reasons = [];
	const mapping = {};
	const paints = collectPaints(text);
	const byColor = new Map();

	if (!/<svg\b/i.test(text) || !/<\/svg>\s*$/i.test(text.trim())) {
		reasons.push(reason("INVALID_SVG_ROOT", "SVG 根元素不完整"));
	}
	if (paints.length === 0) reasons.push(reason("NO_PAINTS", "没有找到可迁移的颜色属性"));
	if (hasStyleColors(text)) reasons.push(reason("STYLED_COLOR_SOURCE", "颜色位于 style 块中,需要逐图处理"));
	if (hasGradient(text)) reasons.push(reason("GRADIENT_SOURCE", "包含渐变,需要逐图定义专用角色"));

	for (const paint of paints) {
		if (!paint.color) {
			reasons.push(reason("UNSUPPORTED_PAINT_VALUE", `不支持的绘制值 ${paint.value}`, { property: paint.property }));
			continue;
		}
		if (STANDARD_COLOR_TO_ROLE.has(paint.color)) {
			mapping[paint.color] = STANDARD_COLOR_TO_ROLE.get(paint.color);
			continue;
		}
		if (!byColor.has(paint.color)) byColor.set(paint.color, new Set());
		byColor.get(paint.color).add(paint.context);
	}
	for (const [color, contexts] of byColor) {
		if (contexts.size > 1) {
			reasons.push(reason("AMBIGUOUS_COLOR_ROLE", `颜色 ${color} 同时出现在 ${[...contexts].join("、")} 语义中`, { color, contexts: [...contexts] }));
		} else {
			reasons.push(reason("UNREGISTERED_COLOR", `颜色 ${color} 没有已确认的标准角色`, { color, contexts: [...contexts] }));
		}
	}

	const classification = reasons.length === 0 ? "standard" : "specialized";
	return {
		asset,
		classification,
		approved: classification === "standard",
		mapping,
		reasons,
		paintCount: paints.length,
	};
}

function classFor(role, property) {
	return `${role}-${property}`;
}

function addClasses(attributes, classes) {
	const unique = [...new Set(classes)];
	if (unique.length === 0) return attributes;
	const classAttribute = attributes.match(/\bclass\s*=\s*(["'])([^"']*)\1/i);
	if (classAttribute) {
		const existing = classAttribute[2].trim();
		const value = [...new Set(`${existing} ${unique.join(" ")}`.trim().split(/\s+/))].join(" ");
		return attributes.replace(classAttribute[0], `class=${classAttribute[1]}${value}${classAttribute[1]}`);
	}
	return `${attributes} class="${unique.join(" ")}"`;
}

function styleBlock(classes) {
	const entries = [...classes].sort().map((className) => {
		const property = className.endsWith("-stroke") ? "stroke" : "fill";
		const role = className.replace(/-(?:fill|stroke)$/, "");
		const definition = STANDARD_SVG_ROLES[role];
		return { className, property, definition };
	});
	const lines = ["<style>"];
	for (const { className, property, definition } of entries) {
		lines.push(`  .${className} { ${property}: ${definition.light}; }`);
	}
	lines.push("  @media (prefers-color-scheme: dark) {");
	for (const { className, property, definition } of entries) {
		lines.push(`    .${className} { ${property}: ${definition.dark}; }`);
	}
	lines.push("  }");
	lines.push("</style>");
	return lines.join("\n");
}

function addThemeMarker(source) {
	return source.replace(/<svg\b([^>]*)>/i, (match, attributes) => {
		if (/\bdata-svg-theme\s*=/.test(attributes)) return match;
		return `<svg data-svg-theme="paper-ink-v1"${attributes}>`;
	});
}

function trimSvgLineWhitespace(source) {
	return source.replace(/[ \t]+(?=\r?\n)/g, "");
}

function rewriteStandardPaints(source, mapping) {
	const classes = new Set();
	const rewritten = source.replace(TAG_NAME, (match, tag, attributes, selfClose) => {
		if (tag.toLowerCase() === "svg" || tag.toLowerCase() === "style") return match;
		const localClasses = [];
		const nextAttributes = attributes.replace(PAINT_ATTRIBUTE, (paint, property, quote, value) => {
			const normalized = normalizeHex(value);
			const role = normalized ? mapping[normalized] : null;
			if (!role || !["fill", "stroke"].includes(property.toLowerCase())) return paint;
			const className = classFor(role, property.toLowerCase());
			localClasses.push(className);
			classes.add(className);
			return "";
		});
		return `<${tag}${addClasses(nextAttributes, localClasses)}${selfClose}>`;
	});
	return { source: rewritten, classes };
}

function insertStyle(source, classes) {
	const block = styleBlock(classes);
	return source.replace(/(<svg\b[^>]*>)/i, `$1\n${block}`);
}

export function applySvgMigration(source, { asset = "<inline-svg>" } = {}) {
	const analysis = analyzeSvgMigration(source, { asset });
	if (!analysis.approved) {
		const details = analysis.reasons.map(({ code, message }) => `${code}: ${message}`).join("; ");
		throw new Error(`SVG ${asset} 不能自动迁移: ${details}`);
	}
	const rewritten = rewriteStandardPaints(String(source), analysis.mapping);
	const migrated = trimSvgLineWhitespace(insertStyle(addThemeMarker(rewritten.source), rewritten.classes));
	if (structuralProjection(source) !== structuralProjection(migrated)) {
		throw new Error(`SVG ${asset} 迁移后结构投影发生变化`);
	}
	const contract = validateSvgTheme(migrated, { asset });
	if (contract.errors.length > 0) {
		throw new Error(`SVG ${asset} 迁移结果未通过主题契约: ${contract.errors.map(({ code }) => code).join(", ")}`);
	}
	return { source: migrated, analysis, changed: migrated !== source };
}

const SPECIALIZED_STYLE_BLOCK = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
const CSS_RULE = /([^{}]+)\{([^{}]*)\}/g;
const CSS_PAINT_DECLARATION = /(^|;)\s*(fill|stroke|color|stop-color|flood-color)\s*:\s*([^;{}]+?)(?=;|$)/gi;
const DIRECT_PAINT_ATTRIBUTE = /\b(fill|stroke|color|stop-color|flood-color)\s*=\s*(["'])([^"']*)\2/gi;
const INLINE_PAINT_DECLARATION = /(^|;)\s*(fill|stroke|color|stop-color|flood-color)\s*:\s*([^;{}]+?)(?=;|$)/gi;
const RGB_HEX = /^#([0-9a-f]{6})$/i;
// 按最亮的生成暗色面板预留余量,避免不同源色取整后跌破文字阈值。
const DARK_TEXT_SURFACE = "#3b3b3b";
const DARK_BACKGROUND_TONE = 0.86;
const STANDARD_ROLE_CANDIDATES = new Map();

for (const [role, definition] of Object.entries(STANDARD_SVG_ROLES)) {
	for (const color of [definition.light, definition.dark]) {
		if (!STANDARD_ROLE_CANDIDATES.has(color)) STANDARD_ROLE_CANDIDATES.set(color, []);
		STANDARD_ROLE_CANDIDATES.get(color).push(role);
	}
}

function rgbFromHex(value) {
	const normalized = normalizeHex(value);
	const match = normalized?.match(RGB_HEX);
	if (!match) throw new TypeError(`invalid RGB color: ${value}`);
	return [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16));
}

function hexFromRgb(rgb) {
	return `#${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(first, second, amount) {
	const a = rgbFromHex(first);
	const b = rgbFromHex(second);
	return hexFromRgb(a.map((channel, index) => channel + (b[index] - channel) * amount));
}

function minimumContrastForKind(kind) {
	return kind === "text" ? 4.5 : kind === "graphic" || kind === "fill" ? 3 : null;
}

function parsePaintColor(value) {
	const text = String(value).trim();
	const hex = normalizeHex(text);
	if (hex) return { hex, alpha: null };
	const rgba = text.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/i);
	if (!rgba) return null;
	const rgb = rgba.slice(1, 4).map((channel) => Number.parseInt(channel, 10));
	if (rgb.some((channel) => channel > 255)) return null;
	const alpha = rgba[4] == null ? null : Number.parseFloat(rgba[4]);
	return { hex: hexFromRgb(rgb), alpha };
}

function ensureContrast(value, background, minimum, direction) {
	const normalized = normalizeHex(value);
	if (!normalized || !minimum || contrastRatio(normalized, background) >= minimum) return normalized;
	let low = 0;
	let high = 1;
	let best = normalizeHex(direction);
	for (let iteration = 0; iteration < 24; iteration += 1) {
		const amount = (low + high) / 2;
		const candidate = mixHex(normalized, direction, amount);
		if (contrastRatio(candidate, background) >= minimum) {
			best = candidate;
			high = amount;
		} else {
			low = amount;
		}
	}
	return best;
}

function deriveLightColor(source, kind) {
	if (kind === "background") return normalizeHex(source);
	return ensureContrast(source, STANDARD_SVG_ROLES["svg-page"].light, minimumContrastForKind(kind), "#000000");
}

function deriveDarkColor(source, kind) {
	const minimum = minimumContrastForKind(kind);
	const normalized = normalizeHex(source);
	if (!normalized) return source;
	// 大面积浅色填充必须压到暗色表面,否则容器内的文字会与它混成同一灰阶。
	const toned = kind === "background"
		? mixHex(normalized, STANDARD_SVG_ROLES["svg-page"].dark, DARK_BACKGROUND_TONE)
		: ["fill"].includes(kind) && contrastRatio(normalized, "#ffffff") < 1.8
			? mixHex(normalized, STANDARD_SVG_ROLES["svg-page"].dark, 0.55)
			: normalized;
	if (kind === "background") return toned;
	const contrastBackground = kind === "text"
		? DARK_TEXT_SURFACE
		: STANDARD_SVG_ROLES["svg-page"].dark;
	return ensureContrast(toned, contrastBackground, minimum, "#ffffff");
}

function paintKind(tag, property) {
	const normalizedTag = tag.toLowerCase();
	if (property === "color" || (normalizedTag === "text" && property !== "stroke")) return "text";
	if (normalizedTag === "g" && property === "fill") return "text";
	if (property === "stroke" || ["line", "polyline"].includes(normalizedTag)) return "graphic";
	return "fill";
}

function attributeValueOf(attributes, name) {
	const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
	return match?.[1] ?? null;
}

function compatibleStandardRole(color, kind) {
	const candidates = STANDARD_ROLE_CANDIDATES.get(color) || [];
	if (candidates.length === 0) return null;
	const exact = candidates.find((role) => {
		const roleKind = STANDARD_SVG_ROLES[role].kind;
		return roleKind === kind
			|| (role === "svg-ink" && kind === "text")
			|| (roleKind === "support" && kind !== "text")
			|| (roleKind === "background" && ["fill", "background"].includes(kind));
	});
	if (exact) return exact;
	// 珊瑚文字和珊瑚描边使用不同的标准浅色值;上下文决定角色,避免用描边色绘制小字。
	if (kind === "text" && candidates.includes("svg-coral-stroke")) return "svg-coral-text";
	if (kind === "graphic" && candidates.includes("svg-coral-text")) return "svg-coral-stroke";
	return null;
}

function opacityPropertyForPaint(property) {
	return {
		fill: "fill-opacity",
		stroke: "stroke-opacity",
		"stop-color": "stop-opacity",
		"flood-color": "flood-opacity",
		color: "opacity",
	}[property] || "opacity";
}

function elementRecords(source) {
	return [...source.matchAll(TAG_NAME)].map((match) => {
		const attributes = match[2];
		return {
			index: match.index,
			tag: match[1].toLowerCase(),
			attributes,
			classes: (attributeValueOf(attributes, "class") || "").split(/\s+/).filter(Boolean),
			id: attributeValueOf(attributes, "id"),
		};
	});
}

function selectorMatchesElement(selector, element) {
	const trimmed = selector.trim();
	if (!trimmed || trimmed.startsWith("@")) return false;
	const ids = [...trimmed.matchAll(/#([a-z0-9_.:-]+)/gi)].map((match) => match[1]);
	if (ids.some((id) => id !== element.id)) return false;
	const classes = [...trimmed.matchAll(/\.([a-z0-9_-]+)/gi)].map((match) => match[1]);
	if (classes.some((className) => !element.classes.includes(className))) return false;
	const tags = [...trimmed.matchAll(/(?:^|[\s>+~,(])([a-z][a-z0-9:-]*)/gi)].map((match) => match[1].toLowerCase());
	if (tags.length > 0 && !tags.includes(element.tag)) return false;
	return ids.length > 0 || classes.length > 0 || tags.length > 0;
}

function selectorElements(selector, elements) {
	return selector.split(",").flatMap((part) => elements.filter((element) => selectorMatchesElement(part, element)));
}

function roleClassForPaint(color, property, tag, definitions, alpha = null) {
	const normalized = normalizeHex(color);
	if (!normalized) throw new Error(`不支持的 SVG 颜色值: ${color}`);
	let kind = paintKind(tag, property);
	if (kind === "fill" && ["svg", "rect"].includes(tag.toLowerCase()) && contrastRatio(normalized, STANDARD_SVG_ROLES["svg-page"].light) < 3) {
		kind = "background";
	}
	const opacity = alpha == null || alpha >= 1 ? null : alpha;
	const standardRole = opacity == null ? compatibleStandardRole(normalized, kind) : null;
	let className;
	let light;
	let dark;
	if (standardRole) {
		className = ["fill", "stroke"].includes(property) ? `${standardRole}-${property}` : standardRole;
		light = STANDARD_SVG_ROLES[standardRole].light;
		dark = STANDARD_SVG_ROLES[standardRole].dark;
	} else {
		const propertyName = property.replace(/[^a-z0-9]+/gi, "-");
		const alphaSuffix = opacity == null ? "" : `-a${Math.round(opacity * 1000)}`;
		className = `svg-special-${kind}-${propertyName}-${normalized.slice(1)}${alphaSuffix}`;
		light = deriveLightColor(normalized, kind);
		dark = deriveDarkColor(light, kind);
	}
	if (!definitions.has(className)) {
		definitions.set(className, {
			className,
			property,
			light,
			dark,
			opacity,
			opacityProperty: opacity == null ? null : opacityPropertyForPaint(property),
		});
	}
	return className;
}

function appendAssignedClass(assignments, elementIndex, className) {
	if (!assignments.has(elementIndex)) assignments.set(elementIndex, new Set());
	assignments.get(elementIndex).add(className);
}

function transformStyledBlock(css, elements, assignments, definitions) {
	return css.replace(CSS_RULE, (rule, selector, body) => {
		const matchedElements = selectorElements(selector, elements);
		const nextBody = body.replace(CSS_PAINT_DECLARATION, (declaration, prefix, property, rawValue) => {
			const value = rawValue.trim();
			if (NON_PAINT_VALUE.test(value)) return declaration;
			const color = parsePaintColor(value);
			if (!color) {
				throw new Error(`CSS 颜色声明无法安全迁移: ${property}: ${value}`);
			}
			for (const element of matchedElements) {
				appendAssignedClass(
					assignments,
					element.index,
					roleClassForPaint(color.hex, property.toLowerCase(), element.tag, definitions, color.alpha),
				);
			}
			// 未命中的 CSS 规则没有发布效果,但删除字面量可以避免它绕过契约。
			return prefix;
		});
		const cleanedBody = nextBody
			.replace(/^\s*(?:;\s*)+/, " ")
			.replace(/;\s*;/g, "; ");
		return `${selector}{${cleanedBody}}`;
	});
}

function transformDirectPaints(attributes, tag, assignments, elementIndex, definitions) {
	let next = attributes.replace(DIRECT_PAINT_ATTRIBUTE, (declaration, property, quote, value) => {
		if (NON_PAINT_VALUE.test(value.trim())) return declaration;
		const color = parsePaintColor(value);
		if (!color) throw new Error(`SVG 属性颜色无法安全迁移: ${property}="${value}"`);
		appendAssignedClass(assignments, elementIndex, roleClassForPaint(color.hex, property.toLowerCase(), tag, definitions, color.alpha));
		return "";
	});
	next = next.replace(/\bstyle\s*=\s*(["'])([^"']*)\1/gi, (attribute, quote, style) => {
		const migratedStyle = style.replace(INLINE_PAINT_DECLARATION, (declaration, prefix, property, rawValue) => {
			const value = rawValue.trim();
			if (NON_PAINT_VALUE.test(value)) return declaration;
			const color = parsePaintColor(value);
			if (!color) throw new Error(`内联样式颜色无法安全迁移: ${property}: ${value}`);
			appendAssignedClass(assignments, elementIndex, roleClassForPaint(color.hex, property.toLowerCase(), tag, definitions, color.alpha));
			return prefix;
		});
		return migratedStyle.trim() ? `style=${quote}${migratedStyle}${quote}` : "";
	});
	return next;
}

function specializedRule(entry, theme, indent) {
	const opacity = entry.opacity == null ? "" : ` ${entry.opacityProperty}: ${entry.opacity};`;
	return `${indent}.${entry.className} { ${entry.property}: ${entry[theme]};${opacity} }`;
}

function specializedThemeStyle(definitions) {
	const entries = [...definitions.values()].sort((first, second) => first.className.localeCompare(second.className));
	const lines = ["<style>"];
	for (const entry of entries) lines.push(specializedRule(entry, "light", "  "));
	lines.push("  @media (prefers-color-scheme: dark) {");
	for (const entry of entries) lines.push(specializedRule(entry, "dark", "    "));
	lines.push("  }");
	lines.push("</style>");
	return lines.join("\n");
}

const SPECIAL_ROLE_RULE = /(\.([a-z0-9-]+)\s*\{)([^{}]*)(\})/gi;

function matchingBrace(text, opening) {
	let depth = 0;
	let quote = null;
	for (let index = opening; index < text.length; index += 1) {
		const char = text[index];
		if (quote) {
			if (char === quote && text[index - 1] !== "\\") quote = null;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === "{") depth += 1;
		if (char === "}") {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	return -1;
}

function refreshExistingThemeRoles(source) {
	let changed = false;
	const migrated = source.replace(SPECIALIZED_STYLE_BLOCK, (match, attributes, css) => {
		const mediaIndex = css.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i);
		const mediaOpening = mediaIndex < 0 ? -1 : css.indexOf("{", mediaIndex);
		const mediaClosing = mediaOpening < 0 ? -1 : matchingBrace(css, mediaOpening);
		const rewritten = css.replace(SPECIAL_ROLE_RULE, (rule, opening, className, body, closing, offset) => {
			const role = className.match(/^svg-special-(text|background)-[a-z0-9-]+-([0-9a-f]{6})(?:-a(\d{1,4}))?$/i);
			if (!role) return rule;
			const paint = body.match(/\b(fill|stroke|stop-color|flood-color|color)\s*:\s*#[0-9a-f]{6}\b/i);
			if (!paint) return rule;
			const kind = role[1].toLowerCase();
			const light = deriveLightColor(`#${role[2]}`, kind);
			const isDark = mediaOpening >= 0 && offset > mediaIndex && offset < mediaClosing;
			const nextColor = isDark ? deriveDarkColor(light, kind) : light;
			let nextBody = body.replace(paint[0], `${paint[1]}: ${nextColor}`);
			if (role[3]) {
				const opacity = Math.min(1, Number.parseInt(role[3], 10) / 1000);
				const opacityProperty = opacityPropertyForPaint(paint[1].toLowerCase());
				const opacityDeclaration = new RegExp(`\\b${opacityProperty}\\s*:\\s*[^;{}]+;?`, "i");
				if (opacityDeclaration.test(nextBody)) {
					nextBody = nextBody.replace(opacityDeclaration, `${opacityProperty}: ${opacity};`);
				} else {
					nextBody = `${nextBody.trimEnd()} ${opacityProperty}: ${opacity};`;
				}
			}
			if (nextBody !== body) changed = true;
			return `${opening}${nextBody}${closing}`;
		});
		return `<style${attributes}>${rewritten}</style>`;
	});
	return { source: migrated, changed };
}

function insertSpecializedStyle(source, definitions) {
	return source.replace(/(<svg\b[^>]*>)/i, `$1\n${specializedThemeStyle(definitions)}`);
}

function appendSpecializedDefinitions(source, definitions) {
	const entries = [...definitions.values()].sort((first, second) => first.className.localeCompare(second.className));
	const light = entries.map((entry) => specializedRule(entry, "light", "  ")).join("\n");
	const dark = entries.map((entry) => specializedRule(entry, "dark", "    ")).join("\n");
	return source.replace(/(<svg\b[^>]*>\s*<style\b[^>]*>)([\s\S]*?)(<\/style>)/i, (match, opening, css, closingTag) => {
		const mediaIndex = css.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i);
		if (mediaIndex < 0) return match;
		const mediaClosing = css.lastIndexOf("\n  }");
		if (mediaClosing < mediaIndex) return match;
		const lightSeparator = css.slice(0, mediaIndex).endsWith("\n") ? "" : "\n";
		const darkSeparator = css.slice(mediaIndex, mediaClosing).endsWith("\n") ? "" : "\n";
		return `${opening}${css.slice(0, mediaIndex)}${lightSeparator}${light}\n${css.slice(mediaIndex, mediaClosing)}${darkSeparator}${dark}\n${css.slice(mediaClosing)}${closingTag}`;
	});
}

function cleanMigratedStyleBlocks(source) {
	return trimSvgLineWhitespace(source.replace(SPECIALIZED_STYLE_BLOCK, (match, attributes, css) => {
		const cleaned = css.replace(/\{\s*(?:;\s*)+/g, "{").replace(/;\s*;/g, "; ");
		return `<style${attributes}>${cleaned}</style>`;
	}));
}

function refreshExistingBackgroundRoles(source, { asset = "<inline-svg>" } = {}) {
	const definitions = new Map();
	let changed = false;
	const repaired = source.replace(TAG_NAME, (match, tag, attributes, selfClose) => {
		const tagName = tag.toLowerCase();
		if (!["rect", "g"].includes(tagName)) return match;
		const classAttribute = attributes.match(/\bclass\s*=\s*(["'])([^"']*)\1/i);
		if (!classAttribute) return match;
		const existing = classAttribute[2].split(/\s+/).filter(Boolean);
		const additions = [];
		for (const className of existing) {
			const color = className.match(/^svg-special-fill-fill-([0-9a-f]{6})$/i)?.[1];
			if (!color) continue;
			const kind = tagName === "g"
				? "text"
				: contrastRatio(`#${color}`, STANDARD_SVG_ROLES["svg-page"].light) < 3
					? "background"
					: null;
			if (!kind) continue;
			const semanticClass = `svg-special-${kind}-fill-${color.toLowerCase()}`;
			if (existing.includes(semanticClass)) continue;
			additions.push(semanticClass);
			definitions.set(semanticClass, {
				className: semanticClass,
				property: "fill",
				light: deriveLightColor(`#${color}`, kind),
				dark: deriveDarkColor(deriveLightColor(`#${color}`, kind), kind),
			});
		}
		if (additions.length === 0) return match;
		changed = true;
		const nextAttributes = addClasses(attributes, additions);
		return `<${tag}${nextAttributes}${selfClose}>`;
	});
	const refreshed = refreshExistingThemeRoles(repaired);
	if (!changed && !refreshed.changed) return { source, changed: false };
	const migrated = trimSvgLineWhitespace(appendSpecializedDefinitions(refreshed.source, definitions));
	if (structuralProjection(source) !== structuralProjection(migrated)) {
		throw new Error(`SVG ${asset} 专用背景角色刷新后结构投影发生变化`);
	}
	const contract = validateSvgTheme(migrated, { asset });
	if (contract.errors.length > 0) {
		throw new Error(`SVG ${asset} 专用背景角色刷新未通过主题契约: ${contract.errors.map(({ code }) => code).join(", ")}`);
	}
	return { source: migrated, changed: true };
}

/**
 * 专用插图迁移路径。
 *
 * 该路径不猜测一个源色在所有位置的含义,而是按元素、绘制属性和上下文
 * 拆分角色。它保留渐变和已有结构,只把颜色声明移到有明暗覆盖的语义类。
 */
export function applySpecializedSvgMigration(source, { asset = "<inline-svg>" } = {}) {
	const text = String(source);
	if (/\bdata-svg-theme\s*=\s*["']paper-ink-v1["']/i.test(text)) {
		const cleaned = cleanMigratedStyleBlocks(text);
		const refreshed = refreshExistingBackgroundRoles(cleaned, { asset });
		if (refreshed.changed) {
			return {
				source: refreshed.source,
				classification: "already-migrated",
				analysis: analyzeSvgMigration(refreshed.source, { asset }),
				changed: true,
			};
		}
		if (cleaned !== text) {
			const contract = validateSvgTheme(cleaned, { asset });
			if (contract.errors.length > 0) {
				throw new Error(`SVG ${asset} 已迁移样式清理未通过主题契约: ${contract.errors.map(({ code }) => code).join(", ")}`);
			}
			return {
				source: cleaned,
				classification: "already-migrated",
				analysis: analyzeSvgMigration(cleaned, { asset }),
				changed: true,
			};
		}
		const contract = validateSvgTheme(text, { asset });
		if (contract.errors.length > 0) {
			throw new Error(`SVG ${asset} 已迁移资产未通过主题契约: ${contract.errors.map(({ code }) => code).join(", ")}`);
		}
		return {
			source: text,
			classification: "already-migrated",
			analysis: analyzeSvgMigration(text, { asset }),
			changed: false,
		};
	}
	const analysis = analyzeSvgMigration(text, { asset });
	const elements = elementRecords(text);
	const assignments = new Map();
	const definitions = new Map();
	const transformedStyles = [...text.matchAll(SPECIALIZED_STYLE_BLOCK)].map((match) =>
		transformStyledBlock(match[2], elements, assignments, definitions),
	);
	let migrated = text.replace(TAG_NAME, (match, tag, attributes, selfClose, offset) => {
		if (tag.toLowerCase() === "style") return match;
		const elementClasses = [...(assignments.get(offset) || [])];
		const direct = transformDirectPaints(attributes, tag.toLowerCase(), assignments, offset, definitions);
		elementClasses.push(...(assignments.get(offset) || []));
		const nextAttributes = addClasses(direct, elementClasses);
		return `<${tag}${nextAttributes}${selfClose}>`;
	});
	let styleIndex = 0;
	migrated = migrated.replace(SPECIALIZED_STYLE_BLOCK, (match, attributes) => {
		const css = transformedStyles[styleIndex++];
		return `<style${attributes}>${css}</style>`;
	});
	migrated = trimSvgLineWhitespace(insertSpecializedStyle(addThemeMarker(migrated), definitions));
	if (structuralProjection(text) !== structuralProjection(migrated)) {
		throw new Error(`SVG ${asset} 专用迁移后结构投影发生变化`);
	}
	const contract = validateSvgTheme(migrated, { asset });
	if (contract.errors.length > 0) {
		throw new Error(`SVG ${asset} 专用迁移结果未通过主题契约: ${contract.errors.map(({ code, message }) => `${code}(${message})`).join(", ")}`);
	}
	return { source: migrated, classification: "specialized", analysis, changed: migrated !== text };
}
