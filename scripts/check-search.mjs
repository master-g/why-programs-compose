#!/usr/bin/env node
/**
 * AE4 smoke test for the search index.
 * Mirrors the client scoring logic from src/lib/search-score.mjs.
 */
import { readFileSync } from "node:fs";
import { scoreEntry } from "../src/lib/search-score.mjs";
import { BASE } from "../src/lib/base.mjs";

const PATH = process.argv[2] || "./dist/search.json";

function rank(entries, query) {
	const q = query.trim();
	if (!q) return [];
	return entries
		.map((entry) => ({ entry, score: scoreEntry(entry, q) }))
		.filter((item) => item.score > 0)
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			const aLen = String(a.entry.title_en).length;
			const bLen = String(b.entry.title_en).length;
			if (aLen !== bLen) return aLen - bLen;
			return String(a.entry.title_en).localeCompare(String(b.entry.title_en));
		})
		.map((item) => item.entry);
}

function findRank(entries, query, predicate) {
	const results = rank(entries, query);
	const idx = results.findIndex(predicate);
	return { results, idx: idx + 1 };
}

const raw = readFileSync(PATH, "utf8");
let entries;
try {
	entries = JSON.parse(raw);
} catch (err) {
	console.error(`[check-search] search.json 解析失败: ${err.message}`);
	process.exit(1);
}

// search.json 的 url 带部署 base 前缀(客户端直接拿去跳转);
// 本检查的断言写站内裸路径,比较前统一剥掉前缀。
for (const entry of entries) {
	if (
		BASE &&
		typeof entry.url === "string" &&
		entry.url.startsWith(`${BASE}/`)
	) {
		entry.url = entry.url.slice(BASE.length);
	}
}

console.log(`Loaded ${entries.length} entries from ${PATH}`);
console.log(`Payload size: ${Buffer.byteLength(raw, "utf8")} bytes`);

// ponytail: 词条还没写齐时本检查会 FAIL,属于预期的 TODO 信号。
const cases = [
	{
		query: "注意力",
		predicate: (e) => e.url === "/self-attention/",
		label: '"注意力" ranks /self-attention/ in top 5',
	},
	{
		query: "attention",
		predicate: (e) => e.url === "/self-attention/",
		label: '"attention" ranks /self-attention/ in top 5',
	},
	{
		query: "反向传播",
		predicate: (e) => e.url === "/backpropagation/",
		label: '"反向传播" ranks /backpropagation/ in top 5',
	},
];

let failed = false;
for (const { query, predicate, label } of cases) {
	const { results, idx } = findRank(entries, query, predicate);
	const pass = idx > 0 && idx <= 5;
	const top = results
		.slice(0, 5)
		.map((e) => `${e.title_zh || e.title_en} (${e.url})`);
	console.log(
		`\n${label}: ${pass ? "PASS" : "FAIL"} (rank=${idx > 0 ? idx : "not found"})`,
	);
	console.log(`  top 5 for "${query}":`);
	top.forEach((t, i) => console.log(`    ${i + 1}. ${t}`));
	if (!pass) failed = true;
}

if (failed) {
	process.exit(1);
}
console.log("\nAll AE4 checks passed.");
