/**
 * Full-screen role reveal: dialog, backdrop, DOM title and the scene overlay.
 */
import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { Suspense } from 'react';

import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';

import {
  REVEAL_ROOT_STYLE,
  REVEAL_TITLE_ROW_STYLE,
  REVEAL_TITLE_STYLE,
  revealTitle,
} from './common/shell';
import RevealEffectStage, { prefetchRevealEffect } from './RevealEffectStage';
import type { RevealEffectProps, RevealEffectType, RoleRevealAnimatorProps } from './types';

/**
 * Prepares the cached effect promise ahead of the reveal. Effect code is already available.
 */
export function prefetchRoleReveal(id: RevealEffectType): void {
  prefetchRevealEffect(id);
}

/** Plays `effectType` for `role` over the whole screen, then calls `onComplete` once. */
export function RoleRevealAnimator({
  effectType,
  role,
  onComplete,
  reducedMotion: reducedMotionOverride,
  testIDPrefix = 'role-reveal',
  allRoles,
  remainingCards,
}: RoleRevealAnimatorProps) {
  const systemReducedMotion = usePrefersReducedMotion();
  const effectProps: RevealEffectProps = {
    role,
    onComplete,
    reducedMotion: reducedMotionOverride ?? systemReducedMotion,
    testIDPrefix,
    allRoles: allRoles ?? [role],
    remainingCards,
  };
  return (
    <Dialog.Root open closeOnInteractOutside={false} closeOnEscape={false}>
      <Portal>
        <Dialog.Content data-testid={`${testIDPrefix}-modal`} style={REVEAL_ROOT_STYLE}>
          <div style={REVEAL_TITLE_ROW_STYLE}>
            <Dialog.Title style={REVEAL_TITLE_STYLE}>{revealTitle(effectType)}</Dialog.Title>
          </div>
          <Suspense fallback={null}>
            <RevealEffectStage effectType={effectType} effectProps={effectProps} />
          </Suspense>
        </Dialog.Content>
      </Portal>
    </Dialog.Root>
  );
}
