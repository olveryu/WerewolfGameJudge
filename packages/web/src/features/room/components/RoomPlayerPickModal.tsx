import './RoomPlayerPickModal.css';

import { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import IconCheckmark from '~icons/ion/checkmark';

/** Shared selection sheet; callers supply eligibility and game-specific copy. */
export function RoomPlayerPickModal({
  title,
  hint,
  requiredSize,
  initialSelection,
  players,
  isSubmitting,
  confirmLabel,
  onConfirm,
  onClose,
  testIds,
}: {
  readonly title: string;
  readonly hint: string;
  readonly requiredSize: number;
  readonly initialSelection: readonly number[];
  readonly players: readonly {
    readonly seat: number;
    readonly label: string;
    readonly tag: string | null;
    readonly isPreselected: boolean;
    readonly disabledReason: string | null;
  }[];
  readonly isSubmitting: boolean;
  readonly confirmLabel: string;
  readonly onConfirm: (seats: readonly number[]) => void;
  readonly onClose: () => void;
  readonly testIds: {
    readonly modal: string;
    readonly count: string;
    readonly row: (seat: number) => string;
    readonly cancel: string;
    readonly confirm: string;
  };
}) {
  const [selection, setSelection] = useState<readonly number[]>(initialSelection);
  const [fullHint, setFullHint] = useState<string | null>(null);
  const toggle = (seat: number) => {
    if (selection.includes(seat)) {
      setSelection(selection.filter((picked) => picked !== seat));
      setFullHint(null);
    } else if (selection.length >= requiredSize) {
      setFullHint('已满员，取消已选座位后再选。');
    } else {
      setSelection([...selection, seat]);
      setFullHint(null);
    }
  };
  return (
    <BottomSheet title={title} onClose={onClose} testId={testIds.modal}>
      <div className="room-player-pick">
        <header className="room-player-pick-header">
          <h2 className="room-player-pick-title">{title}</h2>
          <span className="room-player-pick-count" data-testid={testIds.count}>
            已选 {selection.length}/{requiredSize}
          </span>
        </header>
        <p className="room-player-pick-hint">{hint}</p>
        <div className="room-player-pick-list" role="group" aria-label={title}>
          {players.map((player) => {
            const checked = selection.includes(player.seat);
            return (
              <button
                key={player.seat}
                type="button"
                role="checkbox"
                aria-checked={checked}
                className="room-player-pick-row"
                disabled={isSubmitting || player.disabledReason !== null}
                data-testid={testIds.row(player.seat)}
                onClick={() => toggle(player.seat)}
              >
                <span className="room-player-pick-checkbox" aria-hidden>
                  {checked && <IconCheckmark />}
                </span>
                <span className="room-player-pick-label">{player.label}</span>
                {player.tag !== null && <span className="room-player-pick-tag">{player.tag}</span>}
                {player.isPreselected && (
                  <span className="room-player-pick-tag" data-preselected>
                    预选
                  </span>
                )}
                {player.disabledReason !== null && (
                  <span className="room-player-pick-tag">{player.disabledReason}</span>
                )}
              </button>
            );
          })}
        </div>
        {fullHint !== null && (
          <p className="room-player-pick-full" role="status">
            {fullHint}
          </p>
        )}
        <footer className="room-player-pick-footer">
          <Button variant="secondary" size="lg" onClick={onClose} data-testid={testIds.cancel}>
            取消
          </Button>
          <Button
            size="lg"
            disabled={selection.length !== requiredSize || isSubmitting}
            onClick={() => onConfirm(selection)}
            data-testid={testIds.confirm}
          >
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </BottomSheet>
  );
}
