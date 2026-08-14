import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPageMarkdown } from '../../src/pages/_render-page.mjs';
import { makeMarkdownSanitizeSchema } from '../../src/lib/markdown-pipeline.mjs';
import { BASE } from '../../src/lib/base.mjs';

const astroConfig = readFileSync('astro.config.mjs', 'utf8');
const renderHelper = readFileSync('src/pages/_render-page.mjs', 'utf8');

describe('renderPageMarkdown article structure', () => {
  it('uses one shared Markdown pipeline in production and test rendering', () => {
    assert.match(astroConfig, /createArticleMarkdownPipeline\(/);
    assert.match(renderHelper, /createArticleMarkdownPipeline\(/);
    assert.doesNotMatch(astroConfig, /from "remark-math"|from "rehype-sanitize"/);
    assert.doesNotMatch(renderHelper, /from "remark-math"|from "rehype-sanitize"/);
  });

  it('wraps every level-two heading and its content in an article section', async () => {
    const html = await renderPageMarkdown(`## Introduction

First paragraph.

## Properties

Second paragraph.
`);

    const sections = html.match(/<section class="article-section">/g) || [];
    assert.equal(sections.length, 2);
    assert.match(
      html,
      /<section class="article-section"><h2[^>]*>Introduction<\/h2>\s*<p>First paragraph\.<\/p>\s*<\/section>/,
    );
    assert.match(
      html,
      /<section class="article-section"><h2[^>]*>Properties<\/h2>\s*<p>Second paragraph\.<\/p>\s*<\/section>/,
    );
  });

  it('keeps the trailing MathJax companion style outside the themed sections', async () => {
    const html = await renderPageMarkdown(`## Formula

$x + y$
`);

    assert.match(html, /<\/section>\s*<style>/);
    assert.match(html, /<\/style>$/);
    assert.equal((html.match(/<section class="article-section">/g) || []).length, 1);
  });

  it('marks paragraph-only inline MathJax output for display-style centering', async () => {
    const html = await renderPageMarkdown(`## Formula

$$x + y$$

The value $x + y$ stays inline.
`);

    assert.match(
      html,
      /<p class="standalone-math"><mjx-container class="MathJax" jax="SVG">/,
    );
    assert.doesNotMatch(html, /<p class="standalone-math">The value/);
  });

  it('renders numbered and unnumbered notes with local accessible structure', async () => {
    const html = await renderPageMarkdown(`## Notes

正文。[^note]

> [!marginnote] 符号提醒
> 内容含 *强调*。

[^note]: 旁注含 [内积](../category/) 与 $x^2$。
`, { currentSection: 'categories' });

    assert.match(html, /<section class="article-section">/);
    assert.match(
      html,
      /<sup class="sidenote-ref-wrapper"><a href="#sidenote-note" id="sidenote-ref-note" class="sidenote-ref" aria-describedby="sidenote-note">1<\/a><\/sup>/,
    );
    assert.match(
      html,
      /<span id="sidenote-note" class="sidenote sidenote--numbered" role="note" aria-labelledby="sidenote-ref-note">/,
    );
    assert.match(
      html,
      /<a href="#sidenote-ref-note" class="sidenote__backref" aria-label="返回旁注引用 1">↩<\/a>/,
    );
    assert.match(
      html,
      /<aside class="sidenote sidenote--margin" role="note" aria-label="符号提醒">/,
    );
    assert.match(html, new RegExp(`href="${BASE}/category/"`));
    assert.match(html, /<span class="sidenote__body">[\s\S]*<mjx-container class="MathJax"/);
    assert.doesNotMatch(html, /data-footnotes|class="footnotes"|Footnotes/);
  });

  it('keeps raw author HTML disabled inside notes', async () => {
    const html = await renderPageMarkdown(`正文。[^note]

[^note]: 旁注含 <span>危险</span> 与安全文本。
`);

    assert.doesNotMatch(html, /<span>危险<\/span>/);
    assert.match(html, /危险/);
    assert.match(html, /安全文本/);
  });

  it('renders the three Tufte layouts as semantic nodes after sidenotes', async () => {
    const html = await renderPageMarkdown(`## Layouts

正文。[^note]

> [!marginfigure] 图注
> ![示意](svg/example.1.svg)

> [!fullwidth] 比较表
> | 条件 | 结果 |
> | --- | --- |
> | 小 | 大 |

> [!epigraph]
> 先说明问题。
>
> ——来源

[^note]: 局部补充。`, { currentSection: 'categories' });

    assert.match(html, /<span id="sidenote-note" class="sidenote sidenote--numbered"/);
    assert.match(html, /<figure class="marginfigure"><img[^>]+alt="示意"[^>]*><figcaption>图注<\/figcaption><\/figure>/);
    assert.match(html, /<figure class="fullwidth fullwidth--table">[\s\S]*<table>/);
    assert.match(html, /<blockquote class="epigraph"><p>先说明问题。<\/p><footer>——来源<\/footer><\/blockquote>/);
    assert.match(html, new RegExp(`src="${BASE}/assets/categories/svg/example\\.1\\.svg"`));
  });

  it('fails closed when a layout marker reaches HAST with an invalid shape', async () => {
    await assert.rejects(
      () => renderPageMarkdown(`## Invalid

> [!marginfigure] 标记
>
> 第二段`),
      /Tufte 块转换失败|布局 callout/,
    );
  });

  it('allows only the semantic Tufte tags and class attributes in sanitize', () => {
    const schema = makeMarkdownSanitizeSchema({ tagNames: [], attributes: {} });
    assert.deepEqual(schema.tagNames.filter((tag) => ['figure', 'figcaption', 'footer'].includes(tag)), ['figure', 'figcaption', 'footer']);
    assert.deepEqual(schema.attributes.figure, ['class', 'className']);
    assert.deepEqual(schema.attributes.figcaption, ['class', 'className']);
    assert.deepEqual(schema.attributes.footer, ['class', 'className']);
    assert.deepEqual(schema.attributes.blockquote, ['class', 'className']);
  });
});
