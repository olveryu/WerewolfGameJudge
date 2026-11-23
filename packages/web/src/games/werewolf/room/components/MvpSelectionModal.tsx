/** MVP selection view; reports the selection without dispatching room commands. Mounted means open. */
import '@/components/CenterDialog.css';
import './MvpSelectionModal.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { TESTIDS } from '@/testids';
import IconCheckmarkCircle from '~icons/ion/checkmark-circle';
import IconClose from '~icons/ion/close';
import IconEllipseOutline from '~icons/ion/ellipse-outline';
import IconTrophyOutline from '~icons/ion/trophy-outline';

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner className="center-dialog-positioner">
          <Dialog.Content className="mvp-dialog" data-testid={TESTIDS.mvpSelectionModal}>
            <header className="mvp-header">
              <IconTrophyOutline className="mvp-header-icon" aria-hidden />
              <Dialog.Title className="mvp-title">本局 MVP</Dialog.Title>
              <IconButton
                label="关闭 MVP 评选"
                icon={<IconClose aria-hidden />}
                disabled={isSubmitting}
                onClick={onClose}
              />
            </header>
            <div className="mvp-reward">
              <span className="mvp-reward-value">{goldenDraws}</span>
              <div className="mvp-reward-info">
                <span className="mvp-reward-label">次黄金抽</span>
                <span className="mvp-secondary">
                  开局 {participants.length} 名真人 · 仅注册账号可领奖
                </span>
              </div>
            </div>
            {goldenDraws === 0 && <p className="mvp-notice">不足 6 名真人，本局仅评选，不发奖励</p>}
            <div className="mvp-list" role="radiogroup" aria-label="本局 MVP 候选玩家">
              {participants.map((participant) => {
                const isSelected = selectedUserId === participant.userId;
                return (
                  <button
                    key={participant.userId}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${formatSeat(participant.seat)} ${participant.displayName}${participant.hasLeft ? '，已离房' : ''}`}
                    className="mvp-row"
                    disabled={isSubmitting}
                    onClick={() => setSelectedUserId(participant.userId)}
                  >
                    <span className="mvp-seat-badge" aria-hidden>
                      {participant.seat + 1}
                    </span>
                    <span className="mvp-player-info" aria-hidden>
                      <span className="mvp-player-name">
                        {participant.displayName || formatSeat(participant.seat)}
                      </span>
                      {participant.hasLeft && <span className="mvp-secondary">已离房</span>}
                    </span>
                    {isSelected ? (
                      <IconCheckmarkCircle className="mvp-check" data-selected aria-hidden />
                    ) : (
                      <IconEllipseOutline className="mvp-check" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
            <footer className="mvp-footer">
              <p className="mvp-notice">请在整局结束后确认，本局仅可评选一次，确认后不可更改。</p>
              <div className="mvp-actions">
                <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                  暂不评选
                </Button>
                <Button
                  className="mvp-confirm"
                  loading={isSubmitting}
                  disabled={selectedUserId === null}
                  onClick={() => {
                    if (selectedUserId !== null) void onSelect(selectedUserId);
                  }}
                >
                  确认 MVP
                </Button>
              </div>
            </footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
