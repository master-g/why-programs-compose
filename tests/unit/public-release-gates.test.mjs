import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkLicenseMetadata } from '../../scripts/check-licenses.mjs';
import { forbiddenHistoryPaths } from '../../scripts/check-public-history.mjs';
import { checkSourceReleaseBoundary } from '../../scripts/check-public-release.mjs';
import { checkStaticSite, pageContractProblems } from '../../scripts/check-static-site.mjs';
import { checkBuildSize } from '../../scripts/check-build-size.mjs';
import { danglingGlyphRefs } from '../../scripts/check-mjx-errors.mjs';
import { BASE } from '../../src/lib/base.mjs';
import { SITE } from '../../src/lib/site.config.mjs';

describe('public release gates', () => {
  it('rejects forbidden paths anywhere in reachable history', () => {
    const forbidden = forbiddenHistoryPaths([
      '1111111111111111111111111111111111111111 README.md',
      '2222222222222222222222222222222222222222 public/theme/style.css',
      '3333333333333333333333333333333333333333 reference/home.html',
    ]);
    assert.deepEqual(forbidden, ['public/theme/style.css', 'reference/home.html']);
  });

  it('rejects forbidden tracked assets', () => {
    const result = checkSourceReleaseBoundary({ trackedFiles: ['public/theme/style.css'] });
    assert.ok(result.errors.some((error) => error.includes('public/theme/style.css')));
  });

  it('rejects undocumented direct dependencies and missing lockfile licenses', () => {
    const result = checkLicenseMetadata({
      packageJson: { dependencies: { astro: '1.0.0', mystery: '1.0.0' } },
      lock: {
        packages: {
          '': {},
          'node_modules/astro': { version: '1.0.0', license: 'MIT' },
          'node_modules/mystery': { version: '1.0.0' },
        },
      },
      notices: '| `astro` | 1.0.0 | MIT | source |',
    });
    assert.ok(result.errors.some((error) => error.includes('mystery') && error.includes('not documented')));
    assert.ok(result.errors.some((error) => error.includes('mystery') && error.includes('missing license')));
  });

  it('rejects broken links and forbidden runtime hosts', () => {
    const distDir = mkdtempSync(join(tmpdir(), 'site-dist-'));
    writeFileSync(
      join(distDir, 'index.html'),
      `<a href="${BASE}/missing/">missing</a><script src="https://www.googletagmanager.com/gtag/js"></script>`,
    );
    const result = checkStaticSite({ distDir, siteBase: BASE });
    assert.ok(result.errors.some((error) => error.includes('/missing/')));
    assert.ok(result.errors.some((error) => error.includes('googletagmanager.com')));
  });

  it('accepts resolvable project-base pages and assets', () => {
    const distDir = mkdtempSync(join(tmpdir(), 'site-dist-'));
    mkdirSync(join(distDir, 'about'));
    mkdirSync(join(distDir, '_astro'));
    writeFileSync(join(distDir, 'index.html'), `<a href="${BASE}/about/">about</a><link rel="stylesheet" href="${BASE}/_astro/site.css">`);
    writeFileSync(join(distDir, 'about', 'index.html'), `<a href="${BASE}/">home</a>`);
    writeFileSync(join(distDir, '_astro', 'site.css'), 'body { color: black; }');
    const result = checkStaticSite({ distDir, siteBase: BASE });
    assert.deepEqual(result.errors, []);
    assert.equal(result.htmlFiles, 2);
  });

  it('flags math glyph references that lost their path', () => {
    const ok = '<svg><defs><path id="MJX-1-A" d="M1"/></defs><use xlink:href="#MJX-1-A"/></svg>';
    assert.deepEqual(danglingGlyphRefs(ok), []);

    // 归并后漏改一处引用:字形静默消失,页面不报错。
    const broken = ok + '<use xlink:href="#MJX-2-A"/>';
    assert.deepEqual(danglingGlyphRefs(broken), ['MJX-2-A']);

    // 正文锚点与旁注回链不是字形引用,不参与本检查。
    assert.deepEqual(danglingGlyphRefs('<a href="#user-content-fn-1">1</a>'), []);
  });

  it('catches the rendered-title defect that source-level contracts miss', () => {
    const page = (title, body = '<h1>x</h1>') =>
      `<html><head><title>${title}</title></head><body>${body}</body></html>`;
    const brand = SITE.brandZh;

    assert.deepEqual(pageContractProblems(page(`态射 | ${brand}`)), []);
    assert.deepEqual(pageContractProblems(page(brand)), []);

    // 上游实测缺陷:BaseLayout 与 [slug].astro 各拼一次品牌后缀。
    const doubled = pageContractProblems(page(`态射 | ${brand} | ${brand}`));
    assert.equal(doubled.length, 1);
    assert.match(doubled[0], /品牌名重复 2 次/);

    assert.match(pageContractProblems(page('态射'))[0], /缺少品牌名/);
    assert.match(pageContractProblems(page(''))[0], /为空/);
    assert.match(
      pageContractProblems('<html><body><h1>a</h1></body></html>')[0],
      /应有且仅有一个 <title>/,
    );
    assert.match(
      pageContractProblems(page(`态射 | ${brand}`, '<h1>a</h1><h1>b</h1>'))[0],
      /应有且仅有一个 <h1>/,
    );

    // 片段 HTML 没有 <html> 外壳,不受契约约束。
    assert.deepEqual(pageContractProblems('<h1>a</h1><h1>b</h1>'), []);
  });

  it('fails the size gate when a measure is silently reverted', () => {
    const distDir = mkdtempSync(join(tmpdir(), 'size-gate-'));
    // 字形去重失效的形态:单页 <path> 由 48 跳回 349 量级。
    writeFileSync(
      join(distDir, 'index.html'),
      '<html>' + '<path id="MJX-x" d="M1"/>'.repeat(600) + '</html>',
    );
    // deferRender 失效的形态:内容存储由 55 KB/词条 跳回 280 KB/词条。
    const contentDir = mkdtempSync(join(tmpdir(), 'size-gate-content-'));
    mkdirSync(join(contentDir, 'part-0'));
    writeFileSync(join(contentDir, 'part-0', 'a.md'), '# a');
    const storePath = join(distDir, 'store.json');
    writeFileSync(storePath, 'x'.repeat(300 * 1024));

    const reverted = checkBuildSize({ distDir, storePath, contentDir });
    assert.equal(reverted.errors.length, 2);
    assert.ok(reverted.errors.some((error) => /字形去重可能已失效/.test(error)));
    assert.ok(reverted.errors.some((error) => /deferRender 可能已失效/.test(error)));

    // 内容存储缺席不算失败:npm install 后、首次构建前就是这个状态。
    const healthy = checkBuildSize({
      distDir,
      storePath: join(distDir, 'missing.json'),
      contentDir,
      limits: { maxPageKb: 1000, maxGlyphPathsPerPage: 4000, contentStoreKbPerEntry: 120 },
    });
    assert.deepEqual(healthy.errors, []);
    assert.equal(healthy.storeKbPerEntry, null);
  });
});
