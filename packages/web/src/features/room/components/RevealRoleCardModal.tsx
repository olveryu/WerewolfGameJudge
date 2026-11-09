/**
 * Shared identity-card modal every identity-viewing game renders. Games supply their role key and
 * their adapter from that key to RevealRoleData. The first view plays the viewer's equipped reveal
 * effect through RevealAnimationGate, then shows the static card.
 */
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

import { RoleCardDialog } from './RoleCard';
import { RevealAnimationGate } from './RoleRevealEffects/RevealAnimationGate';
import type { RevealEffectType } from './RoleRevealEffects/types';

export function RevealRoleCardModal<TKey>({
  visible,
  roleKey,
  toRoleData,
  onClose,
  effectType = null,
  shouldPlay = false,
  allRoles,
  remainingCards,
}: {
  readonly visible: boolean;
  readonly roleKey: TKey | null;
  /** The game's adapter from its role key to the shared reveal data. */
  readonly toRoleData: (key: TKey) => RevealRoleData;
  readonly onClose: () => void;
  /** The viewer's equipped reveal effect; null opens the card directly. */
  readonly effectType?: RevealEffectType | null;
  /** True on the viewer's first look at this role. */
  readonly shouldPlay?: boolean;
  /** Roles the roulette-style effects spin through. */
  readonly allRoles?: readonly RevealRoleData[];
  /** Cards the card-pick effect lays out. */
  readonly remainingCards?: number;
}) {
  if (!visible || roleKey === null) return null;
  const role = toRoleData(roleKey);
  return (
    <RevealAnimationGate
      visible
      effectType={effectType}
      shouldPlay={shouldPlay}
      role={role}
      allRoles={allRoles}
      remainingCards={remainingCards}
    >
      <RoleCardDialog role={role} onClose={onClose} />
    </RevealAnimationGate>
  );
}
