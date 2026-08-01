/** Product-facing preview boundary for Werewolf role reveal effects. */

import type React from 'react';

import type { RevealEffectPreviewProps } from '@/features/product/model/GameProductUi';

import { createRoleData, RoleRevealAnimator } from './RoleRevealEffects';

const PREVIEW_ROLE = createRoleData('villager', '村民', 'villager');
const PREVIEW_ROLES = [
  PREVIEW_ROLE,
  createRoleData('wolf', '狼人', 'wolf'),
  createRoleData('seer', '预言家', 'god'),
  createRoleData('witch', '女巫', 'god'),
  createRoleData('hunter', '猎人', 'god'),
  createRoleData('guard', '守卫', 'god'),
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
