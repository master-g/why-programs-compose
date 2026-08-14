/**
 * Chinese copywriting lint.
 *
 * Auto-fixes (each fix is also surfaced as a report — sync discards the
 * fixed text, so without a report these violations would be invisible):
 *  - CJK ↔ latin/digit spacing (盘古空格)
 *  - half-width prose punctuation → full-width, dropping the following space
 *    (full-width punctuation never takes one). Punctuation immediately after
 *    a closing math `$` is NOT converted: it is usually an English sentence
 *    mark leaked out of a math span (e.g. "$A,$") and must be deleted or
 *    restructured by a human, so it is surfaced as an error instead.
 *
 * Errors (fail validation; not auto-fixed):
 *  - full-width punctuation 。，；：？！、 followed by an ASCII space mid-line
 *  - full-width ，；： immediately before a closing paren
 *  - half-width punctuation after a closing math `$`
 *  - sentence punctuation ,.;: trapped at the end of an inline math span
 *    (e.g. "$\mathbb{Z}:$") — display math is exempt
 *
 * Reports (not auto-fixed):
 *  - straight quotes instead of 「」
 *  - full-width digits
 *  - repeated sentence punctuation (!!,??,。。)
 *  - slop words banned by vault 行文规范 规则 7 (2026-08-01 风格审计)
 */

const CJK_CHAR = "[\\u4e00-\\u9fff\\u3040-\\u309f\\u30a0-\\u30ff]";
const LATIN_DIGIT = "[A-Za-z0-9]";

// 行文规范禁用词(vault 规则 7)。警告级:允许人工豁免,故词表宁宽——
// 这些词在本语料里几乎没有合法用法。「一眼」只匹配「一眼可读」式,
// 不匹配「看一眼」,单独用正则表达。
const SLOP_WORDS = [
	"伏笔",
	"兑现",
	"预告",
	"收割",
	"会师",
	"闭环",
	"判死",
	"门票",
	"没有之一",
	"头号",
	"老朋友",
	"本篇的眼",
	"全部意义",
	"正来自",
	"收口",
	"躺平",
];
const SLOP_PATTERN = /一眼(?=可读|读出|看出|就看|便知|可见)|一望便知/g;

