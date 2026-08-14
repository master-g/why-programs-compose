import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { getLearningPaths } from '../../src/lib/learning-paths.mjs';
import {
  buildInitialTufteManifest,
  mergeTufteOptimizationManifest,
  validateTufteOptimizationManifest,
} from '../../scripts/lib/tufte-optimization-manifest.mjs';

const outline = yaml.load(readFileSync('sections.yaml', 'utf8'));
const manifest = yaml.load(readFileSync('docs/qa/tufte-optimization/manifest.yaml', 'utf8'));
const learningPaths = getLearningPaths();

function clone(value) {
  return structuredClone(value);
}

function validate(candidate) {
  return validateTufteOptimizationManifest({
    manifest: candidate,
    sections: outline.sections,
    knownAbsent: outline.known_absent,
    learningPaths,
  });
}

function freshManifest() {
  return buildInitialTufteManifest({
    sections: outline.sections,
    knownAbsent: outline.known_absent,
    learningPaths,
  });
}

describe('Tufte optimization manifest', () => {
  it('keeps every completed outline entry exactly once with its derived learning role', () => {
    const result = validate(manifest);

    assert.equal(result.entries.length, 274);
    assert.deepEqual(result.counts, {
      'first-pass-core': 17,
      'first-pass-mainline': 155,
      'math-backfill': 56,
      'optional-branch': 25,
      'math-reference': 21,
      'advanced-reference': 0,
    });
    assert.equal(new Set(result.entries.map((entry) => entry.slug)).size, 274);
    const stateCounts = result.entries.reduce((counts, entry) => {
      counts[entry.review_state] = (counts[entry.review_state] || 0) + 1;
      return counts;
    }, {});
    assert.equal(Object.values(stateCounts).reduce((sum, count) => sum + count, 0), 274);
    assert.equal(stateCounts.changed >= 3, true);
    assert.equal(stateCounts['reviewed-no-change'] >= 1, true);
    assert.equal(stateCounts.pending || 0, 0, '存量台账仍有 pending 词条');
    assert.equal(stateCounts.deferred || 0, 0, '存量台账仍有 deferred 词条');
    for (const entry of result.entries) {
      for (const evidence of entry.visual_evidence) {
        assert.equal(existsSync(evidence), true, `${entry.slug}: 视觉证据不存在: ${evidence}`);
      }
    }
  });

  it('builds a deterministic pending inventory without overwriting the live manifest', () => {
    const generated = buildInitialTufteManifest({
      sections: outline.sections,
      knownAbsent: outline.known_absent,
      learningPaths,
    });

    assert.equal(generated.entries.length, 274);
    assert.equal(generated.entries.every((entry) => entry.review_state === 'pending'), true);
    assert.deepEqual(
      mergeTufteOptimizationManifest({ current: manifest, initial: generated }),
      manifest,
    );
  });

  it('preserves completed review fields when refreshing the inventory', () => {
    const current = clone(manifest);
    Object.assign(current.entries[0], {
      review_state: 'reviewed-no-change',
      rationale: '正文需要连续阅读。',
      batch: 'calibration-01',
    });
    const initial = buildInitialTufteManifest({
      sections: outline.sections,
      knownAbsent: outline.known_absent,
      learningPaths,
    });

    const merged = mergeTufteOptimizationManifest({ current, initial });
    assert.deepEqual(merged.entries[0], current.entries[0]);

    const stale = clone(current);
    stale.entries.push({ ...clone(stale.entries[0]), slug: 'removed-or-unknown' });
    assert.throws(
      () => mergeTufteOptimizationManifest({ current: stale, initial }),
      /无法自动移除台账记录.*removed-or-unknown/,
    );
  });

  it('rejects missing, duplicate, unknown, and known-absent slugs', () => {
    const missing = clone(manifest);
    missing.entries.pop();
    assert.throws(() => validate(missing), /台账遗漏/);

    const duplicate = clone(manifest);
    duplicate.entries.push(clone(duplicate.entries[0]));
    assert.throws(() => validate(duplicate), /重复 slug/);

    const unknown = clone(manifest);
    unknown.entries[0].slug = 'not-an-outline-slug';
    assert.throws(() => validate(unknown), /未知 slug/);

    const absent = clone(manifest);
    absent.entries[0].slug = outline.known_absent[0];
    assert.throws(() => validate(absent), /known_absent/);
  });

  it('rejects role drift and incomplete final review records', () => {
    const wrongRole = freshManifest();
    wrongRole.entries[0].learning_role = 'optional-branch';
    assert.throws(() => validate(wrongRole), /学习角色不一致/);

    const noChangeWithoutReason = freshManifest();
    noChangeWithoutReason.entries[0].review_state = 'reviewed-no-change';
    assert.throws(() => validate(noChangeWithoutReason), /保持现状.*理由/);

    const noChangeWithoutEvidence = freshManifest();
    Object.assign(noChangeWithoutEvidence.entries[0], {
      review_state: 'reviewed-no-change',
      rationale: '正文需要连续阅读。',
      batch: 'calibration-01',
    });
    assert.throws(() => validate(noChangeWithoutEvidence), /视觉证据/);

    const changedWithoutEvidence = freshManifest();
    Object.assign(changedWithoutEvidence.entries[0], {
      review_state: 'changed',
      decision: ['marginfigure'],
      rationale: '辅助图在页边提供局部几何直觉。',
      batch: 'calibration-01',
      source_updated: '2026-08-12',
    });
    assert.throws(() => validate(changedWithoutEvidence), /视觉证据/);
  });

  it('accepts complete no-change and changed records', () => {
    const candidate = freshManifest();
    Object.assign(candidate.entries[0], {
      review_state: 'reviewed-no-change',
      rationale: '定义和数字例子需要连续阅读，页边内容没有独立教学职责。',
      batch: 'calibration-01',
      visual_evidence: ['docs/qa/tufte-optimization/calibration-01.md'],
    });
    Object.assign(candidate.entries[1], {
      review_state: 'changed',
      decision: ['sidenote', 'marginfigure'],
      rationale: '来源需要精确锚点，辅助图在 240 px 下仍可辨认。',
      batch: 'calibration-01',
      source_updated: '2026-08-12',
      visual_evidence: ['docs/qa/tufte-optimization/calibration-01.md'],
    });

    const result = validate(candidate);
    assert.equal(result.entries[0].review_state, 'reviewed-no-change');
    assert.equal(result.entries[1].review_state, 'changed');
  });
});
