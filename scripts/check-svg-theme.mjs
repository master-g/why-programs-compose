#!/usr/bin/env node
/**
 * SVG 主题契约闸:扫描发布目录中的全部 SVG。
 *
 * 默认扫描 public/assets;构建期可以把 dist/assets 作为参数传入。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	formatSvgThemeIssue,
	validateSvgTheme,
} from "./lib/svg-theme-contract.mjs";

function walk(root) {
	const files = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const path = resolve(root, entry.name);
		if (entry.isDirectory()) files.push(...walk(path));
		else if (entry.isFile() && extname(entry.name).toLowerCase() === ".svg") files.push(path);
	}
	return files;
}

export function checkSvgThemeTree(root = "public/assets") {
	const absoluteRoot = resolve(root);
	if (!existsSync(absoluteRoot)) {
		return {
			errors: [{ code: "MISSING_ASSET_ROOT", message: `SVG 目录不存在: ${absoluteRoot}` }],
			checked: 0,
		};
	}
	const errors = [];
	let checked = 0;
	const files = statSync(absoluteRoot).isFile() ? [absoluteRoot] : walk(absoluteRoot);
	for (const file of files) {
		checked += 1;
		const result = validateSvgTheme(readFileSync(file, "utf8"), {
			asset: relative(absoluteRoot, file),
		});
		errors.push(...result.errors);
	}
	return { errors, checked };
}

function main() {
	const result = checkSvgThemeTree(process.argv[2] || "public/assets");
	if (result.errors.length > 0) {
		for (const issue of result.errors) console.error(`[svg-theme] ${formatSvgThemeIssue(issue)}`);
		console.error(`[svg-theme] ${result.errors.length} 个错误,已检查 ${result.checked} 张 SVG`);
		process.exitCode = 1;
		return;
	}
	console.log(`[svg-theme] ${result.checked} 张 SVG 全部通过主题契约`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
