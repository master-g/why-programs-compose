import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLearningPaths } from '../../src/lib/learning-paths.mjs';
import {
  getArticleNavigation,
  getNextAvailableSlug,
  getSectionPathContext,
} from '../../src/lib/article-navigation.mjs';

function availableSet(paths) {
  return new Set(
    [...paths.entryIndex.values()].filter((entry) => entry.available).map((entry) => entry.slug),
  );
}

describe('article navigation', () => {
  it('skips unfinished entries and links to the next available article', () => {
    const next = getNextAvailableSlug(
      ['written', 'todo-a', 'todo-b', 'next-written'],
      'written',
      new Set(['written', 'next-written']),
    );
    assert.equal(next, 'next-written');
  });

  it('returns no link when the remaining entries are unfinished', () => {
    const next = getNextAvailableSlug(
      ['written', 'todo-a', 'todo-b'],
      'written',
      new Set(['written']),
    );
    assert.equal(next, undefined);
  });

  it('returns no link when the current slug is outside the section', () => {
    const next = getNextAvailableSlug(['written'], 'missing', new Set(['written']));
    assert.equal(next, undefined);
  });

  it('keeps a mainline article on mainline navigation with its stage id', () => {
    const paths = getLearningPaths();
    const navigation = getArticleNavigation(paths, {
      slug: 'category',
      sectionEntries: paths.sections.get('categories').entries,
      availableSlugs: availableSet(paths),
    });

    assert.equal(navigation.mode, 'mainline');
    assert.equal(navigation.stageId, 'categories');
    assert.equal(navigation.hrefQuery, undefined);
  });

  it('keeps reference-track articles on chapter navigation only', () => {
    const paths = getLearningPaths();
    const reference = getArticleNavigation(paths, {
      slug: 'topos',
      sectionEntries: paths.sections.get('further').entries,
      availableSlugs: availableSet(paths),
    });

    assert.equal(reference.mode, 'catalog-only');
    assert.equal(reference.nextSlug, undefined);
  });

  it('exposes a category role only when a section has a configured path', () => {
    const paths = getLearningPaths();
    const categories = getSectionPathContext(paths, 'categories');
    const further = getSectionPathContext(paths, 'further');

    assert.equal(categories.mainlineStage.id, 'categories');
    assert.deepEqual(categories.backfillGroups, []);
    assert.equal(further.mainlineStage, undefined);
    assert.deepEqual(further.backfillGroups, []);
  });

  it('groups the notation chapter by the reader action without changing outline order', () => {
    const paths = getLearningPaths();
    const notation = getSectionPathContext(paths, 'notation');

    assert.deepEqual(
      notation.mathGroups.map((group) => ({
        layer: group.layer,
        actionLabel: group.actionLabel,
        slugs: group.entries.map((entry) => entry.slug),
      })),
      [
        {
          layer: 'core',
          actionLabel: '现在读',
          slugs: ['sets-and-functions', 'haskell-notation', 'rust-type-system'],
        },
      ],
    );
    assert.deepEqual(
      notation.mathGroups[0].entries.map((entry) => entry.indexInSection),
      [0, 1, 2],
    );
  });

  it('does not invent math groups for a non-math chapter', () => {
    const paths = getLearningPaths();
    const monads = getSectionPathContext(paths, 'monads');

    assert.deepEqual(monads.mathGroups, []);
  });
});
