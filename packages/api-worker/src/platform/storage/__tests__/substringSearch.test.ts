import { describe, expect, it } from 'vitest';

import { containsIgnoringAsciiCase } from '../substringSearch';

describe('containsIgnoringAsciiCase', () => {
  it('refuses an empty term, which would match every row', () => {
    expect(() => containsIgnoringAsciiCase('u.display_name', '')).toThrow(
      'Substring search on u.display_name needs a non-empty term',
    );
  });
});
