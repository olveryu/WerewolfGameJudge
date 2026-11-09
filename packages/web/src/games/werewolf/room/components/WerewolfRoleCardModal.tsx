/**
 * WerewolfRoleCardModal — the werewolf identity card.
 *
 * While the viewed record awaits server confirmation it shows a loading state; once confirmed it
 * shows the static role card through the shared `RevealRoleCardModal` with the dual-seer label.
 * The first-view reveal animation wraps that shared card in the scene layer (P3 scene step).
 */
import '@/components/CenterDialog.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { Spinner } from '@/components/Spinner';
import { RevealRoleCardModal } from '@/features/room/components/RevealRoleCardModal';
import { toRevealRoleData } from '@/games/werewolf/components/WerewolfRoleCardAdapter';

export function WerewolfRoleCardModal({
  isLoading,
  roleId,
  onClose,
  seerLabelMap,
}: {
  /** Awaiting server confirmation of the viewed record. */
  readonly isLoading: boolean;
  /** The effective seat's role (supports takeover). */
  readonly roleId: RoleId;
  readonly onClose: () => void;
  /** Labels for seer + mirrorSeer coexistence (from GameState). */
  readonly seerLabelMap: Readonly<Record<string, number>> | undefined;
}) {
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
  return (
    <RevealRoleCardModal
      visible
      roleKey={roleId}
      toRoleData={(id: RoleId) => toRevealRoleData(id, { seerLabel })}
      onClose={onClose}
    />
  );
}
