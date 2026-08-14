import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { prepareSidenoteSource } from "../../scripts/lib/sidenote-source.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("prepareSidenoteSource", () => {
	it("保持普通 callout 的既有降级输出", () => {
		const input = [
			"> [!tldr] 摘要",
			"> 保留正文。",
			"",
			"> [!note]",
			"> 无标题正文。",
		].join("\n");

		const result = prepareSidenoteSource(input);

		assert.equal(
			result.text,
			["> **摘要**", "> 保留正文。", "", ">", "> 无标题正文。"].join(
				"\n",
			),
		);
		assert.deepEqual(result.errors, []);
		assert.deepEqual(result.warnings, []);
	});

	it("接受唯一编号脚注并保留允许的行内 Markdown", () => {
		const input = [
			"欧几里得范数来自内积。[^inner]",
			"",
			"[^inner]: 这条构造得到 *2-范数*；参见 [[inner-products|内积]] 与 $p=2$。",
		].join("\n");

		const result = prepareSidenoteSource(input);

		assert.equal(result.text, input);
		assert.deepEqual(result.errors, []);
		assert.deepEqual(result.warnings, []);
	});

	it("接受紧邻正文段落且带标签的 marginnote", () => {
		const input = [
			"范数下标指定距离规则。",
			"",
			"> [!marginnote] 符号提醒",
			"> 范数下标表示所用的*尺子*，参见 [[norms]] 与 $p$。",
		].join("\n");

		const result = prepareSidenoteSource(input);

		assert.equal(result.text, input);
		assert.deepEqual(result.errors, []);
		assert.deepEqual(result.warnings, []);
	});

	it("拒绝无效的脚注引用与定义关系并报告相关行", () => {
		const cases = [
			{
				name: "重复引用",
				input: "第一处。[^same]\n第二处。[^same]\n\n[^same]: 内容。",
				lines: [1, 2],
			},
			{
				name: "缺失定义",
				input: "正文。[^missing]",
				lines: [1],
			},
			{
				name: "重复定义",
				input: "正文。[^same]\n\n[^same]: 第一条。\n[^same]: 第二条。",
				lines: [3, 4],
			},
			{
				name: "孤立定义",
				input: "正文。\n\n[^orphan]: 内容。",
				lines: [3],
			},
			{
				name: "重复引用",
				input: "第一处。[^Case]\n第二处。[^case]\n\n[^case]: 内容。",
				lines: [1, 2],
			},
		];

		for (const scenario of cases) {
			const result = prepareSidenoteSource(scenario.input);
			assert.ok(
				result.errors.some(
					(issue) =>
						issue.message.includes(scenario.name) &&
						scenario.lines.every((line) => issue.lines.includes(line)),
				),
				`${scenario.name} 应报告所有相关行`,
			);
		}
	});

	it("拒绝旁注中的块级或代码内容", () => {
		const cases = [
			["展示数学", "正文。[^x]\n\n[^x]: $$x^2$$"],
			[
				"表格",
				"正文。\n\n> [!marginnote] 数据\n> | a | b |\n> | --- | --- |",
			],
			["代码", "正文。[^x]\n\n[^x]: 使用 `npm test`。"],
			["图片", "正文。[^x]\n\n[^x]: ![示意图](svg/example.svg)"],
			[
				"嵌套 callout",
				"正文。\n\n> [!marginnote] 提醒\n> [!warning] 不能嵌套",
			],
			[
				"多段内容",
				"正文。\n\n> [!marginnote] 提醒\n> 第一段。\n>\n> 第二段。",
			],
		];

		for (const [kind, input] of cases) {
			const result = prepareSidenoteSource(input);
			assert.ok(
				result.errors.some((issue) => issue.message.includes(kind)),
				`${kind} 应被拒绝`,
			);
		}
	});

	it("拒绝无标签或不紧邻正文段落的 marginnote", () => {
		const cases = [
			["缺少标签", "正文。\n\n> [!marginnote]\n> 内容。"],
			["标题", "## 小节\n\n> [!marginnote] 提醒\n> 内容。"],
			["列表", "- 列表项\n\n> [!marginnote] 提醒\n> 内容。"],
			[
				"块级内容",
				"正文。[^note]\n\n[^note]: 脚注内容。\n\n> [!marginnote] 提醒\n> 内容。",
			],
		];

		for (const [kind, input] of cases) {
			const result = prepareSidenoteSource(input);
			assert.ok(
				result.errors.some((issue) => issue.message.includes(kind)),
				`${kind} 场景应失败`,
			);
		}
	});

	it("旁注超过数量或长度建议值时只产生警告", () => {
		const references = Array.from(
			{ length: 7 },
			(_, index) => `正文 ${index + 1}。[^note-${index + 1}]`,
		);
		const definitions = Array.from(
			{ length: 7 },
			(_, index) => `[^note-${index + 1}]: 短旁注 ${index + 1}。`,
		);
		const dense = prepareSidenoteSource(
			[...references, "", ...definitions].join("\n"),
		);
		const long = prepareSidenoteSource(
			`正文。[^long]\n\n[^long]: ${"长".repeat(121)}`,
		);

		assert.deepEqual(dense.errors, []);
		assert.ok(
			dense.warnings.some((issue) => issue.message.includes("超过 6 条")),
		);
		assert.deepEqual(long.errors, []);
		assert.ok(
			long.warnings.some((issue) => issue.message.includes("超过 120")),
		);
	});

	it("同步在旁注错误时不更新任何生成产物", () => {
		const root = mkdtempSync(join(tmpdir(), "wml-sidenote-sync-"));
		const vault = join(root, "vault");
		const generated = join(root, "content-zh", "sample", "sample.md");
		mkdirSync(vault, { recursive: true });
		mkdirSync(dirname(generated), { recursive: true });
		writeFileSync(
			join(root, "sections.yaml"),
			[
				"parts: []",
				"sections:",
				"  - dir: sample",
				"    entries: [sample]",
			].join("\n"),
		);
		writeFileSync(
			join(vault, "sample.md"),
			[
				"---",
				"title: 测试词条",
				"status: complete",
				"---",
				"正文第一处。[^same]",
				"正文第二处。[^same]",
				"",
				"[^same]: 旁注内容。",
			].join("\n"),
		);
		writeFileSync(generated, "sentinel\n");

		const result = spawnSync(
			process.execPath,
			[join(ROOT, "scripts/sync-from-vault.mjs")],
			{
				cwd: root,
				encoding: "utf8",
				env: {
					...process.env,
					WHY_PROGRAMS_COMPOSE_VAULT_DIR: vault,
				},
			},
		);

		assert.equal(result.status, 1);
		assert.match(result.stderr, /脚注「same」重复引用/);
		assert.equal(readFileSync(generated, "utf8"), "sentinel\n");
		assert.equal(readFileSync(join(vault, "sample.md"), "utf8").includes("正文"), true);
	});
});
