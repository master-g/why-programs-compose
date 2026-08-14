import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSlugMap } from '../../src/lib/slug-map.mjs';

describe('slug-map', () => {
  it('throws on slug collision and names the slug', () => {
    assert.throws(
      () =>
        buildSlugMap(
          { source: 'collection-entries', entries: [
            { id: 'transformer/self-attention' },
            { id: 'modern-llm/self-attention' },
          ], silent: true },
        ),
      /slug collision: self-attention/,
    );
  });
});
