/**
 * SVG 主题契约的纯检查核心。
 *
 * 约定:
 *   - 根元素声明 data-svg-theme="paper-ink-v1";
 *   - 绘制对象通过 svg-* 语义类使用颜色;
 *   - 默认样式是浅色主题;
 *   - 暗色值放在 prefers-color-scheme: dark 媒体规则中;
 *   - 专用角色按 svg-special-text-<name>、svg-special-graphic-<name>、
 *     svg-special-fill-<name>、svg-special-background-<name> 命名。
 *
 * 这里不做 XML 重写,也不把 CSS 当作完整浏览器实现。检查器只接受
 * 迁移工具生成的受限 CSS 形态,这样源文件和发布闸可以共享确定的规则。
 */

export const SVG_THEME_CONTRACT = "paper-ink-v1";

export const STANDARD_SVG_ROLES = Object.freeze({
	"svg-page": {
		kind: "background",
		light: "#faf9f5",
		dark: "#151515",
	},
	"svg-ink": {
		kind: "graphic",
		light: "#312f2f",
		dark: "#f0efe8",
		minimumContrast: 3,
	},
	"svg-muted": {
		kind: "text",
		light: "#6c6a64",
		dark: "#aaa9a1",
		minimumContrast: 4.5,
	},
	"svg-axis": {
		kind: "support",
		light: "#b8b2a8",
		dark: "#8b8a83",
	},
	"svg-divider": {
		kind: "support",
		light: "#e1ddd7",
		dark: "#4f4f49",
	},
	"svg-coral-text": {
		kind: "text",
		light: "#a9583e",
		dark: "#dc896d",
		minimumContrast: 4.5,
	},
	"svg-coral-stroke": {
		kind: "graphic",
		light: "#cc785c",
		dark: "#e28466",
		minimumContrast: 3,
	},
});

const PAINT_PROPERTIES = new Set([
	"color",
	"fill",
	"flood-color",
	"stop-color",
	"stroke",
]);
const PAINT_TAGS = new Set([
	"circle",
	"ellipse",
	"line",
	"path",
	"polygon",
	"polyline",
	"rect",
	"stop",
	"text",
]);
const HEX_COLOR = /#[0-9a-f]{3,8}\b/gi;
const ROLE_TOKEN = /\bsvg-[a-z0-9-]+\b/gi;
const STANDARD_ROLE_ALIAS = /^(svg-(?:page|ink|muted|axis|divider|coral-text|coral-stroke))(?:-(?:fill|stroke))?$/;
const SPECIAL_ROLE = /^svg-special-(text|graphic|fill|background)-[a-z0-9-]+$/;
const DARK_MEDIA = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi;
const SAFE_PAINT_VALUE = /^(?:none|transparent|currentcolor|inherit|context-(?:fill|stroke)|var\(--[a-z0-9-]+\)|url\([^)]*\))$/i;

function makeIssue(code, message, asset) {
	return { code, message, ...(asset ? { asset } : {}) };
}

function lineOf(text, index) {
	let line = 1;
	for (let i = 0; i < index; i += 1) if (text[i] === "\n") line += 1;
	return line;
}

function issueAt(code, message, asset, source, index = 0) {
	return makeIssue(code, `${message} (第 ${lineOf(source, index)} 行)`, asset);
}

