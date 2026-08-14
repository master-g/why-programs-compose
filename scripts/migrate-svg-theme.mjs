#!/usr/bin/env node
/**
 * SVG 主题迁移命令。
 *
 * 默认只分析。只有显式传入 --apply,且所有文件都属于标准组时才写入。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	analyzeSvgMigration,
	applySvgMigration,
	applySpecializedSvgMigration,
} from "./lib/svg-theme-migration.mjs";

function usage() {
	console.error("用法: node scripts/migrate-svg-theme.mjs [--apply|--apply-specialized] <svg-path|svg-dir> [...]");
}

function expandInput(input) {
	const absolute = resolve(input);
	if (!existsSync(absolute)) return [{ file: input, absolute, source: null }];
	if (statSync(absolute).isFile()) {
		return extname(absolute).toLowerCase() === ".svg"
			? [{ file: input, absolute, source: readFileSync(absolute, "utf8") }]
			: [];
	}
	return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? expandInput(resolve(absolute, entry.name))
			: extname(entry.name).toLowerCase() === ".svg"
				? [{ file: resolve(absolute, entry.name), absolute: resolve(absolute, entry.name), source: readFileSync(resolve(absolute, entry.name), "utf8") }]
				: [],
	);
}

function main() {
	const args = process.argv.slice(2);
	const apply = args.includes("--apply");
	const applySpecialized = args.includes("--apply-specialized");
	const files = args.filter((arg) => !["--apply", "--apply-specialized"].includes(arg));
	if (files.length === 0) {
		usage();
		process.exitCode = 2;
		return;
	}
	const inputs = files.flatMap(expandInput);
	const missing = inputs.filter(({ source }) => source === null);
	if (missing.length > 0) {
		for (const { file } of missing) console.error(`[svg-migrate] 文件不存在: ${file}`);
		process.exitCode = 1;
		return;
	}
	const reports = inputs.map(({ file, source }) => analyzeSvgMigration(source, { asset: file }));
	for (const report of reports) {
		console.log(`[svg-migrate] ${report.asset}: ${report.classification} (${report.paintCount} 个颜色属性)`);
		for (const item of report.reasons) console.log(`  - ${item.code}: ${item.message}`);
	}
	if (!apply && !applySpecialized) return;
	if (apply && !applySpecialized && reports.some((report) => !report.approved)) {
		console.error("[svg-migrate] 存在非标准 SVG,未写入任何文件");
		process.exitCode = 1;
		return;
	}
	const results = inputs.map(({ file, source }) => ({
		file,
		result: applySpecialized
			? applySpecializedSvgMigration(source, { asset: file })
			: applySvgMigration(source, { asset: file }),
	}));
	for (const { file, result } of results) {
		if (!result.changed) {
			console.log(`[svg-migrate] 已跳过: ${file}`);
			continue;
		}
		writeFileSync(resolve(file), result.source);
		console.log(`[svg-migrate] 已应用: ${file}`);
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
