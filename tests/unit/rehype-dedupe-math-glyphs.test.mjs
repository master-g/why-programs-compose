import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import rehypeDedupeMathGlyphs from '../../src/plugins/rehype-dedupe-math-glyphs.mjs';

function element(tagName, properties = {}, children = []) {
  return { type: 'element', tagName, properties, children };
}

/** 两条公式,各自内联同一个字形 M1 与各自独有的字形。 */
function makeTree({ hrefKey = 'xLinkHref' } = {}) {
  const formula = (n, extraShape) =>
    element('mjx-container', {}, [
      element('svg', {}, [
        element('defs', {}, [
          element('path', { id: `MJX-${n}-A`, d: 'M1' }),
          element('path', { id: `MJX-${n}-B`, d: extraShape }),
        ]),
        element('g', {}, [
          element('use', { [hrefKey]: `#MJX-${n}-A` }),
          element('use', { [hrefKey]: `#MJX-${n}-B` }),
        ]),
      ]),
    ]);
  return { type: 'root', children: [formula(1, 'M2'), formula(2, 'M3')] };
}

function collect(node, tagName, found = []) {
  if (node?.type === 'element' && node.tagName === tagName) found.push(node);
  for (const child of node?.children ?? []) collect(child, tagName, found);
  return found;
}

describe('rehype-dedupe-math-glyphs', () => {
  it('keeps one path per distinct glyph and repoints the duplicates', () => {
    const tree = makeTree();
    rehypeDedupeMathGlyphs()(tree);

    const paths = collect(tree, 'path');
    assert.deepEqual(
      paths.map((node) => node.properties.d).sort(),
      ['M1', 'M2', 'M3'],
      '每个不同字形只应保留一份',
    );
    assert.equal(
      paths.some((node) => node.properties.id === 'MJX-2-A'),
      false,
      '第二条公式里重复的 M1 应被删除',
    );

    const hrefs = collect(tree, 'use').map((node) => node.properties.xLinkHref);
    assert.deepEqual(hrefs, ['#MJX-1-A', '#MJX-1-B', '#MJX-1-A', '#MJX-2-B']);
  });

  it('rewrites plain href as well as xlink:href', () => {
    const tree = makeTree({ hrefKey: 'href' });
    rehypeDedupeMathGlyphs()(tree);
    const hrefs = collect(tree, 'use').map((node) => node.properties.href);
    assert.deepEqual(hrefs, ['#MJX-1-A', '#MJX-1-B', '#MJX-1-A', '#MJX-2-B']);
  });

  it('drops a defs that became empty and keeps one that did not', () => {
    const tree = {
      type: 'root',
      children: [
        element('svg', {}, [
          element('defs', {}, [element('path', { id: 'a', d: 'M1' })]),
        ]),
        element('svg', {}, [
          element('defs', {}, [element('path', { id: 'b', d: 'M1' })]),
          element('use', { xLinkHref: '#b' }),
        ]),
      ],
    };
    rehypeDedupeMathGlyphs()(tree);

    assert.equal(collect(tree, 'defs').length, 1, '清空后的 defs 应被删除');
    assert.equal(collect(tree, 'path').length, 1);
    assert.equal(collect(tree, 'use')[0].properties.xLinkHref, '#a');
  });

  it('leaves a tree without repeated glyphs untouched', () => {
    const tree = {
      type: 'root',
      children: [
        element('svg', {}, [
          element('defs', {}, [
            element('path', { id: 'a', d: 'M1' }),
            element('path', { id: 'b', d: 'M2' }),
          ]),
          element('use', { xLinkHref: '#a' }),
          element('use', { xLinkHref: '#b' }),
        ]),
      ],
    };
    const before = JSON.stringify(tree);
    rehypeDedupeMathGlyphs()(tree);
    assert.equal(JSON.stringify(tree), before);
  });

  it('ignores paths that carry no id or no shape', () => {
    const tree = {
      type: 'root',
      children: [
        element('svg', {}, [
          element('path', { d: 'M1' }),
          element('path', { id: 'only-id' }),
          element('path', { id: 'a', d: 'M1' }),
        ]),
      ],
    };
    rehypeDedupeMathGlyphs()(tree);
    assert.equal(collect(tree, 'path').length, 3, '缺 id 或缺 d 的节点不参与归并');
  });
});
