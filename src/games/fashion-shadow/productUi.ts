// Fashion Shadow contributes no game-owned product reward presentation in v1.

import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';

export const fashionProductUi: GameProductUiContribution = {
  getAvatarDisplayName: () => null,
  getRevealEffectPresentation: () => null,
};
