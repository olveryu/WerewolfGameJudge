/** Pictionary contributes no game-owned product reward presentation. */

import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';

export const pictionaryProductUi: GameProductUiContribution = {
  getAvatarDisplayName: () => null,
  getRevealEffectPresentation: () => null,
};
