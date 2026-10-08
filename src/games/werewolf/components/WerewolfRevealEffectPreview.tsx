/** Product-facing preview boundary for Werewolf role reveal effects. */

import type React from 'react';

import type { RevealEffectPreviewProps } from '@/features/product/model/GameProductUi';
import { RoleRevealAnimator } from '@/features/room/components/RoleRevealEffects/RoleRevealAnimator';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

const PREVIEW_ROLE: RevealRoleData = { id: 'villager', name: '村民', alignment: 'villager' };
const PREVIEW_ROLES: RevealRoleData[] = [
  PREVIEW_ROLE,
  { id: 'wolf', name: '狼人', alignment: 'wolf' },
  { id: 'seer', name: '预言家', alignment: 'god' },
  { id: 'witch', name: '女巫', alignment: 'god' },
  { id: 'hunter', name: '猎人', alignment: 'god' },
  { id: 'guard', name: '守卫', alignment: 'god' },
];

export const WerewolfRevealEffectPreview: React.FC<RevealEffectPreviewProps> = ({
  effectId,
  onComplete,
}) => (
  <RoleRevealAnimator
    visible
    effectType={effectId}
    role={PREVIEW_ROLE}
    allRoles={PREVIEW_ROLES}
    onComplete={onComplete}
    enableHaptics={false}
  />
);
