import './RoomPlayerPickModal.css';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import IconCheckmark from '~icons/ion/checkmark';

/**
 * How many seats the sheet takes: exactly `size` (a team or a nominee), any number (an access
 * list, possibly empty), or a single choice (an award).
 */
export type RoomPlayerPickMode =
  | { readonly kind: 'exact'; readonly size: number }
  | { readonly kind: 'any' }
  | { readonly kind: 'single' };

export interface RoomPlayerPickOption {
  readonly seat: number;
  readonly label: string;
  readonly tag: string | null;
  readonly isPreselected: boolean;
  readonly disabledReason: string | null;
}

function countLabel(mode: RoomPlayerPickMode, picked: number): string | null {
  switch (mode.kind) {
    case 'exact':
      return `已选 ${picked}/${mode.size}`;
    case 'any':
      return `已选 ${picked}`;
    case 'single':
      return null;
  }
}

function canConfirm(mode: RoomPlayerPickMode, picked: number): boolean {
  switch (mode.kind) {
    case 'exact':
      return picked === mode.size;
    case 'any':
      return true;
    case 'single':
      return picked === 1;
  }
}

/** Shared selection sheet; callers supply eligibility and game-specific copy. */
export function RoomPlayerPickModal({
  title,
  hint,
  mode,
  initialSelection,
  players,
  isSubmitting,
  confirmLabel,
  cancelLabel = '取消',
  intro,
  footerNote,
  onConfirm,
  onClose,
  testIds,
}: {
  readonly title: string;
  readonly hint: string;
  readonly mode: RoomPlayerPickMode;
  readonly initialSelection: readonly number[];
  readonly players: readonly RoomPlayerPickOption[];
  readonly isSubmitting: boolean;
  /** Confirm key copy; a function receives the current selection size. */
  readonly confirmLabel: string | ((picked: number) => string);
  readonly cancelLabel?: string;
  /** Caller content between the hint and the list (for example what the pick awards). */
  readonly intro?: ReactNode;
  /** One line of caller copy above the keys. */
  readonly footerNote?: string;
  readonly onConfirm: (seats: readonly number[]) => void;
  readonly onClose: () => void;
  readonly testIds: {
    readonly modal: string;
    readonly count?: string;
    readonly row: (seat: number) => string;
    readonly cancel?: string;
    readonly confirm?: string;
  };
}) {
  const [selection, setSelection] = useState<readonly number[]>(initialSelection);
  const [fullHint, setFullHint] = useState<string | null>(null);
  const toggle = (seat: number) => {
    if (mode.kind === 'single') {
      setSelection([seat]);
    } else if (selection.includes(seat)) {
      setSelection(selection.filter((picked) => picked !== seat));
      setFullHint(null);
    } else if (mode.kind === 'exact' && selection.length >= mode.size) {
      setFullHint('已满员，取消已选座位后再选。');
    } else {
      setSelection([...selection, seat]);
      setFullHint(null);
    }
  };
  const count = countLabel(mode, selection.length);
  return (
    <BottomSheet title={title} onClose={onClose} testId={testIds.modal}>
      <div className="room-player-pick">
        <header className="room-player-pick-header">
          <h2 className="room-player-pick-title">{title}</h2>
          {count !== null && (
            <span className="room-player-pick-count" data-testid={testIds.count}>
              {count}
            </span>
          )}
        </header>
        <p className="room-player-pick-hint">{hint}</p>
        {intro}
        <div
          className="room-player-pick-list"
          role={mode.kind === 'single' ? 'radiogroup' : 'group'}
          aria-label={title}
        >
          {players.map((player) => {
            const checked = selection.includes(player.seat);
            return (
              <button
                key={player.seat}
                type="button"
                role={mode.kind === 'single' ? 'radio' : 'checkbox'}
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
          {footerNote !== undefined && <p className="room-player-pick-note">{footerNote}</p>}
          <div className="room-player-pick-actions">
            <Button
              variant="secondary"
              size="lg"
              disabled={isSubmitting}
              onClick={onClose}
              data-testid={testIds.cancel}
            >
              {cancelLabel}
            </Button>
            <Button
              size="lg"
              loading={isSubmitting}
              disabled={!canConfirm(mode, selection.length)}
              onClick={() => onConfirm(selection)}
              data-testid={testIds.confirm}
            >
              {typeof confirmLabel === 'string' ? confirmLabel : confirmLabel(selection.length)}
            </Button>
          </div>
        </footer>
      </div>
    </BottomSheet>
  );
}
