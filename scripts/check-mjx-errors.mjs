#!/usr/bin/env node
/**
 * 构建产物数学渲染闸:扫 dist 下全部 html,出现 mjx-error 即失败。
 *
 * MathJax 渲染失败的公式在页面上显示为红色错误标记,静默漏出即事故。
 * 挂在 npm postbuild 生命周期上,`npm run build` 后自动执行。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

function* walkHtml(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(p);
    else if (entry.isFile() && extname(entry.name) === '.html') yield p;
  }
}

const dir = resolve(process.argv[2] || 'dist');
if (!existsSync(dir)) {
  console.error(`[check-mjx] 目录不存在: ${dir}`);
  process.exit(1);
}

let failed = false;
for (const file of walkHtml(dir)) {
  const count = (readFileSync(file, 'utf8').match(/mjx-error/g) || []).length;
  if (count) {
    console.error(`[check-mjx] ${file}: ${count} 处 mjx-error`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('[check-mjx] dist 无 mjx-error');
