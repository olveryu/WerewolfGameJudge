/**
 * Shared identity-card modal: the RevealAnimationGate assembly every
 * identity-viewing game renders (server-anchored first-view animation,
 * static card afterwards).
 *
 * Games supply only their role key and their adapter from that key to
 * RevealRoleData; the gate/static branching lives here exactly once.
 * A null key renders the static card without the gate.
 */
import { RevealAnimationGate } from '@/features/room/components/RevealAnimationGate';
import { RoleCardSimple } from '@/features/room/components/RoleCardSimple';
import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

export function RevealRoleCardModal<TKey>({
  visible,
  roleKey,
  toRoleData,
  effectType,
  shouldPlay,
  allRoles,
  remainingCards,
  onClose,
}: {
  readonly visible: boolean;
  readonly roleKey: TKey | null;
  /** The game's adapter from its role key to the shared reveal data. */
  readonly toRoleData: (key: TKey) => RevealRoleData;
  /** The card owner's equipped reveal effect; null for previews or bot takeovers. */
  readonly effectType?: RevealEffectType | null;
  /** Server anchor: true only while the seat has not yet viewed (first view plays). */
  readonly shouldPlay: boolean;
  /** Animation candidate pool: the game's full role distribution. */
  readonly allRoles: readonly RevealRoleData[];
  /** Unviewed cards left on the table (occupied seats minus viewed seats). */
  readonly remainingCards: number;
  readonly onClose: () => void;
}) {
  const role = roleKey != null ? toRoleData(roleKey) : null;

  if (role == null) {
    return <RoleCardSimple visible={visible} role={role} onClose={onClose} confirmText="知道了" />;
  }

  return (
    <RevealAnimationGate
      visible={visible}
      effectType={effectType ?? null}
      shouldPlay={shouldPlay}
      role={role}
      allRoles={allRoles}
      remainingCards={remainingCards}
    >
      <RoleCardSimple visible={visible} role={role} onClose={onClose} confirmText="知道了" />
    </RevealAnimationGate>
  );
}
