/**
 * WerewolfRoleCardModal — the werewolf identity card.
 *
 * While the viewed record awaits server confirmation it shows a loading state; once confirmed it
 * goes through the shared `RevealRoleCardModal`: on the first view it plays the seated reveal
 * effect over the board composition, then shows the static role card with the dual-seer label.
 */
import '@/components/CenterDialog.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { ResolvedRoleRevealAnimation } from '@game-judge/game-engine/product/rewards';
import { useEffect } from 'react';

import { Spinner } from '@/components/Spinner';
import { RevealRoleCardModal } from '@/features/room/components/RevealRoleCardModal';
import { prefetchRoleReveal } from '@/features/room/components/RoleRevealEffects/RoleRevealAnimator';
import { toRevealRoleData } from '@/games/werewolf/components/WerewolfRoleCardAdapter';

export function WerewolfRoleCardModal({
  isLoading,
  roleId,
  resolvedAnimation,
  shouldPlayAnimation,
  allRoleIds,
  remainingCards,
  onClose,
  seerLabelMap,
}: {
  /** Awaiting server confirmation of the viewed record. */
  readonly isLoading: boolean;
  /** The effective seat's role (supports takeover). */
  readonly roleId: RoleId;
  /** The seated reveal effect ('random' already resolved; 'none' opens the card directly). */
  readonly resolvedAnimation: ResolvedRoleRevealAnimation;
  /** True on the first view of this seat's role. */
  readonly shouldPlayAnimation: boolean;
  /** The board composition the roulette-style effects spin through. */
  readonly allRoleIds: readonly RoleId[];
  /** Seats that have not viewed their card yet (card-pick layout). */
  readonly remainingCards: number;
  readonly onClose: () => void;
  /** Labels for seer + mirrorSeer coexistence (from GameState). */
  readonly seerLabelMap: Readonly<Record<string, number>> | undefined;
}) {
  // A pending confirmation is always a first view, so the effect will play: fetch it meanwhile.
  useEffect(() => {
    if (isLoading && resolvedAnimation !== 'none') prefetchRoleReveal(resolvedAnimation);
  }, [isLoading, resolvedAnimation]);

  if (isLoading) {
    return (
      <Dialog.Root open role="alertdialog" closeOnInteractOutside={false} closeOnEscape={false}>
        <Portal>
          <Dialog.Backdrop className="center-dialog-backdrop" />
          <Dialog.Positioner className="center-dialog-positioner">
            <Dialog.Content className="center-dialog" aria-label="正在确认身份…">
              <Spinner label="正在确认身份…" size="lg" />
              <Dialog.Description className="center-dialog-subtitle">
                正在确认身份…
              </Dialog.Description>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    );
  }
  const seerLabel = seerLabelMap?.[roleId];
  // The pool is the public board composition, so entries keep their real identities; only the
  // owner's own card presents a disguise.
  return (
    <RevealRoleCardModal
      visible
      roleKey={roleId}
      toRoleData={(id: RoleId) => toRevealRoleData(id, { seerLabel })}
      onClose={onClose}
      effectType={resolvedAnimation === 'none' ? null : resolvedAnimation}
      shouldPlay={shouldPlayAnimation}
      allRoles={allRoleIds.map((id) => toRevealRoleData(id, { showRealIdentity: true }))}
      remainingCards={remainingCards}
    />
  );
}
