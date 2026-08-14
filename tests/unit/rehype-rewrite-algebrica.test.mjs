import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { visit } from 'unist-util-visit';
import rehypeRewrite from '../../src/plugins/rehype-rewrite-algebrica.mjs';

function makeLink(text, href) {
  return {
    type: 'element',
    tagName: 'a',
    properties: { href },
    children: [{ type: 'text', value: text }],
  };
}

function makeImg(src) {
  return {
    type: 'element',
    tagName: 'img',
    properties: { src, alt: '' },
    children: [],
  };
}

function run(tree, opts) {
  const file = { history: ['/repo/content-zh/integrals/definite-integrals.md'] };
  rehypeRewrite(opts)(tree, file);
  return tree;
}

function find(tree, tagName) {
  const out = [];
  visit(tree, 'element', (node) => {
    if (node.tagName === tagName) out.push(node);
  });
  return out;
}

describe('rehype-rewrite-algebrica', () => {
  it('rewrites section link to /category/<section>/', () => {
    const tree = { type: 'root', children: [makeLink('function', '../functions/')] };
    const slugMap = new Map([
      ['some-article', 'functions'],
      ['functions', 'functions'],
    ]);
    run(tree, { slugMap, dangling: { external: [], text: [] } });
    const [a] = find(tree, 'a');
    assert.equal(a.properties.href, '/category/functions/');
  });

  it('rewrites article link to /<slug>/', () => {
    const tree = { type: 'root', children: [makeLink('definite integrals', '../definite-integrals/')] };
    const slugMap = new Map([['definite-integrals', 'integrals']]);
    run(tree, { slugMap, dangling: { external: [], text: [] } });
    const [a] = find(tree, 'a');
    assert.equal(a.properties.href, '/definite-integrals/');
  });

  it('rewrites same-section ./<slug>/ link to /<slug>/', () => {
    const tree = { type: 'root', children: [makeLink('definite integrals', './definite-integrals/')] };
    const slugMap = new Map([['definite-integrals', 'integrals']]);
    run(tree, { slugMap, dangling: { external: [], text: [] } });
    const [a] = find(tree, 'a');
    assert.equal(a.properties.href, '/definite-integrals/');
  });

  it('rewrites a stale article slug through an explicit alias', () => {
    const tree = { type: 'root', children: [makeLink('Euler formula', '../eulers-formula/')] };
    const slugMap = new Map([['euler-formula', 'complex-numbers']]);
    run(tree, {
      slugMap,
      dangling: {
        aliases: { 'eulers-formula': 'euler-formula' },
        external: [],
        text: [],
      },
    });
    const [a] = find(tree, 'a');
    assert.equal(a.properties.href, '/euler-formula/');
  });

  it('rewrites repo-relative ../../<section>/<slug>/ link to /<slug>/', () => {
    const tree = { type: 'root', children: [makeLink('roots', '../../polynomials/roots-of-a-polynomial/')] };
    const slugMap = new Map([['roots-of-a-polynomial', 'polynomials']]);
    run(tree, { slugMap, dangling: { external: [], text: [] } });
    const [a] = find(tree, 'a');
    assert.equal(a.properties.href, '/roots-of-a-polynomial/');
  });

  it('rewrites external dangling to algebrica.org with target/rel/class', () => {
    const tree = { type: 'root', children: [makeLink('velocity', '../velocity/')] };
    const slugMap = new Map();
    run(tree, { slugMap, dangling: { external: ['velocity'], text: [] } });
    const [a] = find(tree, 'a');
    assert.equal(a.properties.href, 'https://algebrica.org/velocity/');
    assert.equal(a.properties.target, '_blank');
    assert.equal(a.properties.rel, 'noopener');
    assert.ok(a.properties.class.split(/\s+/).includes('external-en'));
  });

  it('unwraps text-class links into plain text', () => {
    const tree = { type: 'root', children: [makeLink('determinant', '../determinant/')] };
    const slugMap = new Map();
    run(tree, { slugMap, dangling: { external: [], text: ['determinant'] } });
    const [text] = tree.children;
    assert.equal(text.type, 'text');
    assert.equal(text.value, 'determinant');
  });

  it('warns on new dangling links', () => {
    const warnings = [];
    const warn = (msg) => warnings.push(msg);
    const tree = { type: 'root', children: [makeLink('unknown', '../totally-unknown/')] };
    const slugMap = new Map();
    run(tree, { slugMap, dangling: { external: [], text: [] }, warn });
    assert.ok(warnings.some((w) => /new dangling: totally-unknown/.test(w)));
  });

  it('rewrites same-section svg/ paths', () => {
    const tree = { type: 'root', children: [makeImg('svg/x.svg')] };
    const slugMap = new Map();
    run(tree, { slugMap, dangling: { external: [], text: [] } });
    const [img] = find(tree, 'img');
    assert.equal(img.properties.src, '/assets/integrals/svg/x.svg');
  });

  it('rewrites cross-section ../<section>/svg/ paths', () => {
    const tree = { type: 'root', children: [makeImg('../trigonometry/svg/y.svg')] };
    const slugMap = new Map();
    run(tree, { slugMap, dangling: { external: [], text: [] } });
    const [img] = find(tree, 'img');
    assert.equal(img.properties.src, '/assets/trigonometry/svg/y.svg');
  });
});