export function normalizeHex(value) {
	const raw = String(value || "").trim().toLowerCase();
	if (!/^#[0-9a-f]{3,8}$/.test(raw)) return null;
	if (raw.length === 4) {
		return `#${[...raw.slice(1)].map((char) => char + char).join("")}`;
	}
	if (raw.length === 5) {
		return raw.endsWith("f") ? normalizeHex(raw.slice(0, 4)) : null;
	}
	if (raw.length === 8) {
		return raw.endsWith("ff") ? raw.slice(0, 7) : null;
	}
	return raw;
}

function channel(value) {
	const normalized = normalizeHex(value);
	if (!normalized) throw new TypeError(`invalid opaque hex color: ${value}`);
	return [...normalized.slice(1).matchAll(/../g)].map((match) =>
		Number.parseInt(match[0], 16) / 255,
	);
}

function relativeLuminance(value) {
	return channel(value)
		.map((component) =>
			component <= 0.03928
				? component / 12.92
				: ((component + 0.055) / 1.055) ** 2.4,
		)
		.reduce((sum, component, index) =>
			sum + component * [0.2126, 0.7152, 0.0722][index], 0);
}

export function contrastRatio(foreground, background) {
	const first = relativeLuminance(foreground);
	const second = relativeLuminance(background);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function canonicalRoleClass(value) {
	if (Object.hasOwn(STANDARD_SVG_ROLES, value)) return value;
	const standardAlias = value.match(STANDARD_ROLE_ALIAS);
	if (standardAlias) return standardAlias[1];
	if (SPECIAL_ROLE.test(value)) return value;
	return null;
}

function isRoleClass(value) {
	return canonicalRoleClass(value) !== null;
}

function roleClasses(text) {
	return [...new Set((text.match(ROLE_TOKEN) || []).map((value) => value.toLowerCase()))];
}

function stripComments(text) {
	return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

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

function extractDarkMedia(css, asset, source) {
	const matches = [...css.matchAll(DARK_MEDIA)];
	const issues = [];
	if (matches.length === 0) {
		issues.push(makeIssue("MISSING_DARK_MEDIA", "缺少 prefers-color-scheme: dark 媒体规则", asset));
		return { lightCss: css, darkCss: "", issues };
	}
	if (matches.length > 1) {
		issues.push(makeIssue("DUPLICATE_DARK_MEDIA", "只能声明一个暗色主题媒体规则", asset));
	}
	const match = matches[0];
	const opening = css.indexOf("{", match.index + match[0].length);
	if (opening < 0) {
		issues.push(issueAt("UNBALANCED_CSS", "暗色媒体规则缺少左大括号", asset, source, match.index));
		return { lightCss: css, darkCss: "", issues };
	}
	const closing = matchingBrace(css, opening);
	if (closing < 0) {
		issues.push(issueAt("UNBALANCED_CSS", "暗色媒体规则缺少右大括号", asset, source, match.index));
		return { lightCss: css, darkCss: "", issues };
	}
	return {
		lightCss: `${css.slice(0, match.index)}${css.slice(closing + 1)}`,
		darkCss: css.slice(opening + 1, closing),
		issues,
	};
}

function cssRules(css) {
	return [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
		selector: match[1].trim(),
		body: match[2],
		index: match.index,
	}));
}

function declarations(body) {
	return [...body.matchAll(/(?:^|;)\s*([a-z-]+)\s*:\s*([^;]+?)(?=;|$)/gi)]
		.map((match) => ({ property: match[1].toLowerCase(), value: match[2].trim() }))
		.filter(({ property }) => PAINT_PROPERTIES.has(property));
}

function colorValues(body) {
	return [...body.matchAll(HEX_COLOR)].map((match) => ({ value: match[0], index: match.index }));
}

function addRoleColors(target, role, values) {
	if (!target.has(role)) target.set(role, new Set());
	for (const value of values) target.get(role).add(value);
}

function parseRoleColors(css, theme, asset, source, issues) {
	const roles = new Map();
	for (const rule of cssRules(css)) {
		const tokens = roleClasses(rule.selector);
		const unknown = tokens.filter((token) => !isRoleClass(token));
		for (const token of unknown) {
			issues.push(issueAt("UNKNOWN_PAINT_ROLE", `未登记的 SVG 角色类 ${token}`, asset, source, rule.index));
		}
		const known = [...new Set(tokens.filter(isRoleClass).map(canonicalRoleClass))];
		const colors = colorValues(rule.body);
		const paints = declarations(rule.body);
		const unsafePaints = paints.filter(({ value }) => !SAFE_PAINT_VALUE.test(value));
		if (colors.length > 0 && known.length === 0) {
			issues.push(issueAt("UNSCOPED_COLOR_LITERAL", "颜色字面量必须位于语义角色类中", asset, source, rule.index));
		}
		if (unsafePaints.length > 0 && known.length === 0) {
			issues.push(issueAt("UNSCOPED_PAINT_LITERAL", "绘制颜色必须位于语义角色类中", asset, source, rule.index));
		}
		if (known.length === 0) continue;
		const normalized = [];
		for (const color of colors) {
			const value = normalizeHex(color.value);
			if (!value) {
				issues.push(issueAt("NON_OPAQUE_COLOR", `角色 ${known.join(", ")} 使用了非不透明颜色 ${color.value}`, asset, source, rule.index + color.index));
				continue;
			}
			normalized.push(value);
		}
		if (unsafePaints.some(({ value }) => !normalizeHex(value))) {
			issues.push(issueAt("ROLE_COLOR_NOT_HEX", `角色 ${known.join(", ")} 的绘制值必须是十六进制颜色`, asset, source, rule.index));
		}
		for (const role of known) addRoleColors(roles, role, normalized);
	}
	return { theme, roles };
}

function mergeRoleMaps(light, dark) {
	const roles = new Map();
	for (const role of new Set([...light.keys(), ...dark.keys()])) {
		const lightValues = [...(light.get(role) || [])];
		const darkValues = [...(dark.get(role) || [])];
		roles.set(role, {
			kind: STANDARD_SVG_ROLES[role]?.kind || role.match(SPECIAL_ROLE)?.[1] || "special",
			light: lightValues.length === 1 ? lightValues[0] : lightValues,
			dark: darkValues.length === 1 ? darkValues[0] : darkValues,
			lightValues,
			darkValues,
		});
	}
	return roles;
}

function attributeValue(attributes, name) {
	const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
	return match?.[1] ?? null;
}

function allowedPaint(value) {
	return SAFE_PAINT_VALUE.test(String(value || "").trim());
}

function scanMarkup(source, asset, issues) {
	const withoutStyles = source
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "");
	const ids = new Map();
	for (const match of source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
		if (ids.has(match[1])) {
			issues.push(issueAt("DUPLICATE_ID", `SVG id 重复: ${match[1]}`, asset, source, match.index));
		} else ids.set(match[1], match.index);
	}
	for (const match of source.matchAll(/url\(\s*#([^\s)]+)\s*\)/gi)) {
		if (!ids.has(match[1])) {
			issues.push(issueAt("MISSING_REFERENCE", `内部 SVG 引用不存在: #${match[1]}`, asset, source, match.index));
		}
	}
	for (const match of source.matchAll(/(?:href|xlink:href)\s*=\s*["']#([^"']+)["']/gi)) {
		if (!ids.has(match[1])) {
			issues.push(issueAt("MISSING_REFERENCE", `内部 SVG 引用不存在: #${match[1]}`, asset, source, match.index));
		}
	}

	const stack = [];
	for (const match of withoutStyles.matchAll(/<\/?([a-z][a-z0-9:-]*)\b([^>]*)>/gi)) {
		const closing = match[0].startsWith("</");
		const tag = match[1].toLowerCase();
		if (closing) {
			stack.pop();
			continue;
		}
		const attributes = match[2];
		const localRoles = roleClasses(attributeValue(attributes, "class") || "");
		for (const role of localRoles) {
			if (!isRoleClass(role)) {
				issues.push(issueAt("UNKNOWN_PAINT_ROLE", `未登记的 SVG 角色类 ${role}`, asset, source, match.index));
			}
		}
		const inheritedRole = stack.at(-1)?.role || null;
		const role = canonicalRoleClass(localRoles.find(isRoleClass) || "") || inheritedRole;
		const directPaints = [...attributes.matchAll(/\b(fill|stroke|color|stop-color|flood-color)\s*=\s*["']([^"']*)["']/gi)];
		const inlinePaints = [...attributes.matchAll(/\bstyle\s*=\s*["']([^"']*)["']/gi)].flatMap((style) =>
			[...style[1].matchAll(/(?:^|;)\s*(fill|stroke|color|stop-color|flood-color)\s*:\s*([^;]+)/gi)].map((paint) => [paint[1], paint[2].trim()]),
		);
		const paintValues = [
			...directPaints.map(([, property, value]) => [property, value]),
			...inlinePaints,
		];
		for (const paint of paintValues) {
			if (!allowedPaint(paint[1])) {
				issues.push(issueAt("DIRECT_PAINT_LITERAL", `${paint[0]} 不能直接写颜色 ${paint[1]}`, asset, source, match.index));
			}
		}
		const allSafePaints = paintValues.length > 0 && paintValues.every(([, value]) =>
			allowedPaint(value) && !/#[0-9a-f]{3,8}\b/i.test(value.trim()),
		);
		if (PAINT_TAGS.has(tag) && paintValues.length > 0 && !role && !allSafePaints) {
			issues.push(issueAt("MISSING_PAINT_ROLE", `绘制元素 <${tag}> 必须使用 SVG 语义角色类`, asset, source, match.index));
		}
		if (!match[0].endsWith("/>") && !["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"].includes(tag)) {
			stack.push({ tag, role });
		}
	}
}

function validateRoleDefinitions(roles, usedRoles, asset, issues) {
	const allRoles = new Set([...roles.keys(), ...usedRoles]);
	for (const role of allRoles) {
		const info = roles.get(role);
		if (!info) {
			issues.push(makeIssue("MISSING_ROLE_DEFINITION", `使用的角色 ${role} 没有 CSS 定义`, asset));
			continue;
		}
		if (info.lightValues.length === 0) issues.push(makeIssue("MISSING_LIGHT_ROLE", `角色 ${role} 缺少浅色值`, asset));
		if (info.darkValues.length === 0) issues.push(makeIssue("MISSING_DARK_ROLE", `角色 ${role} 缺少暗色值`, asset));
		const standard = STANDARD_SVG_ROLES[role];
		if (standard) {
			if (info.lightValues.some((value) => value !== standard.light)) {
				issues.push(makeIssue("WRONG_STANDARD_COLOR", `标准角色 ${role} 的浅色值应为 ${standard.light}`, asset));
			}
			if (info.darkValues.some((value) => value !== standard.dark)) {
				issues.push(makeIssue("WRONG_STANDARD_COLOR", `标准角色 ${role} 的暗色值应为 ${standard.dark}`, asset));
			}
		} else {
			if (info.lightValues.length !== 1 || info.darkValues.length !== 1) {
				issues.push(makeIssue("AMBIGUOUS_SPECIAL_ROLE", `专用角色 ${role} 每个主题必须只有一个颜色值`, asset));
			}
		}
	}
}

function validateContrast(roles, asset, issues) {
	const page = STANDARD_SVG_ROLES["svg-page"];
	for (const [role, info] of roles) {
		const standard = STANDARD_SVG_ROLES[role];
		const kind = standard?.kind || role.match(SPECIAL_ROLE)?.[1];
		const minimum = standard?.minimumContrast || (kind === "text" ? 4.5 : kind === "graphic" || kind === "fill" ? 3 : null);
		if (!minimum) continue;
		for (const [theme, values, background] of [["light", info.lightValues, page.light], ["dark", info.darkValues, page.dark]]) {
			for (const value of values) {
				if (contrastRatio(value, background) < minimum) {
					issues.push(makeIssue("CONTRAST_TOO_LOW", `${role} 的 ${theme} 颜色 ${value} 与页面背景对比度低于 ${minimum}:1`, asset));
				}
			}
		}
	}
}

export function validateSvgTheme(source, { asset = "<inline-svg>", strict = true } = {}) {
	const text = String(source);
	const errors = [];
	const warnings = [];
	const marker = text.match(/<svg\b[^>]*\bdata-svg-theme\s*=\s*["']([^"']+)["']/i);
	if (!marker) {
		const issue = makeIssue("MISSING_THEME_CONTRACT", `缺少 data-svg-theme="${SVG_THEME_CONTRACT}"`, asset);
		if (!strict) return { errors, warnings: [issue], legacy: true, roles: new Map() };
		errors.push(issue);
		return { errors, warnings, legacy: true, roles: new Map() };
	}
	if (marker[1] !== SVG_THEME_CONTRACT) {
		errors.push(makeIssue("UNSUPPORTED_THEME_CONTRACT", `不支持的 SVG 主题契约: ${marker[1]}`, asset));
	}
	if (!/<svg\b[^>]*>/i.test(text) || !/<\/svg>\s*$/i.test(text.trim())) {
		errors.push(makeIssue("INVALID_SVG_ROOT", "SVG 根元素不完整", asset));
	}

	const styles = [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
	if (styles.length === 0) {
		errors.push(makeIssue("MISSING_THEME_STYLE", "缺少 SVG 主题样式块", asset));
		return { errors, warnings, legacy: false, roles: new Map() };
	}
	const css = stripComments(styles.join("\n"));
	const media = extractDarkMedia(css, asset, text);
	errors.push(...media.issues);
	const lightParsed = parseRoleColors(media.lightCss, "light", asset, text, errors);
	const darkParsed = parseRoleColors(media.darkCss, "dark", asset, text, errors);
	const roles = mergeRoleMaps(lightParsed.roles, darkParsed.roles);
	const usedRoles = new Set();
	for (const match of text.matchAll(/\bclass\s*=\s*["']([^"']+)["']/gi)) {
		for (const role of roleClasses(match[1])) {
			if (!isRoleClass(role)) errors.push(issueAt("UNKNOWN_PAINT_ROLE", `未登记的 SVG 角色类 ${role}`, asset, text, match.index));
			else usedRoles.add(canonicalRoleClass(role));
		}
	}
	validateRoleDefinitions(roles, usedRoles, asset, errors);
	validateContrast(roles, asset, errors);
	scanMarkup(text, asset, errors);
	return { errors, warnings, legacy: false, roles };
}

export function formatSvgThemeIssue(issue) {
	const location = issue.asset ? `${issue.asset}: ` : "";
	return `${location}${issue.code} ${issue.message}`;
}
