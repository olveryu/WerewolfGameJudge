/**
 * Full-screen role reveal: dialog, backdrop, DOM title and the scene overlay.
 */
import { Portal } from '@ark-ui/react/portal';
import { Suspense, useLayoutEffect, useRef, useState } from 'react';

import { AppDialog } from '@/components/AppDialog';
import { Button } from '@/components/Button';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';
import { log } from '@/utils/logger';

import {
  REVEAL_ROOT_STYLE,
  REVEAL_TITLE_ROW_STYLE,
  REVEAL_TITLE_STYLE,
  revealTitle,
} from './common/shell';
import RevealEffectStage, { prefetchRevealEffect } from './RevealEffectStage';
import type { RevealEffectProps, RevealEffectType, RoleRevealAnimatorProps } from './types';

const revealLog = log.extend('RoleReveal');

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
    <AppDialog.Root
      open
      // Ends only through `onComplete` (the effect, or the fallback button): Escape and outside
      // interactions never close a reveal, in the room or in the product preview.
      closeOnInteractOutside={false}
      closeOnEscape={false}
    >
      <Portal>
        <AppDialog.Content data-testid={`${testIDPrefix}-modal`} style={REVEAL_ROOT_STYLE}>
          <div style={REVEAL_TITLE_ROW_STYLE}>
            <AppDialog.Title style={REVEAL_TITLE_STYLE}>{revealTitle(effectType)}</AppDialog.Title>
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
              <Button
                ref={fallbackButtonRef}
                onClick={() => {
                  // The effect never played: keep the skip visible next to the `[Scene]` loss.
                  revealLog.warn('Reveal ended by the fallback button without the effect', {
                    effectType,
                    reason: 'sceneUnavailable',
                  });
                  onComplete();
                }}
              >
                查看身份
              </Button>
            </div>
          )}
        </AppDialog.Content>
      </Portal>
    </AppDialog.Root>
  );
}
