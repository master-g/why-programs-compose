import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { renderPageMarkdown } from '../../src/pages/_render-page.mjs';

// 渲染冒烟:glob-loader 在 dev/build 里把渲染异常吞成日志,页面会带空正文
// 静默通过构建门禁(2026-08-14 marginnote 以 $math$ 开头触发过)。
// 这里把每个同步产物过一遍真实管线,任何词条渲染抛错都让测试失败。
const ROOT = new URL('../..', import.meta.url).pathname;
const CONTENT_ROOT = join(ROOT, 'content-zh');

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

describe('content render smoke', () => {
  it('renders every synced article through the real pipeline without throwing', async () => {
    const files = markdownFiles(CONTENT_ROOT);
    for (const path of files) {
      const id = relative(CONTENT_ROOT, path).split(sep).join('/');
      const section = id.split('/')[0];
      const body = readFileSync(path, 'utf8').replace(/^---[\s\S]*?---\n/, '');
      let html;
      try {
        html = await renderPageMarkdown(body, { currentSection: section });
      } catch (error) {
        assert.fail(`${id}: 渲染管线抛错 — ${error.message}`);
      }
      assert.equal(html.length > 500, true, `${id}: 渲染产物过短,疑似空正文`);
    }
  });
});
