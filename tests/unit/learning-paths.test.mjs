import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import {
  getLearningPaths,
  validateLearningPathData,
} from '../../src/lib/learning-paths.mjs';
import { getKnownAbsent, getSections } from '../../src/lib/sections.mjs';

const source = yaml.load(readFileSync('learning-paths.yaml', 'utf8'));

function clone(value) {
  return structuredClone(value);
}

describe('learning path contract', () => {
  it('expands the notation group as the first mainline stage in declared order', () => {
    const paths = getLearningPaths();
    const coreEntries = paths.math.layers.core.entries;
    const core = coreEntries.map((entry) => entry.slug);
    const firstStage = paths.path.mainline.stages[0];

    assert.deepEqual(core, ['sets-and-functions', 'haskell-notation', 'rust-type-system']);
    assert.deepEqual(firstStage.entries.map((entry) => entry.slug), core);
    assert.deepEqual(firstStage.mathGroups, ['notation']);
    assert.equal(new Set(core).size, core.length);
    assert.equal(coreEntries.every((entry) => entry.why_now_zh && entry.reading_goal_zh), true);
  });

  it('partitions every foundations-part slug across the math layers without overlap', () => {
    const paths = getLearningPaths();
    const foundationSlugs = getSections()
      .filter((section) => section.part === 'foundations')
      .flatMap((section) => section.entries);
    assert.deepEqual([...paths.math.allSlugs].sort(), [...foundationSlugs].sort());
    assert.equal(new Set(paths.math.allSlugs).size, paths.math.allSlugs.length);
  });

  it('covers every non-reference-track section in the mainline exactly once', () => {
    const paths = getLearningPaths();
    const mainline = paths.path.mainline.slugs;
    assert.equal(new Set(mainline).size, mainline.length);

    const referenceSections = new Set(
      paths.path.referenceTracks.flatMap((track) => track.sections || []),
    );
    const expected = getSections()
      .filter((section) => section.part !== 'foundations' && !referenceSections.has(section.dir))
      .flatMap((section) => section.entries);
    const mainlineSet = new Set(mainline);
    for (const slug of expected) {
      assert.equal(mainlineSet.has(slug), true, `主线缺少 ${slug}`);
    }
  });

  it('creates stable previous/next links for mainline entries', () => {
    const paths = getLearningPaths();
    const entries = paths.path.mainline.entries;
    assert.equal(entries[0].previousSlug, undefined);
    assert.equal(entries.at(-1).nextSlug, undefined);
    assert.equal(entries[0].nextSlug, entries[1].slug);
    assert.equal(entries[1].previousSlug, entries[0].slug);
  });

  it('derives availability from known_absent', () => {
    const paths = getLearningPaths();
    const absent = new Set(getKnownAbsent());
    for (const entry of paths.path.mainline.entries) {
      assert.equal(entry.available, !absent.has(entry.slug), `availability 不一致: ${entry.slug}`);
    }
  });

  it('reports missing, duplicate, and unknown math references', () => {
    const base = { sections: getSections(), knownAbsent: getKnownAbsent() };

    const missing = clone(source);
    missing.math_layers.core.groups[0].entries.pop();
    assert.throws(
      () => validateLearningPathData({ ...base, data: missing }),
      /rust-type-system|数学分区遗漏/,
    );

    const duplicate = clone(source);
    duplicate.math_layers.reference.entries.push('sets-and-functions');
    assert.throws(
      () => validateLearningPathData({ ...base, data: duplicate }),
      /sets-and-functions|重复/,
    );

    const unknown = clone(source);
    unknown.math_layers.reference.entries.push('not-an-outline-slug');
    assert.throws(
      () => validateLearningPathData({ ...base, data: unknown }),
      /not-an-outline-slug|未知数学 slug/,
    );
  });

  it('reports unknown section selectors and missing mainline articles', () => {
    const base = { sections: getSections(), knownAbsent: getKnownAbsent() };
    const badSection = clone(source);
    badSection.paths['first-pass'].stages[1].sections.push('no-such-section');
    assert.throws(
      () => validateLearningPathData({ ...base, data: badSection }),
      /no-such-section/,
    );
  });
});
