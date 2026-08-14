import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validateSvgTheme } from '../../scripts/lib/svg-theme-contract.mjs';

const baseLayout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
const homePage = readFileSync('src/pages/index.astro', 'utf8');
const learnPage = existsSync('src/pages/learn.astro') ? readFileSync('src/pages/learn.astro', 'utf8') : '';
const categoryPage = readFileSync('src/pages/category/[section]/index.astro', 'utf8');
const articlePage = readFileSync('src/pages/[slug].astro', 'utf8');
const searchBox = readFileSync('src/components/SearchBox.astro', 'utf8');
const themeToggle = readFileSync('src/components/ThemeToggle.astro', 'utf8');
const siteCss = readFileSync('src/styles/site.css', 'utf8');
const playgroundMarkdown = readFileSync('playground/rendering.md', 'utf8');
const playgroundSvg = readFileSync('public/assets/playground/svg/test-1.svg', 'utf8');

describe('independent visual contracts', () => {
  it('loads the repository-owned stylesheet without copied theme paths', () => {
    assert.match(baseLayout, /import '..\/styles\/site\.css'/);
    assert.doesNotMatch(baseLayout, /\/theme\//);
    assert.doesNotMatch(baseLayout, /zh-overrides\.css/);
  });

  it('uses semantic site navigation and a text brand', () => {
    assert.match(baseLayout, /class="site-header"/);
    assert.match(baseLayout, /class="site-brand__name">程序为什么能组合/);
    assert.match(baseLayout, /class="site-menu"/);
    assert.doesNotMatch(baseLayout, /icon-algebrica/);
  });

  it('marks the active destination and keeps global navigation terminology consistent', () => {
    assert.match(baseLayout, /activeNav/);
    assert.match(baseLayout, /aria-current=/);
    assert.match(baseLayout, /label: '全库目录'/);
    assert.equal(baseLayout.match(/navItems\.map/g)?.length, 2);
    assert.match(baseLayout, />GitHub ↗</);
    assert.match(articlePage, /activeNav=/);
  });

  it('keeps the desktop header compact and aligns the active marker with its divider', () => {
    assert.match(siteCss, /\.site-header__inner\s*\{[^}]*min-height:\s*60px;/s);
    assert.match(siteCss, /\.site-nav\s*\{[^}]*align-self:\s*stretch;[^}]*align-items:\s*stretch;/s);
    assert.match(siteCss, /\.site-nav\s*>\s*a\s*\{[^}]*position:\s*relative;/s);
    assert.match(siteCss, /\.site-nav\s*>\s*a\[aria-current="page"\]::after\s*\{[^}]*bottom:\s*-1px;[^}]*height:\s*2px;/s);
  });

  it('keeps search discoverable and exposes combobox semantics', () => {
    assert.match(baseLayout, /class="site-search-trigger"/);
    assert.match(baseLayout, /data-mobile-search-trigger/);
    assert.match(baseLayout, /event\.metaKey \|\| event\.ctrlKey/);
    assert.match(searchBox, /role="combobox"/);
    assert.match(searchBox, /aria-label="搜索词条"/);
    assert.match(searchBox, /aria-controls=/);
    assert.match(searchBox, /aria-activedescendant/);
  });

  it('uses one accessible theme switch with paired current-color icons', () => {
    assert.match(baseLayout, /ThemeToggle/);
    assert.doesNotMatch(baseLayout, /data-theme-choice/);
    assert.match(themeToggle, /role="switch"/);
    assert.match(themeToggle, /aria-checked="false"/);
    assert.match(themeToggle, /stroke="currentColor"/);
    assert.match(siteCss, /\.theme-toggle/);
    assert.match(siteCss, /\.theme-toggle__thumb\s*\{[^}]*color:\s*var\(--ink\);[^}]*background:\s*var\(--paper\);[^}]*box-shadow:/s);
    assert.match(siteCss, /transition-property:\s*opacity,\s*scale,\s*filter/);
    assert.match(siteCss, /@media \(prefers-reduced-motion:\s*reduce\)/);
  });

  it('keeps the mobile menu inside the viewport and exposes its open state', () => {
    assert.match(baseLayout, /menu\?\.addEventListener\('toggle'/);
    assert.match(baseLayout, /event\.key === 'Escape'/);
    assert.match(baseLayout, /收起导航/);
    assert.match(siteCss, /\.site-menu__panel\s*\{[^}]*max-height:\s*calc\(100dvh - 78px\);[^}]*overflow-y:\s*auto;/s);
    assert.match(siteCss, /\.site-menu\[open\]/);
  });

  it('renders the home page as an independent book index', () => {
    assert.match(homePage, /class="home-page"/);
    assert.match(homePage, /class="home-hero"/);
    assert.match(homePage, /class="section-index__group"/);
    assert.match(homePage, /href={withBase\('\/learn\/'\)}/);
    assert.match(homePage, /从这里开始/);
  });

  it('applies the restrained editorial brand layer to the home page', () => {
    assert.match(
      siteCss,
      /\.home-hero h1\s*\{[^}]*font:\s*760 clamp\(58px,\s*7\.2vw,\s*88px\)\/1\.03 var\(--font-sans\);[^}]*text-wrap:\s*balance;/s,
    );
    assert.match(siteCss, /\.home-hero > p\s*\{[^}]*font:\s*400 20px\/1\.85 var\(--font-serif\);[^}]*text-wrap:\s*pretty;/s);
    assert.match(
      siteCss,
      /\.button-primary,\s*\.button-secondary\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*10px 20px;[^}]*border-radius:\s*8px;[^}]*font:\s*650 15px\/1\.2 var\(--font-sans\);/s,
    );
    assert.match(
      siteCss,
      /\.button-primary,\s*\.button-secondary\s*\{[^}]*transition-property:\s*background-color,\s*border-color,\s*color,\s*opacity,\s*scale;/s,
    );
    assert.match(siteCss, /\.button-primary:active,\s*\.button-secondary:active\s*\{[^}]*scale:\s*0\.96;/s);
    assert.match(siteCss, /\.button-primary:hover,\s*\.button-secondary:hover\s*\{[^}]*opacity:\s*0\.82;/s);
    assert.doesNotMatch(siteCss, /\.button-primary:hover,[^}]*background:\s*var\(--accent\);/s);
  });

  it('renders a no-script learning path with stages, optional branches, and references', () => {
    assert.notEqual(learnPage, '', 'learning path page is missing');
    assert.match(learnPage, /class="learning-path-page"/);
    assert.match(learnPage, /class="learning-path-stage"/);
    assert.match(learnPage, /17/);
    assert.match(learnPage, /56/);
    assert.match(learnPage, /21/);
    assert.match(learnPage, /遇到推导困难时回补/);
    assert.match(learnPage, /可选支线/);
    assert.match(learnPage, /进阶参考/);
    assert.match(learnPage, /<blockquote class="epigraph"/);
    assert.match(learnPage, /class="newthought"/);
    assert.match(learnPage, /<details/);
  });

  it('marks category roles and non-blocking math backfill without empty placeholders', () => {
    assert.match(categoryPage, /getSectionPathContext/);
    assert.match(categoryPage, /class="category-path-role"/);
    assert.match(categoryPage, /class="category-backfill"/);
    assert.match(categoryPage, /遇到推导困难时回补/);
    assert.match(categoryPage, /backfillGroups\.length > 0/);
  });

  it('separates math chapter entries by reader action', () => {
    assert.match(categoryPage, /mathGroups\.length > 0/);
    assert.match(categoryPage, /现在读/);
    assert.match(categoryPage, /按需回补/);
    assert.match(categoryPage, /形式参考/);
    assert.match(categoryPage, /class="chapter-list-group/);
    assert.match(siteCss, /\.chapter-list-group/);
  });

  it('keeps article navigation path-aware and server-generated', () => {
    assert.match(articlePage, /getArticleNavigation/);
    assert.match(articlePage, /class="[^"]*\bpath-nav\b/);
    assert.match(articlePage, /class="article-path-returns"/);
    assert.doesNotMatch(articlePage, /URLSearchParams|localStorage.*next|[?&]next=/);
  });

  it('contains standalone illustrations across the whole article and centers display formulas', () => {
    assert.match(
      siteCss,
      /\.article-content p > img:only-child\s*\{[^}]*display:\s*block;[^}]*max-width:\s*100%;[^}]*height:\s*auto;[^}]*margin-inline:\s*auto;/s,
    );
    assert.match(
      siteCss,
      /\.article-content p\.standalone-math > mjx-container\s*\{[^}]*display:\s*block;[^}]*text-align:\s*center;/s,
    );
  });

  it('contains formulas and wide tables on narrow screens', () => {
    assert.match(
      siteCss,
      /\.article-content mjx-container\[display="true"\][\s\S]*overflow-x:\s*auto;/,
    );
    assert.match(
      siteCss,
      /\.article-section table\s*\{[^}]*display:\s*block;[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto;/s,
    );
    assert.match(
      siteCss,
      /\.article-section li > mjx-container:not\(\[display="true"\]\)\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto;/s,
    );
    assert.match(
      siteCss,
      /@media \(max-width:\s*760px\)[\s\S]*\.article-section p > mjx-container:not\(\[display="true"\]\)\s*\{[^}]*display:\s*inline-block;[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto;/s,
    );
    assert.match(
      siteCss,
      /@media \(max-width:\s*760px\)[\s\S]*\.article-content mjx-container\[display="true"\] > svg,[\s\S]*max-width:\s*100%;/s,
    );
    assert.match(
      siteCss,
      /@media \(max-width:\s*760px\)[\s\S]*\.article-section h2\s*\{[^}]*overflow-wrap:\s*anywhere;/s,
    );
  });

  it('keeps notes visible in flow on narrow screens and in the 240px desktop margin', () => {
    assert.match(
      siteCss,
      /\.article-section \.sidenote\s*\{[^}]*display:\s*block;[^}]*max-width:\s*100%;[^}]*background:\s*var\(--note\);/s,
    );
    assert.match(
      siteCss,
      /@media \(min-width:\s*1040px\)[\s\S]*\.article-section \.sidenote\s*\{[^}]*float:\s*right;[^}]*clear:\s*right;[^}]*width:\s*240px;[^}]*background:\s*transparent;/s,
    );
    assert.match(
      siteCss,
      /@media \(min-width:\s*1040px\)[\s\S]*\.article-section::after\s*\{[^}]*clear:\s*both;/s,
    );
    assert.doesNotMatch(siteCss, /sidenote[^{}]*checkbox|checkbox[^{}]*sidenote/i);
  });

  it('styles note labels, anchors and return links with visible focus', () => {
    assert.match(siteCss, /\.sidenote__label[\s\S]*font-family:\s*var\(--font-mono\)/);
    assert.match(siteCss, /\.sidenote-ref:focus-visible/);
    assert.match(siteCss, /\.sidenote__backref:focus-visible/);
    assert.match(siteCss, /\.sidenote:target/);
  });

  it('keeps a complete sidenote fixture in the rendering playground', () => {
    assert.match(playgroundMarkdown, /\[\^sidenote-first\]/);
    assert.match(playgroundMarkdown, /\[\^sidenote-second\]/);
    assert.match(playgroundMarkdown, /> \[!marginnote\] 符号提醒/);
    assert.match(playgroundMarkdown, /\[\^sidenote-math\]:[^\n]*\$[^$]+\$/);
    assert.match(playgroundMarkdown, /\[\^sidenote-link\]:[^\n]*\[[^\]]+\]\([^)]+\)/);
  });

  it('keeps a complete Tufte layout fixture and responsive/print contracts', () => {
    assert.match(playgroundMarkdown, /> \[!marginfigure\]/);
    assert.match(playgroundMarkdown, /> \[!fullwidth\]/);
    assert.match(playgroundMarkdown, /> \[!epigraph\]/);
    assert.match(siteCss, /\.article-content figure\.marginfigure\s*\{[\s\S]*width:\s*240px;/);
    assert.match(siteCss, /\.article-content figure\.fullwidth\s*\{[\s\S]*clear:\s*both;/);
    assert.match(
      siteCss,
      /\.article-content figure\.fullwidth--table table\s*\{[^}]*display:\s*table;[^}]*width:\s*100%;[^}]*min-width:\s*680px;/s,
    );
    assert.match(siteCss, /@media \(max-width:\s*760px\)[\s\S]*\.article-content figure\.marginfigure,[\s\S]*float:\s*none;/);
    assert.match(siteCss, /@media print[\s\S]*\.article-content figure\.marginfigure,[\s\S]*break-inside:\s*avoid;/);
    assert.match(siteCss, /@media print[\s\S]*details:not\(\[open\]\) > :not\(summary\)/);
    assert.match(siteCss, /@media \(prefers-reduced-motion:\s*reduce\)/);
  });

  it('renders a scoped content-license notice on every article', () => {
    assert.match(articlePage, /<footer class="article-attribution">/);
    assert.match(articlePage, /正文与原创插图/);
    assert.match(articlePage, /软件代码与第三方材料不在此许可范围内/);
  });

  it('keeps the repository-owned illustration on the adaptive SVG contract', () => {
    const result = validateSvgTheme(playgroundSvg, { asset: 'playground/svg/test-1.svg' });
    assert.deepEqual(result.errors, []);
    assert.match(playgroundSvg, /prefers-color-scheme:\s*dark/);
    assert.doesNotMatch(playgroundSvg, /\b(?:fill|stroke)="#[0-9a-f]{3,8}"/i);
  });
});
