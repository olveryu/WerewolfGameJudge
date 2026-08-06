import { FIB_USED_WORD_LIMIT, isValidFibWord } from '@game-judge/game-engine/games/fibking/public';
import { describe, expect, it } from 'vitest';

import {
  FIB_WORD_CATALOG,
  FIB_WORD_CATALOG_VERSION,
  FIB_WORD_HISTORY_LIMIT,
  FibWordCatalogExhaustedError,
  selectFibWordCatalogEntry,
} from '../wordCatalog';

describe('Fib reviewed word catalog', () => {
  it('contains enough unique reviewed Chinese entries for both history windows', () => {
    expect(FIB_WORD_CATALOG).toHaveLength(FIB_USED_WORD_LIMIT + FIB_WORD_HISTORY_LIMIT + 1);
    expect(new Set(FIB_WORD_CATALOG.map((entry) => entry.id)).size).toBe(FIB_WORD_CATALOG.length);
    expect(new Set(FIB_WORD_CATALOG.map((entry) => entry.word)).size).toBe(FIB_WORD_CATALOG.length);
    for (const catalogEntry of FIB_WORD_CATALOG) {
      expect(isValidFibWord(catalogEntry.word)).toBe(true);
      expect(catalogEntry.editorialStatus).toBe('reviewed');
      expect(catalogEntry.definition.coreMeaning).toMatch(/\p{Script=Han}/u);
      expect(catalogEntry.definition.usageNote).toMatch(/\p{Script=Han}/u);
      expect(catalogEntry.reference.url).toMatch(/^https:\/\//);
    }
  });

  it('selects deterministically without using room or participant history', async () => {
    const excludedEntries = FIB_WORD_CATALOG.slice(0, 20);
    const request = {
      avoidWords: excludedEntries.slice(0, 10).map((entry) => entry.word),
      recentWords: excludedEntries.slice(10).map((entry) => entry.word),
      selectionSeed: 'fib-round:catalog-test',
    };

    const first = await selectFibWordCatalogEntry(request);
    const second = await selectFibWordCatalogEntry(request);
    expect(second).toEqual(first);
    expect(first.catalogVersion).toBe(FIB_WORD_CATALOG_VERSION);
    expect([...request.avoidWords, ...request.recentWords]).not.toContain(first.word);
  });

  it('fails explicitly instead of falling back to a recently exposed word', async () => {
    await expect(
      selectFibWordCatalogEntry({
        avoidWords: [],
        recentWords: FIB_WORD_CATALOG.map((entry) => entry.word),
        selectionSeed: 'fib-round:exhausted',
      }),
    ).rejects.toBeInstanceOf(FibWordCatalogExhaustedError);
  });
});
