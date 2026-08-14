import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { prepareArticleLayoutSource } from '../../scripts/lib/article-layout-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('prepareArticleLayoutSource', () => {
  it('保留有效页边图标记并接受一张图片', () => {
    const result = prepareArticleLayoutSource([
      '正文段落。',
      '',
      '> [!marginfigure] 几何示意',
      '> ![三角形](svg/example.1.svg)',
    ].join('\n'));

    assert.deepEqual(result.errors, []);
    assert.match(result.text, /> \[!marginfigure\] 几何示意/);
    assert.match(result.text, /!\[三角形\]\(svg\/example\.1\.svg\)/);
  });

  it('拒绝页边图缺图、空 alt、双图和禁止块', () => {
    const cases = [
      ['缺少图片', '> [!marginfigure] 图注\n> 只有文字。'],
      ['alt', '> [!marginfigure] 图注\n> ![](svg/example.1.svg)'],
      ['多张图片', '> [!marginfigure] 图注\n> ![一](svg/example.1.svg)\n> ![二](svg/example.2.svg)'],
      ['代码', '> [!marginfigure] 图注\n> ```\n> code\n> ```'],
      ['嵌套 callout', '> [!marginfigure] 图注\n> [!warning] 不能嵌套\n> ![图](svg/example.1.svg)'],
    ];

    for (const [kind, input] of cases) {
      const result = prepareArticleLayoutSource(input);
      assert.ok(result.errors.some((issue) => issue.message.includes(kind)), `${kind} 应失败`);
      assert.ok(result.errors.every((issue) => issue.line >= 1), `${kind} 应带行号`);
    }
  });

  it('接受单图片或矩形表格通栏，拒绝混合内容', () => {
    const image = prepareArticleLayoutSource('> [!fullwidth] 宽图\n> ![示意](svg/example.1.svg)');
    const table = prepareArticleLayoutSource([
      '> [!fullwidth] 比较表',
      '> | 条件 | 结果 |',
      '> | --- | --- |',
      '> | 小 | 大 |',
    ].join('\n'));
    const mixed = prepareArticleLayoutSource([
      '> [!fullwidth] 混合',
      '> | 条件 | 结果 |',
      '> | --- | --- |',
      '> ![示意](svg/example.1.svg)',
    ].join('\n'));

    assert.deepEqual(image.errors, []);
    assert.deepEqual(table.errors, []);
    assert.ok(mixed.errors.some((issue) => issue.message.includes('图片与表格混合')));
  });

  it('接受题记引文与来源，并保持普通引用块不变', () => {
    const result = prepareArticleLayoutSource([
      '> [!epigraph]',
      '> 先说明问题，再选择模型。',
      '>',
      '> ——本项目学习路径说明',
      '',
      '> 普通引用。',
    ].join('\n'));

    assert.deepEqual(result.errors, []);
    assert.match(result.text, /> \[!epigraph\]/);
    assert.match(result.text, /> 普通引用。/);
  });

  it('报告题记缺来源、非单段和中段使用警告', () => {
    const missing = prepareArticleLayoutSource('> [!epigraph]\n> 只有引文。');
    const multi = prepareArticleLayoutSource([
      '> [!epigraph]',
      '> 第一段。',
      '>',
      '> 第二段。',
      '>',
      '> ——来源',
    ].join('\n'));
    const middle = prepareArticleLayoutSource(`${'正文。\n'.repeat(14)}> [!epigraph]\n> 引文。\n>\n> ——来源`);

    assert.ok(missing.errors.some((issue) => issue.message.includes('来源')));
    assert.ok(multi.errors.some((issue) => issue.message.includes('单段')));
    assert.ok(middle.warnings.some((issue) => issue.message.includes('中段')));
  });

  it('普通 callout 仍降级，布局 callout 保留', () => {
    const result = prepareArticleLayoutSource([
      '> [!note] 普通提醒',
      '> 内容。',
      '',
      '> [!fullwidth] 宽图',
      '> ![图](svg/example.1.svg)',
    ].join('\n'));

    assert.match(result.text, /> \*\*普通提醒\*\*/);
    assert.match(result.text, /> \[!fullwidth\] 宽图/);
  });

  it('布局硬错误发生在同步写入前并保留哨兵产物', () => {
    const root = mkdtempSync(join(tmpdir(), 'wml-layout-sync-'));
    const vault = join(root, 'vault');
    const generated = join(root, 'content-zh', 'sample', 'sample.md');
    mkdirSync(vault, { recursive: true });
    mkdirSync(dirname(generated), { recursive: true });
    writeFileSync(join(root, 'sections.yaml'), ['parts: []', 'sections:', '  - dir: sample', '    entries: [sample]'].join('\n'));
    writeFileSync(join(vault, 'sample.md'), [
      '---', 'title: 测试词条', 'status: complete', '---',
      '正文。', '', '> [!marginfigure] 图注', '> ![](svg/example.1.svg)',
    ].join('\n'));
    writeFileSync(generated, 'sentinel\n');

    const result = spawnSync(process.execPath, [join(ROOT, 'scripts/sync-from-vault.mjs')], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, WHY_PROGRAMS_COMPOSE_VAULT_DIR: vault },
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /LAYOUT-ERROR/);
    assert.equal(readFileSync(generated, 'utf8'), 'sentinel\n');
  });
});
