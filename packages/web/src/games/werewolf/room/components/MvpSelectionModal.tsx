/** MVP selection view; reports the selection without dispatching room commands. Mounted means open. */
import './MvpSelectionModal.css';

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { RoomPlayerPickModal } from '@/features/room/components/RoomPlayerPickModal';
import { TESTIDS } from '@/testids';

interface Participant {
  readonly userId: string;
  readonly seat: number;
  readonly displayName: string;
  readonly hasLeft: boolean;
}

export function MvpSelectionModal({
  participants,
  goldenDraws,
  isSubmitting,
  onSelect,
  onClose,
}: {
  readonly participants: readonly Participant[];
  readonly goldenDraws: number;
  readonly isSubmitting: boolean;
  readonly onSelect: (userId: string) => Promise<void>;
  readonly onClose: () => void;
}) {
  const userIdBySeat = new Map(
    participants.map((participant) => [participant.seat, participant.userId]),
  );
  return (
    <RoomPlayerPickModal
      title="本局 MVP"
      hint="请在整局结束后确认，本局仅可评选一次，确认后不可更改。"
      mode={{ kind: 'single' }}
      initialSelection={[]}
      players={participants.map((participant) => ({
        seat: participant.seat,
        label:
          participant.displayName === ''
            ? formatSeat(participant.seat)
            : `${formatSeat(participant.seat)} ${participant.displayName}`,
        tag: participant.hasLeft ? '已离房' : null,
        isPreselected: false,
        disabledReason: null,
      }))}
      isSubmitting={isSubmitting}
      intro={
        <div className="mvp-reward">
          <span className="mvp-reward-value">{goldenDraws}</span>
          <div className="mvp-reward-info">
            <span className="mvp-reward-label">次黄金抽</span>
            <span className="mvp-reward-detail">
              开局 {participants.length} 名真人 · 仅注册账号可领奖
            </span>
            {goldenDraws === 0 && (
              <span className="mvp-reward-detail">不足 6 名真人，本局仅评选，不发奖励</span>
            )}
          </div>
        </div>
      }
      cancelLabel="暂不评选"
      confirmLabel="确认 MVP"
      onConfirm={(seats) => {
        const [seat] = seats;
        const userId =
          seats.length === 1 && seat !== undefined ? userIdBySeat.get(seat) : undefined;
        if (userId === undefined) {
          throw new Error('[FAIL-FAST] MVP confirm needs exactly one offered participant');
        }
        void onSelect(userId);
      }}
      onClose={onClose}
      testIds={{
        modal: TESTIDS.mvpSelectionModal,
        row: TESTIDS.mvpSelectionCandidate,
      }}
    />
  );
}
