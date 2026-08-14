#!/usr/bin/env node
/**
 * 构建产物插图闸:扫 dist 下全部 html,插图引用必须可解析。
 *
 * 三类失败:
 *   1. `<img src="<base>/assets/...">` 指向的文件在 dist 下不存在(同步漏拷 → 线上 404)
 *   2. `<img src="svg/...">` 漏网相对路径(rewrite 插件未改写,浏览器会按页面路径解析 → 404)
 *   3. `<img src="/assets/...">` 未加部署 base 前缀(prefix 插件未覆盖 → 线上 404)
 *
 * 挂在 npm postbuild 生命周期上,与 check-mjx-errors 串联。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, resolve, join } from "node:path";
import { BASE } from "../src/lib/base.mjs";

function* walkHtml(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = resolve(dir, entry.name);
		if (entry.isDirectory()) yield* walkHtml(p);
		else if (entry.isFile() && extname(entry.name) === ".html") yield p;
	}
}

const dir = resolve(process.argv[2] || "dist");
if (!existsSync(dir)) {
	console.error(`[check-svg] 目录不存在: ${dir}`);
	process.exit(1);
}

// dist 根对应部署 base 路径,浏览器里的 <base>/assets/x.svg 落盘为 dist/assets/x.svg。
// BASE 为空(根域部署)时,线上路径与落盘路径一致,裸 /assets/ 合法。
const assetRe = /<img[^>]+src="((?:\/[^"\s]+)?\/assets\/[^"]+)"/g;
const relativeRe = /<img[^>]+src="(svg\/[^"]+)"/g;
const checked = new Set();
let failed = false;

for (const file of walkHtml(dir)) {
	const html = readFileSync(file, "utf8");
	let m;
	while ((m = assetRe.exec(html)) !== null) {
		const src = m[1];
		if (BASE && !src.startsWith(`${BASE}/`)) {
			console.error(`[check-svg] 未加部署前缀: ${src}(在 ${file})`);
			failed = true;
			continue;
		}
		const onDisk = BASE ? src.slice(BASE.length) : src;
		if (checked.has(onDisk)) continue;
		checked.add(onDisk);
		if (!existsSync(join(dir, onDisk))) {
			console.error(`[check-svg] 404: ${src}(引用于 ${file})`);
			failed = true;
		}
	}
	while ((m = relativeRe.exec(html)) !== null) {
		console.error(`[check-svg] 未改写的相对路径: ${m[1]}(在 ${file})`);
		failed = true;
	}
}

if (failed) process.exit(1);
console.log(`[check-svg] ${checked.size} 个插图引用全部可解析`);
