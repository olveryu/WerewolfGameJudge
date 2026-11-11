/**
 * Game-owned product UI (avatar names, reveal effects), keyed by game. Code is statically
 * imported; product pages compose the contributions only when needed.
 */
import { GAME_TYPES, type GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';
import { werewolfProductUi } from '@/games/werewolf/productUi';

const PRODUCT_UI_LOADERS: {
  readonly [TGameType in GameType]?: () => Promise<GameProductUiContribution>;
} = {
  werewolf: async () => werewolfProductUi,
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
