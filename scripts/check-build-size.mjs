#!/usr/bin/env node
/**
 * 构建体积闸:守住两项已落地措施不被悄悄推翻。
 *
 * 一、`deferRender`(src/content.config.ts):渲染产物不进内容存储。失效时
 *     data-store.json 由 55 KB/词条 跳回 280 KB/词条,上游 why-models-learn
 *     在 274 篇规模上因此把 JSON.stringify 撑到 OOM,dev 直接崩。
 * 二、字形去重(src/plugins/rehype-dedupe-math-glyphs.mjs):相同字形只留一份。
 *     失效时单页 <path> 由 48 跳回 349(实测 sets-and-functions)。
 *
 * 阈值口径:两项失效都是 3 倍以上的跳变,阈值取当前值的数倍。**阈值只用来
 * 抓事故,不用来管日常增长**;写词条撞线说明阈值该重估,不说明词条写错了。
 *
 * 与上游的两处差异,都因为本库现有 6 篇、大纲目标 66 篇,规模会涨十倍:
 * 内容存储改为按词条数折算(绝对值阈值在 6 篇时无论怎么取都抓不到失效),
 * 不含 dist 总体积(它随词条数线性涨,只会制造假警报;单页上限已覆盖)。
 *
 * 也不含冷构建时长:本机与 CI 的绝对时长不可比,热构建与冷构建又差数倍。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 当前值:单页最大 296 KB、单页字形最多 89 个、内容存储 55 KB/词条。 */
export const LIMITS = {
  maxPageKb: 800,
  maxGlyphPathsPerPage: 250,
  contentStoreKbPerEntry: 120,
};

function walkHtml(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkHtml(path));
    else if (entry.isFile() && extname(entry.name) === '.html') files.push(path);
  }
  return files;
}

/** 已同步进 content-zh 的词条数;内容存储的体积按它折算。 */
function countEntries(contentDir) {
  if (!existsSync(contentDir)) return 0;
  let count = 0;
  for (const section of readdirSync(contentDir, { withFileTypes: true })) {
    if (!section.isDirectory()) continue;
    count += readdirSync(join(contentDir, section.name)).filter((name) => extname(name) === '.md').length;
  }
  return count;
}

export function checkBuildSize({
  distDir = 'dist',
  storePath = 'node_modules/.astro/data-store.json',
  contentDir = 'content-zh',
  limits = LIMITS,
} = {}) {
  const errors = [];
  if (!existsSync(distDir)) return { errors: [`目录不存在: ${distDir}`] };

  let totalBytes = 0;
  let largest = { bytes: 0, path: '' };
  let mostGlyphs = { count: 0, path: '' };

  for (const file of walkHtml(distDir)) {
    const html = readFileSync(file, 'utf8');
    const bytes = Buffer.byteLength(html);
    totalBytes += bytes;
    if (bytes > largest.bytes) largest = { bytes, path: file };
    const glyphs = (html.match(/<path id="/g) || []).length;
    if (glyphs > mostGlyphs.count) mostGlyphs = { count: glyphs, path: file };
  }

  const totalMb = totalBytes / 1048576;

  const largestKb = largest.bytes / 1024;
  if (largestKb > limits.maxPageKb) {
    errors.push(
      `单页最大 ${largestKb.toFixed(0)} KB 超过上限 ${limits.maxPageKb} KB: ${largest.path}`,
    );
  }

  if (mostGlyphs.count > limits.maxGlyphPathsPerPage) {
    errors.push(
      `单页字形 ${mostGlyphs.count} 个超过上限 ${limits.maxGlyphPathsPerPage} 个: ${mostGlyphs.path}` +
        ';字形去重可能已失效(rehype-dedupe-math-glyphs)',
    );
  }

  // 内容存储在 npm install 后、首次构建前不存在,缺席不算失败。
  const entries = countEntries(contentDir);
  let storeKbPerEntry = null;
  if (existsSync(storePath) && entries > 0) {
    storeKbPerEntry = statSync(storePath).size / 1024 / entries;
    if (storeKbPerEntry > limits.contentStoreKbPerEntry) {
      errors.push(
        `内容存储 ${storeKbPerEntry.toFixed(0)} KB/词条 超过上限 ${limits.contentStoreKbPerEntry} KB/词条` +
          ';deferRender 可能已失效(src/content.config.ts)',
      );
    }
  }

  return {
    errors,
    totalMb,
    largestKb,
    largestPath: largest.path,
    maxGlyphs: mostGlyphs.count,
    entries,
    storeKbPerEntry,
  };
}

function main() {
  const result = checkBuildSize({ distDir: process.argv[2] || 'dist' });
  if (result.errors.length > 0) throw new Error(result.errors.join('\n'));
  const store =
    result.storeKbPerEntry === null ? '未生成' : `${result.storeKbPerEntry.toFixed(0)} KB/词条`;
  console.log(
    `[check-size] dist ${result.totalMb.toFixed(1)} MB;` +
      `单页最大 ${result.largestKb.toFixed(0)} KB;` +
      `单页字形最多 ${result.maxGlyphs} 个;内容存储 ${store}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
