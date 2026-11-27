/**
 * One shape for every word game's category catalog; the code is the authority and D1 is its
 * projection. A catalog names the game it belongs to (any GameType); joining the shared supply
 * contract is a separate, exhaustive registration: GAME_WORD_GAMES plus WORD_CATEGORY_CATALOGS
 * (games/wordCategoryCatalogs.ts), keyed by GameWordGame.
 */
import { wordCategoryListProblems } from '../../platform/protocol/catalogIds';
import type { GameType } from '../../platform/protocol/gameTypes';

export interface WordCategoryEntry<Id extends string> {
  readonly id: Id;
  readonly name: string;
}

type NonEmpty<T> = readonly [T, ...T[]];

export interface WordCategoryCatalog<Game extends GameType, Id extends string> {
  readonly game: Game;
  /** Display and storage order; it is the `sort_order` projected into `word_categories`. */
  readonly entries: NonEmpty<WordCategoryEntry<Id>>;
  /** Category ids in entry order, ready for `z.enum`. */
  readonly ids: NonEmpty<Id>;
  readonly names: Readonly<Record<Id, string>>;
}

function hasEveryName<Id extends string>(
  names: Partial<Record<Id, string>>,
  ids: readonly Id[],
): names is Record<Id, string> {
  return ids.every((id) => typeof names[id] === 'string');
}

/**
 * Builds a catalog, failing at module load when `wordCategoryListProblems` (the single id and
 * name rule, projected into D1 by the 0095 CHECKs) finds anything.
 */
export function defineWordCategoryCatalog<const Game extends GameType, const Id extends string>(
  game: Game,
  entries: NonEmpty<WordCategoryEntry<Id>>,
): WordCategoryCatalog<Game, Id> {
  const problems = wordCategoryListProblems(entries);
  if (problems.length > 0) {
    throw new Error(`${game} word category catalog ${problems.join('; ')}`);
  }
  const [first, ...rest] = entries;
  const ids: NonEmpty<Id> = [first.id, ...rest.map((entry) => entry.id)];
  const names: Partial<Record<Id, string>> = {};
  for (const entry of entries) names[entry.id] = entry.name;
  if (!hasEveryName(names, ids)) {
    throw new Error(`${game} word category catalog is missing a name`);
  }
  return { game, entries, ids, names };
}
