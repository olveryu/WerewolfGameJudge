/**
 * Full-screen role reveal: the dialog, the backdrop and the DOM title. The canvas and the effect
 * live in the lazy RevealEffectStage chunk, reached through RoomSeatScene for the reason given
 * there, so neither the room chunk nor the seat-scene chunk carries any effect. Only room code
 * may import this module: an importer outside the room's chunks (the scene bench, say) splits it
 * into its own chunk, and its Ark Portal import then makes Rolldown split react-dom off the
 * start-up chunk, pushing the home route over its budget.
 */
import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { lazy, Suspense } from 'react';

import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';

import {
  REVEAL_ROOT_STYLE,
  REVEAL_TITLE_ROW_STYLE,
  REVEAL_TITLE_STYLE,
  revealTitle,
} from './common/shell';
import type { RevealEffectProps, RevealEffectType, RoleRevealAnimatorProps } from './types';

const loadRevealEffectStage = () =>
  import('../RoomSeatScene').then((module) => module.loadRevealEffectStage());
const RevealEffectStage = lazy(loadRevealEffectStage);

/**
 * Starts fetching the reveal stage chunk and effect `id` before the reveal opens (the previous
 * client warmed its shaders ahead of the first reveal for the same reason). Load failures surface
 * where the reveal renders them.
 */
export function prefetchRoleReveal(id: RevealEffectType): void {
  void loadRevealEffectStage().then((module) => module.prefetchRevealEffect(id));
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
