import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkLicenseMetadata } from '../../scripts/check-licenses.mjs';
import { forbiddenHistoryPaths } from '../../scripts/check-public-history.mjs';
import { checkSourceReleaseBoundary } from '../../scripts/check-public-release.mjs';
import { checkStaticSite } from '../../scripts/check-static-site.mjs';

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
    const distDir = mkdtempSync(join(tmpdir(), 'why-programs-compose-dist-'));
    writeFileSync(
      join(distDir, 'index.html'),
      '<a href="/why-programs-compose/missing/">missing</a><script src="https://www.googletagmanager.com/gtag/js"></script>',
    );
    const result = checkStaticSite({ distDir, siteBase: '/why-programs-compose' });
    assert.ok(result.errors.some((error) => error.includes('/missing/')));
    assert.ok(result.errors.some((error) => error.includes('googletagmanager.com')));
  });

  it('accepts resolvable project-base pages and assets', () => {
    const distDir = mkdtempSync(join(tmpdir(), 'why-programs-compose-dist-'));
    mkdirSync(join(distDir, 'about'));
    mkdirSync(join(distDir, '_astro'));
    writeFileSync(join(distDir, 'index.html'), '<a href="/why-programs-compose/about/">about</a><link rel="stylesheet" href="/why-programs-compose/_astro/site.css">');
    writeFileSync(join(distDir, 'about', 'index.html'), '<a href="/why-programs-compose/">home</a>');
    writeFileSync(join(distDir, '_astro', 'site.css'), 'body { color: black; }');
    const result = checkStaticSite({ distDir, siteBase: '/why-programs-compose' });
    assert.deepEqual(result.errors, []);
    assert.equal(result.htmlFiles, 2);
  });
});
