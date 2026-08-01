/** FibKing contributes no game-owned product reward presentation. */

import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';

export const fibProductUi: GameProductUiContribution = {
  getAvatarDisplayName: () => null,
  getRevealEffectPresentation: () => null,
};
