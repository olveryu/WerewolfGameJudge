/**
 * Full-screen role reveal: dialog, backdrop, DOM title and the scene overlay.
 */
import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { Suspense, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/Button';
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
  dismissible = false,
}: RoleRevealAnimatorProps) {
  const systemReducedMotion = usePrefersReducedMotion();
  const [sceneAvailable, setSceneAvailable] = useState(true);
  const fallbackButtonRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!sceneAvailable) fallbackButtonRef.current?.focus();
  }, [sceneAvailable]);
  const effectProps: RevealEffectProps = {
    role,
    onComplete,
    reducedMotion: reducedMotionOverride ?? systemReducedMotion,
    testIDPrefix,
    allRoles: allRoles ?? [role],
    remainingCards,
  };
  return (
    <Dialog.Root
      open
      closeOnInteractOutside={false}
      closeOnEscape={dismissible}
      onOpenChange={({ open }) => {
        if (!open) onComplete();
      }}
    >
      <Portal>
        <Dialog.Content data-testid={`${testIDPrefix}-modal`} style={REVEAL_ROOT_STYLE}>
          <div style={REVEAL_TITLE_ROW_STYLE}>
            <Dialog.Title style={REVEAL_TITLE_STYLE}>{revealTitle(effectType)}</Dialog.Title>
          </div>
          <div inert={!sceneAvailable}>
            <Suspense fallback={null}>
              <RevealEffectStage
                effectType={effectType}
                effectProps={effectProps}
                onAvailabilityChange={setSceneAvailable}
              />
            </Suspense>
          </div>
          {!sceneAvailable && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 101,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-medium)',
                color: 'var(--color-text-inverse)',
                background: 'var(--color-text)',
              }}
            >
              <p role="alert">动画暂时无法显示，可以直接查看身份。</p>
              <Button ref={fallbackButtonRef} onClick={onComplete}>
                查看身份
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Portal>
    </Dialog.Root>
  );
}
