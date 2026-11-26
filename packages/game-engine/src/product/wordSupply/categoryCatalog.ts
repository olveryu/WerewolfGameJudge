/** One shape for every word game's category catalog; the code is the authority and D1 is its projection. */
import type { GameWordGame } from './games';

export interface WordCategoryEntry<Id extends string> {
  readonly id: Id;
  readonly name: string;
}

type NonEmpty<T> = readonly [T, ...T[]];

export interface WordCategoryCatalog<Game extends GameWordGame, Id extends string> {
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

/** Builds a catalog, failing at module load on an empty, blank, or duplicate id or name. */
export function defineWordCategoryCatalog<const Game extends GameWordGame, const Id extends string>(
  game: Game,
  entries: NonEmpty<WordCategoryEntry<Id>>,
): WordCategoryCatalog<Game, Id> {
  const [first, ...rest] = entries;
  const ids: NonEmpty<Id> = [first.id, ...rest.map((entry) => entry.id)];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const names: Partial<Record<Id, string>> = {};
  for (const entry of entries) {
    if (entry.id.trim() === '' || entry.name.trim() === '') {
      throw new Error(`${game} word category catalog has a blank id or name`);
    }
    if (seenIds.has(entry.id)) {
      throw new Error(`${game} word category catalog repeats id "${entry.id}"`);
    }
    if (seenNames.has(entry.name)) {
      throw new Error(`${game} word category catalog repeats name "${entry.name}"`);
    }
    seenIds.add(entry.id);
    seenNames.add(entry.name);
    names[entry.id] = entry.name;
  }
  if (!hasEveryName(names, ids)) {
    throw new Error(`${game} word category catalog is missing a name`);
  }
  return { game, entries, ids, names };
}
