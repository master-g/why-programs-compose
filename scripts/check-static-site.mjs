#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE } from '../src/lib/base.mjs';

const FORBIDDEN_RUNTIME = [
  { label: 'googletagmanager.com', pattern: /googletagmanager\.com/i },
  { label: 'google-analytics.com', pattern: /google-analytics\.com/i },
  { label: 'fonts.googleapis.com', pattern: /fonts\.googleapis\.com/i },
  { label: 'fonts.gstatic.com', pattern: /fonts\.gstatic\.com/i },
  { label: 'wp-content/themes', pattern: /wp-content\/themes/i },
  { label: '/theme/', pattern: /\/theme\//i },
];

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
