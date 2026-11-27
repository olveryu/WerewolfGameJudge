/**
 * Exhaustive word-category catalog per word game: the single composition of the game-owned
 * catalogs. The Worker (admin stats, D1 boundary parsing), the admin mock and the D1 catalog
 * contract all read this map, so a new word game is registered here once and `GameWordGame`
 * exhaustiveness names every consumer that still lacks it.
 */
import type { WordCategoryCatalog } from '../product/wordSupply/categoryCatalog';
import type { GameWordGame } from '../product/wordSupply/games';
import { DECRYPTO_WORD_CATEGORY_CATALOG } from './decrypto/wordCategories';
import { DRAWGUESS_WORD_CATEGORY_CATALOG } from './drawguess/wordCategories';
import { FIBKING_WORD_CATEGORY_CATALOG } from './fibking/wordCategories';
import { UNDERCOVER_WORD_CATEGORY_CATALOG } from './undercover/wordCategories';

export const WORD_CATEGORY_CATALOGS: {
  readonly [TGame in GameWordGame]: WordCategoryCatalog<TGame, string>;
} = {
  fibking: FIBKING_WORD_CATEGORY_CATALOG,
  undercover: UNDERCOVER_WORD_CATEGORY_CATALOG,
  drawguess: DRAWGUESS_WORD_CATEGORY_CATALOG,
  decrypto: DECRYPTO_WORD_CATEGORY_CATALOG,
};
