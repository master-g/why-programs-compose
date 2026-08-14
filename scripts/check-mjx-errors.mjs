#!/usr/bin/env node
/**
 * 构建产物数学渲染闸:扫 dist 下全部 html,两项检查任一失败即退出。
 *
 * 一、出现 mjx-error 即失败。MathJax 渲染失败的公式在页面上显示为红色
 *     错误标记,静默漏出即事故。
 * 二、`<use>` 指向的字形 id 必须在同一页里存在。rehype-dedupe-math-glyphs
 *     把重复字形归并成一份并改写引用,改写漏掉一个,对应字形就整个消失——
 *     页面不报错,公式少一块,只有肉眼能看出来。
 *
 * 挂在 npm postbuild 生命周期上,`npm run build` 后自动执行。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function* walkHtml(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(p);
    else if (entry.isFile() && extname(entry.name) === '.html') yield p;
  }
}

/** 收集页面里的字形 id 与引用,返回引用不到的那些。 */
export function danglingGlyphRefs(html) {
  const ids = new Set();
  for (const [, id] of html.matchAll(/<path id="([^"]+)"/g)) ids.add(id);
  const refs = new Set();
  for (const [, ref] of html.matchAll(/(?:xlink:)?href="#([^"]+)"/g)) {
    // 只管字形引用;正文锚点与旁注回链不走 <path id>。
    if (ref.startsWith('MJX')) refs.add(ref);
  }
  return [...refs].filter((ref) => !ids.has(ref));
}

// 单测要 import danglingGlyphRefs,扫盘只在直接执行本文件时发生。
function main() {
  const dir = resolve(process.argv[2] || 'dist');
  if (!existsSync(dir)) {
    console.error(`[check-mjx] 目录不存在: ${dir}`);
    process.exit(1);
  }

  let failed = false;
  let refCount = 0;
  for (const file of walkHtml(dir)) {
    const html = readFileSync(file, 'utf8');
    const count = (html.match(/mjx-error/g) || []).length;
    if (count) {
      console.error(`[check-mjx] ${file}: ${count} 处 mjx-error`);
      failed = true;
    }
    const dangling = danglingGlyphRefs(html);
    refCount += (html.match(/<use /g) || []).length;
    if (dangling.length) {
      console.error(
        `[check-mjx] ${file}: ${dangling.length} 个字形引用无对应 <path>,例如 ${dangling.slice(0, 3).join(', ')}`,
      );
      failed = true;
    }
  }
  if (failed) process.exit(1);
  console.log(`[check-mjx] dist 无 mjx-error;${refCount} 个字形引用全部可解析`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
