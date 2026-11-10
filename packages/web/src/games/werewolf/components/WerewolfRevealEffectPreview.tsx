/** Product-facing preview of a Werewolf role reveal effect, played full screen. */
import { lazy, Suspense, useId } from 'react';

import type { RevealEffectPreviewProps } from '@/features/product/model/GameProductUi';
import {
  REVEAL_ROOT_STYLE,
  REVEAL_TITLE_ROW_STYLE,
  REVEAL_TITLE_STYLE,
  revealTitle,
} from '@/features/room/components/RoleRevealEffects/common/shell';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';

// The room's RoleRevealAnimator is room-only (importing it elsewhere moves its dialog portal into
// a shared chunk), so the preview draws the same shell itself, like the scene bench.
const RevealEffectStage = lazy(() =>
  import('@/features/room/components/RoomSeatScene').then((module) =>
    module.loadRevealEffectStage(),
  ),
);

const PREVIEW_ROLE: RevealRoleData = { id: 'villager', name: '村民', alignment: 'villager' };
const PREVIEW_ROLES: readonly RevealRoleData[] = [
  PREVIEW_ROLE,
  { id: 'wolf', name: '狼人', alignment: 'wolf' },
  { id: 'seer', name: '预言家', alignment: 'god' },
  { id: 'witch', name: '女巫', alignment: 'god' },
  { id: 'hunter', name: '猎人', alignment: 'god' },
  { id: 'guard', name: '守卫', alignment: 'god' },
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
