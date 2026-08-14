#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE } from '../src/lib/base.mjs';
import { SITE } from '../src/lib/site.config.mjs';

const FORBIDDEN_RUNTIME = [
  { label: 'googletagmanager.com', pattern: /googletagmanager\.com/i },
  { label: 'google-analytics.com', pattern: /google-analytics\.com/i },
  { label: 'fonts.googleapis.com', pattern: /fonts\.googleapis\.com/i },
  { label: 'fonts.gstatic.com', pattern: /fonts\.gstatic\.com/i },
  { label: 'wp-content/themes', pattern: /wp-content\/themes/i },
  { label: '/theme/', pattern: /\/theme\//i },
];

/**
 * 页面产物契约。
 *
 * 这里查的是渲染**结果**,与 visual-contracts 查源码互补。上游 why-models-learn
 * 的实例:品牌后缀统一收进 BaseLayout 后,[slug].astro 的 pageTitle 仍自带一份,
 * 词条页 title 出现两次品牌名;当时全部单元测试与门禁通过,只有逐字节比对 dist
 * 才发现。源码断言看不见这类拼接结果。
 */
export function pageContractProblems(html, brand = SITE.brandZh) {
  // 只约束完整文档。片段 HTML(测试 fixture、将来可能出现的局部产物)没有
  // <html> 外壳,对它们要求 title 与 h1 是错的;Astro 的页面产物一律有外壳。
  if (!/<html[\s>]/i.test(html)) return [];

  const problems = [];

  const titles = html.match(/<title[^>]*>([\s\S]*?)<\/title>/g) || [];
  if (titles.length !== 1) {
    problems.push(`应有且仅有一个 <title>,实际 ${titles.length} 个`);
  } else {
    const text = titles[0].replace(/<\/?title[^>]*>/g, '').trim();
    if (!text) problems.push('<title> 为空');
    const brandCount = text.split(brand).length - 1;
    if (brandCount === 0) problems.push(`<title> 缺少品牌名: ${text}`);
    if (brandCount > 1) problems.push(`<title> 品牌名重复 ${brandCount} 次: ${text}`);
  }

  const h1 = html.match(/<h1[\s>]/g) || [];
  if (h1.length !== 1) problems.push(`应有且仅有一个 <h1>,实际 ${h1.length} 个`);

  return problems;
}

function normalizeSiteBase(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`;
}

function walk(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function referencesFromHtml(text) {
  return [...text.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map((match) => match[1]);
}

function referencesFromCss(text) {
  return [...text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((match) => match[1]);
}

function isExternal(value) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|#|data:)/i.test(value);
}

function stripQueryAndHash(value) {
  const stripped = value.split('#')[0].split('?')[0];
  try {
    return decodeURIComponent(stripped);
  } catch {
    return stripped;
  }
}

function resolveInternalReference({ value, fromFile, distDir, siteBase }) {
  const cleaned = stripQueryAndHash(value);
  if (!cleaned || isExternal(cleaned)) return null;

  let target;
  if (cleaned.startsWith('/')) {
    const base = normalizeSiteBase(siteBase);
    if (base !== '/' && cleaned !== base.slice(0, -1) && !cleaned.startsWith(base)) {
      return { error: `root-relative reference is missing site base ${base}: ${cleaned}` };
    }
    const withoutBase = base === '/'
      ? cleaned.slice(1)
      : cleaned === base.slice(0, -1) ? '' : cleaned.slice(base.length);
    target = resolve(distDir, withoutBase);
  } else {
    target = resolve(dirname(fromFile), cleaned);
  }

  const candidates = [target];
  if (cleaned.endsWith('/') || !extname(target)) candidates.push(join(target, 'index.html'));
  return { target: candidates.find(existsSync), display: cleaned };
}

export function checkStaticSite({ distDir = 'dist', siteBase = BASE } = {}) {
  const root = resolve(distDir);
  const errors = [];
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return { errors: [`static build directory does not exist: ${root}`], htmlFiles: 0, checkedReferences: 0 };
  }

  const files = walk(root);
  const htmlFiles = files.filter((path) => extname(path) === '.html');
  let checkedReferences = 0;

  for (const file of files.filter((path) => ['.html', '.css', '.js'].includes(extname(path)))) {
    const text = readFileSync(file, 'utf8');
    const fileLabel = relative(root, file);
    for (const { label, pattern } of FORBIDDEN_RUNTIME) {
      if (pattern.test(text)) errors.push(`${fileLabel} contains forbidden runtime reference: ${label}`);
    }
    if (extname(file) === '.html') {
      for (const problem of pageContractProblems(text)) errors.push(`${fileLabel}: ${problem}`);
    }
    const references = extname(file) === '.css'
      ? referencesFromCss(text)
      : extname(file) === '.html' ? referencesFromHtml(text) : [];
    for (const value of references) {
      const resolved = resolveInternalReference({ value, fromFile: file, distDir: root, siteBase });
      if (!resolved) continue;
      checkedReferences += 1;
      if (resolved.error) errors.push(`${fileLabel}: ${resolved.error}`);
      else if (!resolved.target) errors.push(`${fileLabel}: unresolved internal reference ${resolved.display}`);
    }
  }

  return { errors: [...new Set(errors)], htmlFiles: htmlFiles.length, checkedReferences };
}

function main() {
  const result = checkStaticSite({ distDir: process.argv[2] || 'dist', siteBase: BASE });
  if (result.errors.length > 0) throw new Error(result.errors.join('\n'));
  console.log(`Static site gate passed: ${result.htmlFiles} HTML files; ${result.checkedReferences} internal references`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
