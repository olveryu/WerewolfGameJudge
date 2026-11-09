import { type ReactNode, useState } from 'react';

import type { RevealRoleData } from '../../model/RevealRoleData';
import { RoleRevealAnimator } from './RoleRevealAnimator';
import type { RevealEffectType } from './types';

interface RevealAnimationGateProps {
  readonly visible: boolean;
  /** The viewer's equipped effect; null shows the card directly. */
  readonly effectType: RevealEffectType | null;
  /** False once the viewer has already watched the reveal this game. */
  readonly shouldPlay: boolean;
  readonly role: RevealRoleData;
  readonly allRoles?: readonly RevealRoleData[];
  readonly remainingCards?: number;
  readonly onPlayComplete?: () => void;
  /** The static role card shown after the reveal, or instead of it. */
  readonly children: ReactNode;
}

/**
 * Every role-card reveal routes through this gate: the first view plays the equipped effect once,
 * then the static card; later views, or no equipped effect, show the card directly.
 */
export function RevealAnimationGate({
  visible,
  effectType,
  shouldPlay,
  role,
  allRoles,
  remainingCards,
  onPlayComplete,
  children,
}: RevealAnimationGateProps) {
  const [played, setPlayed] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) setPlayed(false);
  }

  if (!visible) return null;
  if (effectType === null || !shouldPlay || played) return children;
  return (
    <RoleRevealAnimator
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
}
