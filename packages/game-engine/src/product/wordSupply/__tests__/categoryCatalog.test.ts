import { describe, expect, it } from 'vitest';

import { defineWordCategoryCatalog } from '../categoryCatalog';

describe('defineWordCategoryCatalog', () => {
  it('projects ids and names in entry order', () => {
    const catalog = defineWordCategoryCatalog('decrypto', [
      { id: 'b', name: '乙' },
      { id: 'a', name: '甲' },
    ]);
    expect(catalog.game).toBe('decrypto');
    expect(catalog.ids).toEqual(['b', 'a']);
    expect(catalog.names).toEqual({ b: '乙', a: '甲' });
  });

  it.each([
    [
      'a repeated id',
      [
        { id: 'a', name: '甲' },
        { id: 'a', name: '乙' },
      ],
      'repeats id "a"',
    ],
    [
      'a repeated name',
      [
        { id: 'a', name: '甲' },
        { id: 'b', name: '甲' },
      ],
      'repeats name "甲"',
    ],
    ['a blank id', [{ id: ' ', name: '甲' }], 'blank id or name'],
    ['an id with a space', [{ id: 'a b', name: '甲' }], 'invalid id "a b"'],
    ['an id starting uppercase', [{ id: 'Ab', name: '甲' }], 'invalid id "Ab"'],
    ['an id with an underscore', [{ id: 'a_b', name: '甲' }], 'invalid id "a_b"'],
    ['a blank name', [{ id: 'a', name: '' }], 'blank id or name'],
  ] as const)('rejects %s at definition time', (_label, entries, message) => {
    expect(() => defineWordCategoryCatalog('undercover', entries)).toThrow(message);
  });
});
