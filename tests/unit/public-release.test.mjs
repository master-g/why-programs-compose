import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { SITE } from '../../src/lib/site.config.mjs';

function trackedFiles() {
  const output = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files'], { encoding: 'utf8' }).trim();
  return output ? output.split('\n').filter(existsSync) : [];
}

describe('public repository release boundary', () => {
  // 换 topic 时只改 site.config.mjs 一处。身份字面量重新渗回代码会让下一次 fork
  // 又变成全库查找替换,而漏掉的那一处通常不报错,只是静默渲染错内容。
  it('keeps site identity out of source, scripts, and tests', () => {
    const sources = trackedFiles().filter(
      (path) =>
        /^(src|scripts|tests)\//.test(path) &&
        path !== 'src/lib/site.config.mjs',
    );
    assert.ok(sources.length > 0, 'no source files found');

    const offenders = [];
    for (const path of sources) {
      const text = readFileSync(path, 'utf8');
      // owner 不在此列:about 页的 algebrica-zh 归属声明是复用条件,必须保留字面量。
      for (const literal of [SITE.repo, SITE.brandZh]) {
        if (text.includes(literal)) offenders.push(`${path} 含身份字面量 ${literal}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

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

    // 页面从 SITE.contentLicense 取许可,一致性由配置保证;
    // README 是人写的散文,仍是字面量,所以这里反过来校验它与配置一致。
    assert.match(readme, new RegExp(SITE.contentLicense.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const text of [about, article]) {
      assert.match(text, /SITE\.contentLicense\.id/);
    }
    for (const text of [readme, about, article]) {
      assert.match(text, /MIT/);
    }
    assert.match(about, /独立界面/);
  });
});
