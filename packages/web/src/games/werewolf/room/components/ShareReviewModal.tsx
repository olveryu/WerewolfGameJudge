/**
 * ShareReviewModal — the host picks the seats allowed to read 「本局复盘」.
 *
 * Pure display: a multi-select seat list plus confirm and cancel, reported through callbacks. The
 * selection draft is seeded once on mount from `currentAllowedSeats`; the caller mounts this only
 * while it is open, so every opening starts from the authoritative set and later room snapshots
 * never overwrite the draft.
 */
import '@/components/CenterDialog.css';
import './ShareReviewModal.css';

import { Portal } from '@ark-ui/react/portal';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { useState } from 'react';

import { AppDialog } from '@/components/AppDialog';
import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';
import IconCheckmark from '~icons/ion/checkmark';

interface SeatInfo {
  /** 0-based seat index */
  readonly seat: number;
  readonly displayName: string;
}

export function ShareReviewModal({
  seats,
  currentAllowedSeats,
  onConfirm,
  onClose,
}: {
  readonly seats: readonly SeatInfo[];
  /** Authorized seats at open time; seeds the selection draft. */
  readonly currentAllowedSeats: readonly number[];
  readonly onConfirm: (selectedSeats: number[]) => void | Promise<void>;
  readonly onClose: () => void;
}) {
  // Seed from the authorized set, dropping seats not offered (e.g. the host's own seat).
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => {
    const visibleSeatSet = new Set(seats.map((seat) => seat.seat));
    return new Set(currentAllowedSeats.filter((seat) => visibleSeatSet.has(seat)));
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSeat = (seat: number) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(seat)) next.delete(seat);
      else next.add(seat);
      return next;
    });
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(Array.from(selected).sort((a, b) => a - b));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppDialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <AppDialog.Backdrop className="center-dialog-backdrop" />
        <AppDialog.Positioner className="center-dialog-positioner">
          <AppDialog.Content
            className="center-dialog share-review-dialog"
            data-testid={TESTIDS.shareReviewModal}
          >
            <AppDialog.Title className="center-dialog-title">授权查看本局复盘</AppDialog.Title>
            <AppDialog.Description className="center-dialog-subtitle">
              选择可以查看「本局复盘」的玩家
            </AppDialog.Description>
            <div className="share-review-seats">
              {seats.map(({ seat, displayName }) => {
                const isSelected = selected.has(seat);
                return (
                  <button
                    key={seat}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    className="share-review-seat"
                    data-testid={TESTIDS.shareReviewSeat(seat)}
                    onClick={() => toggleSeat(seat)}
                  >
                    <span className="share-review-checkbox" aria-hidden>
                      {isSelected && <IconCheckmark />}
                    </span>
                    {formatSeat(seat)} {displayName}
                  </button>
                );
              })}
            </div>
            <div className="center-dialog-actions">
              <Button variant="secondary" onClick={onClose}>
                取消
              </Button>
              <Button
                data-testid={TESTIDS.shareReviewConfirmButton}
                disabled={isSubmitting}
                onClick={() => void handleConfirm()}
              >
                {isSubmitting
                  ? '提交中…'
                  : `确认${selected.size > 0 ? `（${selected.size}人）` : ''}`}
              </Button>
            </div>
          </AppDialog.Content>
        </AppDialog.Positioner>
      </Portal>
    </AppDialog.Root>
  );
}
