import { describe, expect, it } from 'vitest';

import { defineWordCategoryCatalog } from '../categoryCatalog';

describe('defineWordCategoryCatalog', () => {
  it('projects ids and names in entry order', () => {
    const catalog = defineWordCategoryCatalog('decrypto', [
      { id: 'bb', name: '乙' },
      { id: 'aa', name: '甲' },
    ]);
    expect(catalog.game).toBe('decrypto');
    expect(catalog.ids).toEqual(['bb', 'aa']);
    expect(catalog.names).toEqual({ bb: '乙', aa: '甲' });
  });

  it.each([
    [
      'a repeated id',
      [
        { id: 'aa', name: '甲' },
        { id: 'aa', name: '乙' },
      ],
      'repeats id "aa"',
    ],
    [
      'a repeated name',
      [
        { id: 'aa', name: '甲' },
        { id: 'bb', name: '甲' },
      ],
      'repeats name "甲"',
    ],
    ['a blank id', [{ id: ' ', name: '甲' }], 'malformed id " "'],
    ['an id with a space', [{ id: 'a b', name: '甲' }], 'malformed id "a b"'],
    ['an id starting uppercase', [{ id: 'Ab', name: '甲' }], 'malformed id "Ab"'],
    ['an id with an underscore', [{ id: 'a_b', name: '甲' }], 'malformed id "a_b"'],
    ['a one-character id', [{ id: 'a', name: '甲' }], 'malformed id "a"'],
    ['a 41-character id', [{ id: `a${'b'.repeat(40)}`, name: '甲' }], 'malformed id'],
    ['a blank name', [{ id: 'ab', name: '' }], 'malformed name ""'],
    ['a padded name', [{ id: 'ab', name: '甲\u3000' }], 'malformed name "甲\u3000"'],
  ] as const)('rejects %s at definition time', (_label, entries, message) => {
    expect(() => defineWordCategoryCatalog('undercover', entries)).toThrow(message);
  });
});
