/**
 * Game-owned product UI (avatar names, reveal effects), keyed by game. Kept apart from the eager
 * `catalog.ts` because only the lazy product pages need it: the Home closure then carries none of
 * these loaders.
 */
import { GAME_TYPES, type GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';

const PRODUCT_UI_LOADERS: {
  readonly [TGameType in GameType]?: () => Promise<GameProductUiContribution>;
} = {
  werewolf: async () => (await import('@/games/werewolf/productUi')).werewolfProductUi,
};

/** Loads every game's product-UI contribution, in catalog order. */
export function loadGameProductUiContributions(): Promise<readonly GameProductUiContribution[]> {
  return Promise.all(
    GAME_TYPES.flatMap((gameType) => {
      const loadProductUi = PRODUCT_UI_LOADERS[gameType];
      return loadProductUi === undefined ? [] : [loadProductUi()];
    }),
  );
}
