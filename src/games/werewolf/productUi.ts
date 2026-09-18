/** Werewolf-owned presentation for product rewards with Werewolf semantics. */

import { getRoleDisplayName } from '@game-judge/game-engine/games/werewolf/public';
import { HAND_DRAWN_AVATAR_IDS } from '@game-judge/game-engine/product/rewards';

import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';
import { getAnimationOption } from '@/games/werewolf/components/roleRevealAnimationOptions';
import { WerewolfRevealEffectPreview } from '@/games/werewolf/components/WerewolfRevealEffectPreview';

const WEREWOLF_AVATAR_IDS: ReadonlySet<string> = new Set(HAND_DRAWN_AVATAR_IDS);

export const werewolfProductUi: GameProductUiContribution = {
  getAvatarDisplayName(avatarId) {
    if (avatarId === 'nightSovereign') return '永夜君主';
    if (avatarId === 'fateWeaver') return '司命星官';
    if (avatarId === 'tidePriestess') return '沧溟鲛姬';
    if (avatarId === 'inkImmortal') return '执笔谪仙';
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
