/**
 * RevealAnimationGate — the single mechanical gate for identity reveal
 * animations (Identity Viewing Protocol, presentation layer).
 *
 * Renders the RoleRevealAnimator only when the card's owner has an
 * equipped effect, the caller says this open should play (the anchor is
 * the server-side viewed record: shouldPlay = equipped && !hasViewed),
 * and the animation has not finished during this open. Otherwise it
 * renders the static card (children). The gate owns no game state: each
 * game supplies its resolved effect, its role data, and its anchor.
 */

import { type FC, type ReactNode, useEffect, useState } from 'react';

import type { RevealRoleData } from '../model/RevealRoleData';
import { RoleRevealAnimator } from './RoleRevealEffects/RoleRevealAnimator';
import type { RevealEffectType } from './RoleRevealEffects/types';

export interface RevealAnimationGateProps {
  /** Whether the owning card surface is visible; closing resets the gate for the next open. */
  readonly visible: boolean;
  /** The card owner's resolved equipped effect; null means no equipment, never animate.
   * Callers map a resolved 'none' to null (RevealEffectType excludes 'none'). */
  readonly effectType: RevealEffectType | null;
  /** Anchor from the server viewed record: play only on the owner's first view. */
  readonly shouldPlay: boolean;
  readonly role: RevealRoleData;
  readonly allRoles?: readonly RevealRoleData[];
  readonly remainingCards?: number;
  readonly onPlayComplete?: () => void;
  /** The static card rendered instead of / after the animation. */
  readonly children: ReactNode;
}

export const RevealAnimationGate: FC<RevealAnimationGateProps> = ({
  visible,
  effectType,
  shouldPlay,
  role,
  allRoles,
  remainingCards,
  onPlayComplete,
  children,
}) => {
  const [played, setPlayed] = useState(false);

  // One play per open: when the surface closes, reset so the next open
  // re-evaluates the anchor (the server record decides whether it plays).
  useEffect(() => {
    if (!visible) setPlayed(false);
  }, [visible]);

  if (effectType === null || !shouldPlay || played) {
    return <>{children}</>;
  }

  return (
    <RoleRevealAnimator
      visible={visible}
      effectType={effectType}
      role={role}
      allRoles={allRoles}
      remainingCards={remainingCards}
      onComplete={() => {
        setPlayed(true);
        onPlayComplete?.();
      }}
    />
  );
};
