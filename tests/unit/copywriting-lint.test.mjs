import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lintChineseCopywriting } from "../../scripts/lib/copywriting-lint.mjs";

describe("lintChineseCopywriting", () => {
	it("auto-fixes CJK↔latin spacing and reports it", () => {
		const { text, reports } = lintChineseCopywriting("中文ABC中文");
		assert.equal(text, "中文 ABC 中文");
		const spacing = reports.filter((r) => /缺空格/.test(r.message));
		assert.equal(spacing.length, 2); // 文A 与 C中 两处
	});

	it("auto-fixes CJK↔digit spacing and reports it", () => {
		const { text, reports } = lintChineseCopywriting("中文123");
		assert.equal(text, "中文 123");
		assert.ok(reports.some((r) => /缺空格/.test(r.message)));
	});

	it("auto-fixes half-width punctuation in Chinese prose, drops the trailing space, and reports it", () => {
		const input = "你好, 世界";
		const { text, reports, errors } = lintChineseCopywriting(input);
		assert.equal(text, "你好，世界");
		assert.ok(reports.some((r) => /半角标点/.test(r.message)));
		assert.equal(errors.length, 0);
	});

	it("errors on full-width punctuation followed by an ASCII space mid-line", () => {
		const input = "记号 $x \\notin A$ 表示 $x$ 不是 $A$。 的元素。";
		const { text, errors } = lintChineseCopywriting(input);
		assert.equal(text, input);
		assert.equal(errors.length, 1);
		assert.ok(errors[0].message.includes("全角标点"));
	});

	it("does not flag a Markdown hard break after full-width punctuation", () => {
		const input = "按如下方式计算：  \n\n$$\nx\n$$";
		const { errors } = lintChineseCopywriting(input);
		assert.equal(errors.length, 0);
	});

	it("does not flag sentence-final punctuation directly followed by math", () => {
		const input = "恒等式成立。$n$ 元组的情形同理。";
		const { errors } = lintChineseCopywriting(input);
		assert.equal(errors.length, 0);
	});

	it("errors on full-width comma before a closing paren", () => {
		const input = "对于每对整数 $a$ 和 $b$（$b \\neq 0$，），存在唯一的商。";
		const { errors } = lintChineseCopywriting(input);
		assert.equal(errors.length, 1);
		assert.ok(errors[0].message.includes("右括号"));
	});

	it("errors on half-width punctuation after a closing math span and leaves it unconverted", () => {
		const input = "用大写字母 $A$, $B$, $C$, 表示。";
		const { text, errors } = lintChineseCopywriting(input);
		assert.equal(text, input);
		assert.equal(errors.length, 3);
		assert.ok(errors[0].message.includes("半角标点"));
	});

	it("errors on sentence punctuation trapped at the end of an inline math span", () => {
		const input = "仅用到 $\\mathbb{N}:$ 上的加法，以及 $[(a,b)]=0;$；";
		const { text, errors } = lintChineseCopywriting(input);
		assert.equal(text, input);
		assert.equal(errors.length, 2);
		assert.ok(errors[0].message.includes("数学区以英文句读标点"));
	});

	it("exempts display math, factorials, and mid-math punctuation", () => {
		const input =
			"集合 $\\{1, 2\\}$ 与阶乘 $n!$：\n\n$$\nA = B \\iff C,\n$$\n\n区间 $[0,1]$ 同理。";
		const { errors } = lintChineseCopywriting(input);
		assert.equal(errors.length, 0);
	});

	it("reports straight quotes in Chinese text", () => {
		const input = '他说"你好"。';
		const { text, reports } = lintChineseCopywriting(input);
		assert.equal(text, input);
		assert.ok(reports.some((r) => /建议改用/.test(r.message)));
	});

	it("reports full-width digits", () => {
		const { text, reports } = lintChineseCopywriting("数字１２３");
		assert.equal(text, "数字１２３");
		assert.ok(reports.some((r) => /全角数字/.test(r.message)));
	});

	it("does not mangle inline math, display math, URLs, or markdown links", () => {
		const input =
			"令 $a<b$ 且 $$\\sum_{i=1}^{n} i$$，访问 https://example.com/foo 或 [链接](https://example.com/bar)。";
		const { text, reports, errors } = lintChineseCopywriting(input);
		assert.equal(text, input);
		assert.ok(
			!reports.some((r) => /半角标点|建议改用|全角数字/.test(r.message)),
		);
		assert.equal(errors.length, 0);
	});

	it("treats escaped dollar signs as text, not math", () => {
		const input = "\\$1,500，另一半高于 \\$1,500";
		const { text, reports } = lintChineseCopywriting(input);
		assert.equal(text, "\\$1,500，另一半高于 \\$1,500");
		assert.ok(!reports.some((r) => /半角标点/.test(r.message)));
	});

	it("does not treat LaTeX prime as a straight quote", () => {
		const input = "导数 $f'(x)$ 存在。";
		const { text, reports } = lintChineseCopywriting(input);
		assert.equal(text, "导数 $f'(x)$ 存在。");
		assert.ok(!reports.some((r) => /建议改用/.test(r.message)));
	});

	it("ignores quoted attributes in shortcode tags", () => {
		const input =
			'区间如下：\n\n[shortcode="intervals"]\n| $a$ | $b$ |\n[/shortcode]';
		const { text, reports } = lintChineseCopywriting(input);
		assert.equal(text, input);
		assert.ok(!reports.some((r) => /建议改用/.test(r.message)));
	});

	it("ignores quoted attributes in class wrapper tags", () => {
		const input =
			'[class="table-1 -right"]\n\n| 恒等式 | 结果 |\n|---|---|\n\n[/class]';
		const { text, reports } = lintChineseCopywriting(input);
		assert.equal(text, input);
		assert.ok(!reports.some((r) => /建议改用/.test(r.message)));
	});

	it("ignores alignment colons in Markdown table delimiter rows", () => {
		const input = "| 数值 | 说明 |\n| :--: | :------ |\n| 1 | 示例 |";
		const { text, reports } = lintChineseCopywriting(input);
		assert.equal(text, input);
		assert.ok(!reports.some((r) => /半角标点/.test(r.message)));
	});

	it("ignores the structural colon in Markdown reference definitions", () => {
		const input =
			"![图 3][示意图]\n\n[示意图]: /assets/trigonometry/svg/example.zh.svg";
		const { text, reports } = lintChineseCopywriting(input);
		assert.equal(text, input);
		assert.ok(!reports.some((r) => /半角标点/.test(r.message)));
	});

	it("ignores the structural colon in Markdown footnote definitions", () => {
		const input =
			"正文。[^note]\n\n[^note]: 旁注正文仍然接受中文文案检查。";
		const { text, reports } = lintChineseCopywriting(input);
		assert.equal(text, input);
		assert.ok(!reports.some((r) => /半角标点/.test(r.message)));
	});

	it("preserves YAML frontmatter and ignores quoted metadata values", () => {
		const input = [
			"---",
			"title: 中文ABC",
			"translation:",
			'  updated: "2026-07-23T08:19:04.773Z"',
			"---",
			"正文ABC。",
		].join("\n");
		const { text, reports } = lintChineseCopywriting(input);
		assert.equal(
			text,
			[
				"---",
				"title: 中文ABC",
				"translation:",
				'  updated: "2026-07-23T08:19:04.773Z"',
				"---",
				"正文 ABC。",
			].join("\n"),
		);
		assert.ok(!reports.some((r) => /建议改用/.test(r.message)));
	});

	it("skips fenced code blocks and preserves line numbers after them", () => {
		const input = [
			"正文。",
			"```python",
			'print("a + b =", a + b)',
			"```",
			'这是 "引号" 行。',
		].join("\n");
		const { reports } = lintChineseCopywriting(input);
		const quoteReports = reports.filter((r) => /建议改用/.test(r.message));
		assert.equal(quoteReports.length, 1);
		assert.equal(quoteReports[0].line, 5);
	});

	it("reports repeated sentence punctuation but not dashes or ellipses", () => {
		const { reports } = lintChineseCopywriting(
			"太强了!!真的??破折号——与省略号……合法。",
		);
		const repeated = reports.filter((r) => /标点重复/.test(r.message));
		assert.equal(repeated.length, 2);
	});

	it("reports spacing violations with their line numbers", () => {
		const input = "第一行干净。\n第二行A缺空格。";
		const { reports } = lintChineseCopywriting(input);
		const spacing = reports.filter((r) => /缺空格/.test(r.message));

		assert.equal(spacing.length, 1);
		assert.equal(spacing[0].line, 2);
	});

	it("converts a half-width comma between math and Chinese prose ($…$,其中)", () => {
		const input = "取 $x_n$,其中每个分量是实数。";
		const { text, reports, errors } = lintChineseCopywriting(input);
		assert.equal(text, "取 $x_n$，其中每个分量是实数。");
		assert.ok(reports.some((r) => /半角标点/.test(r.message)));
		assert.equal(errors.length, 0);
	});

	it("still errors on English enumeration after math ($A$, $B$)", () => {
		const { errors } = lintChineseCopywriting("用大写字母 $A$, $B$ 表示。");
		assert.equal(errors.length, 1);
	});

	it("converts a comma after a prose digit (走 1,到达) but leaves coordinates alone", () => {
		const prose = lintChineseCopywriting("向上走 1,到达终点");
		assert.equal(prose.text, "向上走 1，到达终点");
		const coord = lintChineseCopywriting("坐标 (3, 1) 与枚举 (1, 2, 3) 不动");
		assert.equal(coord.text, "坐标 (3, 1) 与枚举 (1, 2, 3) 不动");
		assert.ok(!coord.reports.some((r) => /半角标点/.test(r.message)));
	});

	it("reports slop words banned by vault 规则 7 with their line numbers", () => {
		const input = "第一行干净。\n第二篇埋下伏笔,本篇兑现。";
		const { reports } = lintChineseCopywriting(input);
		const slop = reports.filter((r) => /禁用词/.test(r.message));
		assert.equal(slop.length, 2);
		assert.equal(slop[0].line, 2);
		assert.ok(slop[0].message.includes("伏笔"));
		assert.ok(slop[1].message.includes("兑现"));
	});

	it("does not flag slop words inside code fences or math", () => {
		const input = "```\n// 伏笔\n```\n$\\text{伏笔}$ 是干净的。";
		const { reports } = lintChineseCopywriting(input);
		assert.ok(!reports.some((r) => /禁用词/.test(r.message)));
	});

	it("flags 「一眼读出」 but leaves 「看一眼」 alone", () => {
		const slop = lintChineseCopywriting("三种情形一眼读出。");
		assert.ok(slop.reports.some((r) => /禁用词/.test(r.message)));
				const slop2 = lintChineseCopywriting("消元一眼可见。");
		assert.ok(slop2.reports.some((r) => /禁用词/.test(r.message)));
const fine = lintChineseCopywriting("看一眼就完事。");
		assert.ok(!fine.reports.some((r) => /禁用词/.test(r.message)));
	});
});
