import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import rehypeTufteBlocks from '../../src/plugins/rehype-tufte-blocks.mjs';

function text(value) {
  return { type: 'text', value };
}

function element(tagName, properties = {}, children = []) {
  return { type: 'element', tagName, properties, children };
}

function image(alt = '示意') {
  return element('img', { src: '/assets/linear-algebra/svg/example.1.svg', alt });
}

function marked(type, label, children = []) {
  return element('blockquote', {}, [
    element('p', {}, [text(`[!${type}]${label ? ` ${label}` : ''}\n`), ...children]),
  ]);
}

function run(tree) {
  rehypeTufteBlocks()(tree);
  return tree;
}

describe('rehype-tufte-blocks', () => {
  it('把 marginfigure 转成 figure、img 和 figcaption，并保持顺序', () => {
    const tree = { type: 'root', children: [marked('marginfigure', '几何示意', [image()])] };
    run(tree);

    const figure = tree.children[0];
    assert.equal(figure.tagName, 'figure');
    assert.deepEqual(figure.properties.className, ['marginfigure']);
    assert.equal(figure.children[0].tagName, 'img');
    assert.equal(figure.children[0].properties.alt, '示意');
    assert.equal(figure.children[1].tagName, 'figcaption');
    assert.equal(figure.children[1].children[0].value, '几何示意');
  });

  it('把 fullwidth 图片与表格分成不同语义类名', () => {
    const table = element('table', {}, [element('tbody', {}, [])]);
    const tableMarked = element('blockquote', {}, [
      element('p', {}, [text('[!fullwidth] 宽表\n')]),
      table,
    ]);
    const tree = {
      type: 'root',
      children: [tableMarked, marked('fullwidth', '宽图', [image()])],
    };
    run(tree);

    assert.deepEqual(tree.children[0].properties.className, ['fullwidth', 'fullwidth--table']);
    assert.deepEqual(tree.children[1].properties.className, ['fullwidth', 'fullwidth--figure']);
    assert.equal(tree.children[0].children.find((child) => child.tagName === 'table').tagName, 'table');
    assert.equal(tree.children[1].children.find((child) => child.tagName === 'img').tagName, 'img');
  });

  it('把 epigraph 转成带 footer 的 blockquote，普通引用保持不变', () => {
    const ordinary = element('blockquote', {}, [element('p', {}, [text('普通引用。')])]);
    const quote = element('blockquote', {}, [
      element('p', {}, [text('[!epigraph]\n引文。')]),
      element('p', {}, [text('——来源')]),
    ]);
    const tree = { type: 'root', children: [ordinary, quote] };
    run(tree);

    assert.equal(tree.children[0], ordinary);
    assert.deepEqual(tree.children[1].properties.className, ['epigraph']);
    assert.equal(tree.children[1].children[0].tagName, 'p');
    assert.equal(tree.children[1].children[1].tagName, 'footer');
    assert.equal(tree.children[1].children[1].children[0].value, '——来源');
  });

  it('对异常 HAST 结构显式失败', () => {
    const tree = {
      type: 'root',
      children: [element('blockquote', {}, [
        element('p', {}, [text('[!marginfigure] 标题')]),
        element('p', {}, [text('第二段')]),
      ])],
    };
    assert.throws(() => run(tree), /marginfigure|结构/);
  });
});
