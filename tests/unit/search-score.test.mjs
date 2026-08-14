import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreEntry } from '../../src/lib/search-score.mjs';

function entry(overrides = {}) {
  return {
    title_zh: '导数',
    title_en: 'Derivative',
    keywords_zh: ['微分', '变化率'],
    tags: ['calculus'],
    ...overrides,
  };
}

describe('scoreEntry', () => {
  it('exact match beats prefix beats substring beats no match', () => {
    const exact = entry({ title_zh: '导数' });
    const prefix = entry({ title_zh: '导数的应用' });
    const substring = entry({ title_zh: '函数的导数' });
    const none = entry({ title_zh: '积分' });
    const q = '导数';
    assert.ok(scoreEntry(exact, q) > scoreEntry(prefix, q));
    assert.ok(scoreEntry(prefix, q) > scoreEntry(substring, q));
    assert.ok(scoreEntry(substring, q) > scoreEntry(none, q));
    assert.equal(scoreEntry(none, q), 0);
  });

  it('field weight ordering: title_zh > title_en > keywords_zh > tags', () => {
    const inTitleZh = entry({ title_zh: '几何意义', title_en: 'Other', keywords_zh: [], tags: [] });
    const inTitleEn = entry({ title_zh: '其他', title_en: '几何意义', keywords_zh: [], tags: [] });
    const inKeywords = entry({ title_zh: '其他', title_en: 'Other', keywords_zh: ['几何意义'], tags: [] });
    const inTags = entry({ title_zh: '其他', title_en: 'Other', keywords_zh: [], tags: ['几何意义'] });
    const q = '几何意义';
    assert.ok(scoreEntry(inTitleZh, q) > scoreEntry(inTitleEn, q));
    assert.ok(scoreEntry(inTitleEn, q) > scoreEntry(inKeywords, q));
    assert.ok(scoreEntry(inKeywords, q) > scoreEntry(inTags, q));
  });

  it('empty query returns zero/neutral score', () => {
    const e = entry();
    assert.equal(scoreEntry(e, ''), 0);
    assert.equal(scoreEntry(e, '   '), 0);
  });

  it('entries with null title_zh do not throw and still rank by other fields', () => {
    const e = entry({ title_zh: null });
    assert.doesNotThrow(() => scoreEntry(e, '微分'));
    assert.ok(scoreEntry(e, '微分') > 0);
  });

  it('tie-break by localeCompare is deterministic across identical entries', () => {
    const a = entry({ title_zh: '导数' });
    const b = entry({ title_zh: '导数' });
    const scoreA = scoreEntry(a, '导数');
    const scoreB = scoreEntry(b, '导数');
    assert.equal(scoreA, scoreB);
  });
});
