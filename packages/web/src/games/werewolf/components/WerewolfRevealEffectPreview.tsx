/** Product-facing preview of a Werewolf role reveal effect, played full screen. */
import type { RevealEffectPreviewProps } from '@/features/product/model/GameProductUi';
import { RoleRevealAnimator } from '@/features/room/components/RoleRevealEffects/RoleRevealAnimator';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

import { toRevealRoleData } from './WerewolfRoleCardAdapter';

const PREVIEW_ROLE = toRevealRoleData('villager');
const PREVIEW_ROLES: readonly RevealRoleData[] = [
  PREVIEW_ROLE,
  toRevealRoleData('wolf'),
  toRevealRoleData('seer'),
  toRevealRoleData('witch'),
  toRevealRoleData('hunter'),
  toRevealRoleData('guard'),
];

/**
 * Plays `effectId` for a villager among six roles through the room's own reveal dialog, so the
 * preview stacks above the page, traps focus and locks scroll exactly as the real reveal does.
 * Like the room's reveal it ends only when the effect completes.
 */
export function WerewolfRevealEffectPreview({ effectId, onComplete }: RevealEffectPreviewProps) {
  return (
    <RoleRevealAnimator
      effectType={effectId}
      role={PREVIEW_ROLE}
      allRoles={PREVIEW_ROLES}
      onComplete={onComplete}
    />
  );
}
