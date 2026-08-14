const FOOTNOTE_DEFINITION = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/;
const FOOTNOTE_REFERENCE = /(?<!!)\[\^([^\]\s]+)\]/g;
const MARGINNOTE_HEADER = /^> \[!marginnote\][ \t]*(.*)$/i;
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/;

/**
 * 在 wikilink 改写和普通 callout 降级前验证旁注源语法。
 *
 * 返回值保持输入文本不变，只把非 marginnote callout 降级为普通引用块。
 * errors 会阻止同步；warnings 只进入现有 LINT 输出。
 */
export function prepareSidenoteSource(text, { preserveCallouts = [] } = {}) {
	const newline = text.includes("\r\n") ? "\r\n" : "\n";
	const lines = text.split(/\r?\n/);
	const errors = [];
	const warnings = [];
	const references = new Map();
	const definitions = new Map();
	const sidenotes = [];
	let inFence = false;

	for (let index = 0; index < lines.length; index++) {
		const sourceLine = lines[index];
		const lineNumber = index + 1;

		if (FENCE.test(sourceLine)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;

		const marginnote = sourceLine.match(MARGINNOTE_HEADER);
		if (marginnote) {
			const parsed = parseMarginnote(lines, index, marginnote[1]);
			errors.push(...parsed.errors);
			if (parsed.content) {
					sidenotes.push({
						line: lineNumber,
						content: parsed.content,
					});
			}
			index = parsed.endIndex;
			continue;
		}

		const definition = sourceLine.match(FOOTNOTE_DEFINITION);
		if (definition) {
			const id = normalizeFootnoteId(definition[1]);
			const parsed = parseFootnoteDefinition(lines, index, definition[2]);
			const item = {
				line: lineNumber,
				content: parsed.content,
			};
			if (!definitions.has(id)) definitions.set(id, []);
			definitions.get(id).push(item);
			errors.push(
				...validateInlineContent(parsed.content, lineNumber, {
					multiParagraph: parsed.multiParagraph,
				}),
			);
			index = parsed.endIndex;
			continue;
		}

		const referenceText = sourceLine.replace(/`[^`]*`/g, "");
		for (const match of referenceText.matchAll(FOOTNOTE_REFERENCE)) {
			const id = normalizeFootnoteId(match[1]);
			if (!references.has(id)) references.set(id, []);
			references.get(id).push(lineNumber);
		}
	}

	const ids = new Set([...references.keys(), ...definitions.keys()]);
	for (const id of ids) {
		const referenceLines = references.get(id) ?? [];
		const definitionItems = definitions.get(id) ?? [];
		if (referenceLines.length > 1) {
			errors.push(
				issue(
					referenceLines,
					`脚注「${id}」重复引用：第 ${formatLines(referenceLines)} 行`,
				),
			);
		}
		if (referenceLines.length > 0 && definitionItems.length === 0) {
			errors.push(
				issue(
					referenceLines,
					`脚注「${id}」缺失定义：引用位于第 ${formatLines(referenceLines)} 行`,
				),
			);
		}
		if (definitionItems.length > 1) {
			const definitionLines = definitionItems.map((item) => item.line);
			errors.push(
				issue(
					definitionLines,
					`脚注「${id}」重复定义：第 ${formatLines(definitionLines)} 行`,
				),
			);
		}
		if (referenceLines.length === 0 && definitionItems.length > 0) {
			const definitionLines = definitionItems.map((item) => item.line);
			errors.push(
				issue(
					definitionLines,
					`脚注「${id}」存在孤立定义：第 ${formatLines(definitionLines)} 行`,
				),
			);
		}
		if (referenceLines.length === 1 && definitionItems.length === 1) {
			sidenotes.push({
				line: definitionItems[0].line,
				content: definitionItems[0].content,
			});
		}
	}

	if (sidenotes.length > 6) {
		warnings.push(
			issue(
				sidenotes.map((note) => note.line),
				`旁注共 ${sidenotes.length} 条，超过 6 条的密度建议值`,
			),
		);
	}
	for (const note of sidenotes) {
		const length = visibleLength(note.content);
		if (length > 120) {
			warnings.push(
				issue(
					[note.line],
					`单条旁注约 ${length} 个可见字符，超过 120 个字符的长度建议值`,
				),
			);
		}
	}

	return {
		text: stripOrdinaryCallouts(lines.join(newline), new Set(preserveCallouts.map((type) => type.toLowerCase()))),
		errors,
		warnings,
	};
}

function parseMarginnote(lines, headerIndex, labelSource) {
	const lineNumber = headerIndex + 1;
	const errors = [];
	const label = labelSource.trim();
	if (!label) errors.push(issue([lineNumber], "marginnote 缺少标签"));

	const previousIndex = findPreviousContentLine(lines, headerIndex - 1);
	const previous = previousIndex >= 0 ? lines[previousIndex] : "";
	const previousKind = classifyPreviousBlock(previous);
	if (previousKind !== "正文") {
		errors.push(
			issue(
				[lineNumber, previousIndex + 1].filter((line) => line > 0),
				`marginnote 必须紧邻正文段落，当前位于${previousKind}后`,
			),
		);
	}

	const contentLines = [];
	let endIndex = headerIndex;
	for (let index = headerIndex + 1; index < lines.length; index++) {
		const quote = lines[index].match(/^>[ \t]?(.*)$/);
		if (!quote) break;
		contentLines.push(quote[1]);
		endIndex = index;
	}
	const content = contentLines.join("\n").trim();
	if (!content) {
		errors.push(issue([lineNumber], "marginnote 内容为空"));
	}
	const multiParagraph = contentLines.some((line) => line.trim() === "");
	if (content) {
		errors.push(
			...validateInlineContent(content, lineNumber, { multiParagraph }),
		);
	}

	return { content, endIndex, errors };
}

function parseFootnoteDefinition(lines, startIndex, firstLine) {
	const contentLines = [firstLine];
	let endIndex = startIndex;
	let multiParagraph = false;
	let pendingBlank = false;

	for (let index = startIndex + 1; index < lines.length; index++) {
		const line = lines[index];
		if (line.trim() === "") {
			pendingBlank = true;
			continue;
		}
		const continuation = line.match(/^(?: {2,}|\t)(.*)$/);
		if (!continuation) break;
		if (pendingBlank) {
			contentLines.push("");
			multiParagraph = true;
		}
		contentLines.push(continuation[1]);
		pendingBlank = false;
		endIndex = index;
	}

	return {
		content: contentLines.join("\n").trim(),
		endIndex,
		multiParagraph,
	};
}

function validateInlineContent(content, line, { multiParagraph = false } = {}) {
	const errors = [];
	const add = (kind) =>
		errors.push(issue([line], `旁注包含不支持的${kind}内容`));

	if (!content.trim()) add("空");
	if (multiParagraph) add("多段");
	if (/\$\$|\\\[|\\\]/.test(content)) add("展示数学");
	if (/`/.test(content)) add("代码");
	if (/!\[[^\]]*\](?:\(|\[)|!\[\[/.test(content)) add("图片");
	if (/^\s*\[![^\]]+\]/m.test(content)) add("嵌套 callout");
	if (/^\s*\|.*\|\s*$/m.test(content)) add("表格");
	if (/^\s*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|>\s)/m.test(content))
		add("块级 Markdown");
	if (/<\/?[A-Za-z][^>]*>/.test(content)) add("原始 HTML");
	if (/\[\^[^\]]+\]/.test(content)) add("嵌套脚注");

	return errors;
}

function stripOrdinaryCallouts(text, preservedTypes = new Set()) {
	return text.replace(
		/^> \[!([A-Za-z0-9_-]+)\][ \t]*(.*)$/gm,
		(match, type, title) => {
			if (preservedTypes.has(type.toLowerCase())) return match;
			if (type.toLowerCase() === "marginnote") return match;
			return title.trim() ? `> **${title.trim()}**` : ">";
		},
	);
}

function classifyPreviousBlock(line) {
	const trimmed = line.trim();
	if (!trimmed) return "空白";
	if (/^#{1,6}\s/.test(trimmed)) return "标题";
	if (/^(?:[-+*]\s|\d+[.)]\s)/.test(trimmed)) return "列表";
	if (/^>/.test(trimmed)) return "引用块";
	if (/^\[\^[^\]]+\]:/.test(trimmed)) return "块级内容";
	if (/^(?:`{3,}|~{3,}|\$\$|\|)/.test(trimmed)) return "块级内容";
	if (/^!\[/.test(trimmed)) return "图片";
	return "正文";
}

function findPreviousContentLine(lines, startIndex) {
	for (let index = startIndex; index >= 0; index--) {
		if (lines[index].trim()) return index;
	}
	return -1;
}

function visibleLength(content) {
	const visible = content
		.replace(/!\[\[([^\]]+)\]\]/g, "$1")
		.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, alias) =>
			(alias || target).trim(),
		)
		.replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
		.replace(/[*_$~]/g, "")
		.replace(/\s/g, "");
	return Array.from(visible).length;
}

function normalizeFootnoteId(id) {
	return id.toLowerCase();
}

function formatLines(lines) {
	return lines.join("、");
}

function issue(lines, message) {
	return { line: lines[0] ?? 1, lines, message };
}
