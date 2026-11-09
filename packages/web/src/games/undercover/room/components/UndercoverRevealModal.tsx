/** Elimination confirmation; accepts only public player identity and reports intent. */
import './UndercoverRevealModal.css';

import { Avatar } from '@/components/avatar/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { useViewportWidth } from '@/features/room/hooks/useViewportWidth';
import { getRoomOccupantAvatarSeed } from '@/features/room/model/RoomOccupant';
import type { RoomSeatPlayer } from '@/features/room/model/RoomSeatDataSource';
import { usesRoomSideInspector } from '@/features/room/model/roomShellLayout';
import IconPersonRemoveOutline from '~icons/ion/person-remove-outline';

const AVATAR_SIZE = 56;
const REVEAL_TITLE = '确认出局？';

interface UndercoverRevealModalProps {
  readonly seat: number;
  readonly player: RoomSeatPlayer;
  readonly isSubmitting: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

/** Keep confirmation adjacent to the selected player without revealing hidden game information. */
export function UndercoverRevealModal({
  seat,
  player,
  isSubmitting,
  onClose,
  onConfirm,
}: UndercoverRevealModalProps) {
  const isWideLayout = usesRoomSideInspector(useViewportWidth());
  const details = (
    <>
      <div className="undercover-reveal-identity">
        <Avatar
          userId={getRoomOccupantAvatarSeed(player.occupant)}
          avatarUrl={player.avatarUrl ?? null}
          size={AVATAR_SIZE}
        />
        <div className="undercover-reveal-name">
          <p className="undercover-reveal-seat">{seat + 1} 号</p>
          <p className="undercover-reveal-player" data-testid="undercover-reveal-player">
            {player.displayName}
          </p>
        </div>
      </div>
      <p className="undercover-reveal-warning">
        确认后将揭晓身份，该玩家立即出局。此操作不可撤销。
      </p>
    </>
  );
  const actions = (
    <div className="undercover-reveal-actions">
      <Button
        className="undercover-reveal-action"
        variant="secondary"
        size="lg"
        onClick={onClose}
        disabled={isSubmitting}
        data-testid="undercover-reveal-cancel"
      >
        取消
      </Button>
      <Button
        className="undercover-reveal-action"
        variant="danger"
        size="lg"
        onClick={onConfirm}
        loading={isSubmitting}
        data-testid="undercover-reveal"
      >
        <IconPersonRemoveOutline aria-hidden />
        确认出局
      </Button>
    </div>
  );
  if (isWideLayout) {
    return (
      <RoomDialog
        title={REVEAL_TITLE}
        testId="undercover-reveal-modal"
        onClose={onClose}
        footer={actions}
      >
        {details}
      </RoomDialog>
    );
  }
  return (
    <BottomSheet title="确认玩家出局" testId="undercover-reveal-modal" onClose={onClose}>
      <h2 className="undercover-reveal-sheet-title">{REVEAL_TITLE}</h2>
      <div className="undercover-reveal-sheet-body">{details}</div>
      <div className="undercover-reveal-sheet-footer">{actions}</div>
    </BottomSheet>
  );
}
