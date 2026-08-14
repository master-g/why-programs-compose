import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function trackedFiles() {
  const output = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files'], { encoding: 'utf8' }).trim();
  return output ? output.split('\n').filter(existsSync) : [];
}

describe('public repository release boundary', () => {
  it('documents separate licenses for software, content, and third-party material', () => {
    for (const path of [
      'LICENSE.md',
      'LICENSES/CC-BY-SA-4.0.txt',
      'LICENSES/MIT.txt',
      'LICENSES/LUCIDE.txt',
      'README.md',
      'THIRD_PARTY_NOTICES.md',
    ]) {
      assert.equal(existsSync(path), true, `${path} must exist`);
    }

    const scope = readFileSync('LICENSE.md', 'utf8');
    assert.match(scope, /原创软件代码[\s\S]*MIT/);
    assert.match(scope, /中文词条与原创插图[\s\S]*CC BY-SA 4\.0/);
    assert.match(scope, /第三方材料/);
  });

  it('keeps copied Algebrica visual assets out of the tracked tree', () => {
    const forbidden = trackedFiles().filter((path) =>
      path.startsWith('public/theme/')
      || path === 'public/styles/zh-overrides.css'
      || /^reference\/(?:home|entry|category)\.html$/.test(path)
      || path === 'scripts/fetch-assets.mjs',
    );
    assert.deepEqual(forbidden, []);
  });

  it('keeps the public explanation consistent with the repository scope', () => {
    const readme = readFileSync('README.md', 'utf8');
    const about = readFileSync('src/pages/about.astro', 'utf8');
    const article = readFileSync('src/pages/[slug].astro', 'utf8');

    for (const text of [readme, about, article]) {
      assert.match(text, /CC BY-SA 4\.0/);
      assert.match(text, /MIT/);
    }
    assert.match(about, /独立界面/);
  });
});
