/** Product-facing preview of a Werewolf role reveal effect, played full screen. */
import { Suspense, useId } from 'react';

import type { RevealEffectPreviewProps } from '@/features/product/model/GameProductUi';
import {
  REVEAL_ROOT_STYLE,
  REVEAL_TITLE_ROW_STYLE,
  REVEAL_TITLE_STYLE,
  revealTitle,
} from '@/features/room/components/RoleRevealEffects/common/shell';
import RevealEffectStage from '@/features/room/components/RoleRevealEffects/RevealEffectStage';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';

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

/** Plays `effectId` for a villager among six roles and reports completion. */
export function WerewolfRevealEffectPreview({ effectId, onComplete }: RevealEffectPreviewProps) {
  const reducedMotion = usePrefersReducedMotion();
  const titleId = useId();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="role-reveal-modal"
      style={REVEAL_ROOT_STYLE}
    >
      <div style={REVEAL_TITLE_ROW_STYLE}>
        <h2 id={titleId} style={REVEAL_TITLE_STYLE}>
          {revealTitle(effectId)}
        </h2>
      </div>
      <Suspense fallback={null}>
        <RevealEffectStage
          effectType={effectId}
          effectProps={{
            role: PREVIEW_ROLE,
            allRoles: PREVIEW_ROLES,
            reducedMotion,
            testIDPrefix: 'role-reveal',
            onComplete,
          }}
        />
      </Suspense>
    </div>
  );
}
