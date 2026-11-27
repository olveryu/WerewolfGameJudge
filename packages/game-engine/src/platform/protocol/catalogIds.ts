/**
 * Shape rules for the catalog keys D1 stores in `game_types.id`, `word_categories.id` and
 * `word_categories.name`. This file is the single authority: the CHECK constraints in migration
 * 0095 are their SQLite projection, and `contracts/d1Catalog.contract.test.ts` sweeps every
 * BMP code point to prove code and D1 accept and reject the same values.
 *
 * Ids are also TypeScript identifiers, file and directory names, env binding names (upper-cased)
 * and workflow names, hence ASCII letters and digits only.
 *
 * Dependency-free on purpose: `scripts/new-game` imports this file directly under Node's type
 * stripping, so it may hold only erasable TypeScript and no imports.
 */

/** A lowercase ASCII letter, then lowercase letters or digits; 2–32 characters (`decrypto`). */
export const GAME_ID_PATTERN = /^[a-z][a-z0-9]{1,31}$/;
export const GAME_ID_RULE = 'a lowercase letter, then lowercase letters or digits, 2-32 characters';

/** A lowercase ASCII letter, then letters or digits (camelCase); 2–40 characters (`dailyObjects`). */
export const WORD_CATEGORY_ID_PATTERN = /^[a-z][a-zA-Z0-9]{1,39}$/;
export const WORD_CATEGORY_ID_RULE =
  'a lowercase letter, then letters or digits (camelCase), 2-40 characters';

// NUL truncates SQLite text (length(), GLOB and trim stop at it), so no key or name carries it.
const NUL = '\u0000';
// A lone surrogate is not Unicode text and cannot round-trip through SQLite's UTF-8 storage
// (node:sqlite stores U+FFFD, workerd's D1 stores invalid UTF-8), so the name would change.
const LONE_SURROGATE = /\p{Cs}/u;

export const CATALOG_NAME_RULE =
  'non-empty, no leading or trailing whitespace, no NUL, no lone surrogate';

export function isWellFormedGameId(value: string): boolean {
  return GAME_ID_PATTERN.test(value);
}

export function isWellFormedWordCategoryId(value: string): boolean {
  return WORD_CATEGORY_ID_PATTERN.test(value);
}

/** A display name stored in `word_categories.name`; whitespace is what `String#trim` strips. */
export function isWellFormedCatalogName(value: string): boolean {
  return (
    value !== '' && value === value.trim() && !value.includes(NUL) && !LONE_SURROGATE.test(value)
  );
}

export interface WordCategoryInput {
  readonly id: string;
  readonly name: string;
}

/**
 * Every problem with a word category list, in entry order; empty when it can become a catalog
 * and its `word_categories` rows. `defineWordCategoryCatalog` throws on these and the
 * new-game generator refuses to write files on them, so both enforce the same rule.
 */
export function wordCategoryListProblems(entries: readonly WordCategoryInput[]): string[] {
  if (entries.length === 0) return ['has no categories'];
  const problems: string[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const { id, name } of entries) {
    if (!isWellFormedWordCategoryId(id)) {
      problems.push(`has a malformed id ${JSON.stringify(id)} (${WORD_CATEGORY_ID_RULE})`);
    }
    if (!isWellFormedCatalogName(name)) {
      problems.push(
        `has a malformed name ${JSON.stringify(name)} for id ${JSON.stringify(id)} (${CATALOG_NAME_RULE})`,
      );
    }
    if (ids.has(id)) problems.push(`repeats id ${JSON.stringify(id)}`);
    if (names.has(name)) problems.push(`repeats name ${JSON.stringify(name)}`);
    ids.add(id);
    names.add(name);
  }
  return problems;
}
