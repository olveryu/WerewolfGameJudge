/** Werewolf-owned presentation for product rewards with Werewolf semantics. */

import { HAND_DRAWN_AVATAR_IDS } from '@werewolf/game-engine/growth/rewardCatalog';
import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';

import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';
import { getAnimationOption } from '@/games/werewolf/components/roleRevealAnimationOptions';
import { WerewolfRevealEffectPreview } from '@/games/werewolf/components/WerewolfRevealEffectPreview';

const WEREWOLF_AVATAR_IDS: ReadonlySet<string> = new Set(HAND_DRAWN_AVATAR_IDS);

export const werewolfProductUi: GameProductUiContribution = {
  getAvatarDisplayName(avatarId) {
    return WEREWOLF_AVATAR_IDS.has(avatarId) ? getRoleDisplayName(avatarId) : null;
  },
  getRevealEffectPresentation(effectId) {
    const option = getAnimationOption(effectId);
    if (option === undefined) return null;
    return {
      id: option.value,
      label: option.label,
      icon: option.icon,
      shortDescription: option.shortDesc,
      Preview: WerewolfRevealEffectPreview,
    };
  },
};