export function lintChineseCopywriting(text) {
	const frontmatter = text.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
	const frontmatterEnd = frontmatter?.[0].length ?? 0;
	const lintableText = frontmatter
		? frontmatter[0].replace(/[^\r\n]/g, " ") + text.slice(frontmatterEnd)
		: text;

	// Blank out math spans and URLs with spaces so that line indices stay valid
	// in the original text while we lint only the prose.
	// 围栏代码块最先遮蔽:代码不是文案(algebrica 原版无此条——原文语料不含代码)。
	const blanked = lintableText
		.replace(/^`{3,}[\s\S]*?^`{3,}[ \t]*$/gm, (m) => m.replace(/[^\r\n]/g, " "))
		// 行内代码同样不是文案(_README 规则 8:代码块与行内代码内除外)。
		// 必须排在围栏之后:围栏已被遮成空格,不会与这条的反引号配对。
		// 不遮会误报 Rust 记号——`&[1, 1, 2]` 里的逗号判成半角标点,
		// `&'a T` 的生命周期单引号判成直引号。
		.replace(/(`+)[^\r\n]*?\1/g, (m) => " ".repeat(m.length))
		.replace(/\$\$[\s\S]*?\$\$/g, (m) => m.replace(/[^\r\n]/g, " "))
		.replace(/\$[^$\n]+\$/g, (m) => " ".repeat(m.length))
		.replace(/https?:\/\/[^\s)]+/g, (m) => " ".repeat(m.length))
		.replace(/\[\/?(?:shortcode|class)(?:=[^\]\r\n]+)?\]/g, (m) =>
			" ".repeat(m.length),
		)
		.replace(/^[ \t]*\[\^[^\]\r\n]+\]:(?=[ \t]+)/gm, (m) =>
			" ".repeat(m.length),
		)
		.replace(/^[ \t]*\[[^\]\r\n]+\]:[ \t]*\S+[ \t]*$/gm, (m) =>
			" ".repeat(m.length),
		)
		.replace(
			/^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/gm,
			(m) => " ".repeat(m.length),
		)
		.replace(/!?\[[^\]]*\]\(([^)]+)\)/g, (m, url) => {
			const idx = m.indexOf("(" + url);
			const before = m.slice(0, idx + 1);
			const after = m.slice(idx + 1 + url.length);
			return before + " ".repeat(url.length) + after;
		});

	const { text: punctuationFixedText, fixes: punctuationFixes } =
		fixHalfWidthPunctuation(text, blanked);
	const fixed = fixSpacing(blanked);
	const reports = [];
	const errors = [];

	// auto-fix 的修复必须报告:sync 丢弃修复后文本(vault 是事实源),
	// 不报告 = 违规对作者不可见(2026-07-28 vectors alt 半角标点就是这么漏的)。
	for (const fix of punctuationFixes) {
		reports.push({
			line: lineOf(text, fix.index),
			message: `半角标点「${fix.from}」应为全角「${fix.value}」`,
		});
	}
	reports.push(...collectSpacingReports(blanked, text));

	let m;

	// Full-width punctuation followed by an ASCII space and more text on the
	// same line. Scanned on the raw text (not the mask): blanked math would
	// fabricate phantom spaces after a sentence-final 。 directly followed by
	// math, e.g. "成立。$n$ 元组" is fine and must not be flagged. A trailing
	// double space at end of line is a Markdown hard break, not an error.
	const fullWidthSpace = /[。，；：？！、][ \t]+(?=\S)/g;
	while ((m = fullWidthSpace.exec(lintableText)) !== null) {
		errors.push({
			line: lineOf(text, m.index),
			message:
				`全角标点 ${m[0]} 后跟半角空格；若该标点是英文句读残留` +
				`（如 $A.$ 移出数学区所致），通常应整体删除`,
		});
	}

	// Full-width comma/semicolon/colon immediately before a closing paren is
	// never valid Chinese (。） can be legitimate for full-sentence asides).
	const punctBeforeParen = /[，；：][）)]/g;
	while ((m = punctBeforeParen.exec(lintableText)) !== null) {
		errors.push({
			line: lineOf(text, m.index),
			message: `全角标点 ${m[0][0]} 不应紧邻右括号`,
		});
	}

	// Half-width punctuation right after a closing math span, e.g. "$A$, $B$"
	// or "$A$. " — English sentence marks that belong outside (or nowhere).
	const halfWidthAfterMath = /\$[,.;:!?](?=[ \t]+\S|\$)/g;
	while ((m = halfWidthAfterMath.exec(lintableText)) !== null) {
		errors.push({
			line: lineOf(text, m.index),
			message: `数学区结束后残留半角标点 ${m[0][1]}；中文语境通常应删除该标点，枚举应改用顿号`,
		});
	}

	// Sentence punctuation trapped at the end of an inline math span, e.g.
	// "$\mathbb{Z}:$" or "$[(a,b)]=0;$" — English sentence marks the translator
	// left inside the math. Display math is exempt (trailing punctuation there
	// is common and usually intentional), and !/? are exempt (factorial "$n!$").
	const displayBlanked = lintableText.replace(/\$\$[\s\S]*?\$\$/g, (s) =>
		" ".repeat(s.length),
	);
	const inlineMath = /\$[^$\n]+\$/g;
	while ((m = inlineMath.exec(displayBlanked)) !== null) {
		const content = m[0].slice(1, -1);
		if (/[,.;:]$/.test(content)) {
			errors.push({
				line: lineOf(text, m.index),
				message:
					`行内数学区以英文句读标点 ${content.slice(-1)} 结尾；` +
					`该标点属于句子而非公式，应移出数学区或删除`,
			});
		}
	}

	// Repeated sentence punctuation (!!,??,。。)。破折号 —— 与省略号 ……
	// 本就是重复字符构成的合法标点,不在集合内。
	const repeatedPunct = /[。,;:!?、]{2,}/g;
	while ((m = repeatedPunct.exec(fixed)) !== null) {
		reports.push({
			line: lineOf(text, m.index),
			message: `标点重复使用:「${m[0]}」`,
		});
	}

	// Straight quotes in Chinese text.
	const straightQuotes = /"([^"]+)"|'([^']+)'/g;
	while ((m = straightQuotes.exec(fixed)) !== null) {
		reports.push({ line: lineOf(text, m.index), message: "建议改用「」引号" });
	}

	// Full-width digits.
	const fullWidthDigits = /[０-９]/g;
	while ((m = fullWidthDigits.exec(fixed)) !== null) {
		reports.push({ line: lineOf(text, m.index), message: `全角数字：${m[0]}` });
	}

	// 行文规范禁用词。扫在 mask 上:代码围栏/数学/URL 已遮蔽,不会误报。
	for (const word of SLOP_WORDS) {
		let idx = -1;
		while ((idx = blanked.indexOf(word, idx + 1)) !== -1) {
			reports.push({
				line: lineOf(text, idx),
				message: `行文规范禁用词:「${word}」(vault 规则 7)`,
			});
		}
	}
	const slopPattern = new RegExp(SLOP_PATTERN.source, "g");
	while ((m = slopPattern.exec(blanked)) !== null) {
		reports.push({
			line: lineOf(text, m.index),
			message: `行文规范禁用词:「${m[0]}」(vault 规则 7)`,
		});
	}

	// Apply spacing fixes only to the body. Frontmatter is machine-readable data
	// and must remain byte-for-byte unchanged.
	const fixedText = frontmatter
		? punctuationFixedText.slice(0, frontmatterEnd) +
			fixSpacing(punctuationFixedText.slice(frontmatterEnd))
		: fixSpacing(punctuationFixedText);
	return { text: fixedText, reports, errors };
}

function fixHalfWidthPunctuation(text, lintMask) {
	const replacements = [];
	// 数字不进 lookbehind 黑名单:散文「走 1,到达」与坐标「(3, 1)」都是数字
	// 开头,靠后面的「逗号后是否 CJK」细分;字母与点仍挡(英文单词/版本号)。
	const punctuation = /(?<![A-Za-z_.])([,.;:!?](?=\s|$|[一-鿿]))/g;
	const fullWidth = {
		",": "，",
		".": "。",
		";": "；",
		":": "：",
		"!": "！",
		"?": "？",
	};
	let match;

	while ((match = punctuation.exec(lintMask)) !== null) {
		// Skip decimals like 3.14 and ellipses ...
		if (
			/\d\.\d/.test(
				lintMask.slice(Math.max(0, match.index - 1), match.index + 3),
			)
		) {
			continue;
		}
		// Skip initials like "A. Carreira".
		if (
			match[0] === "." &&
			/[A-Za-zÁÉÍÓÚáéíóúÄÖÜäöü]/.test(lintMask[match.index - 1] || "") &&
			lintMask[match.index + 1] === " "
		) {
			continue;
		}
		// 逗号/标点前是数字:坐标与枚举((3, 1)、(1, 2, 3)、12:30)跳过——
		// 逗号后是空格/数字/行尾;散文(走 1,到达)逗号后是中文,照转全角。
		if (/\d/.test(lintMask[match.index - 1] || "")) {
			if (!/[一-鿿]/.test(text[match.index + 1] || "")) continue;
		}
		// Skip punctuation right after a closing math span ONLY when it has the
		// English-enumeration signature ("$A$, $B$" / "$A$,$B$"): those are leaked
		// sentence marks, surfaced as errors. "$…$,其中" is Chinese prose missing
		// a full-width comma — convert it.
		if (
			text[match.index - 1] === "$" &&
			/[\s$]/.test(text[match.index + 1] || "")
		)
			continue;
		// Consume horizontal spaces after the mark (a full-width mark never takes
		// a following space), unless they are trailing whitespace ending the line.
		let end = match.index + 1;
		while (end < text.length && (text[end] === " " || text[end] === "\t"))
			end++;
		const next = text[end];
		const deleteCount =
			next === undefined || next === "\n" || next === "\r"
				? 1
				: end - match.index;
		replacements.push({
			index: match.index,
			deleteCount,
			from: match[0],
			value: fullWidth[match[0]],
		});
	}

	let fixed = text;
	for (const replacement of [...replacements].reverse()) {
		fixed =
			fixed.slice(0, replacement.index) +
			replacement.value +
			fixed.slice(replacement.index + replacement.deleteCount);
	}
	return { text: fixed, fixes: replacements };
}

function fixSpacing(text) {
	// CJK followed by latin/digit
	const cjkBefore = new RegExp(`(${CJK_CHAR})(${LATIN_DIGIT})`, "g");
	// latin/digit followed by CJK
	const cjkAfter = new RegExp(`(${LATIN_DIGIT})(${CJK_CHAR})`, "g");
	return text
		.replace(cjkBefore, "$1 $2")
		.replace(cjkAfter, "$1 $2")
		.replace(/([^\s])\n/g, "$1\n") // keep line breaks
		.replace(/\n{3,}/g, "\n\n"); // collapse excessive blank lines
}

// 盘古空格:报告与修复分两趟。报告在 mask 上扫描——mask 与原文等长
// (遮蔽区填空格),index 可直接换算行号;prose 区逐字保留,命中位置与
// 最终文本的修复位置一致。修复由 fixSpacing 在输出文本上独立完成。
function collectSpacingReports(mask, text) {
	const reports = [];
	const adjacent = new RegExp(
		`${CJK_CHAR}${LATIN_DIGIT}|${LATIN_DIGIT}${CJK_CHAR}`,
		"g",
	);
	let m;
	while ((m = adjacent.exec(mask)) !== null) {
		reports.push({
			line: lineOf(text, m.index),
			message: `中文与英文/数字之间缺空格:「${m[0]}」`,
		});
	}
	return reports;
}

function lineOf(text, index) {
	let line = 1;
	for (let i = 0; i < index; i++) {
		if (text[i] === "\n") line++;
	}
	return line;
}
