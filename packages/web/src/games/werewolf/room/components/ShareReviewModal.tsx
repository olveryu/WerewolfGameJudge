/**
 * ShareReviewModal — the host picks the seats allowed to read 「本局复盘」.
 *
 * Pure display over the shared pick sheet: a multi-select seat list plus confirm and cancel,
 * reported through callbacks. The selection draft is seeded once on mount from
 * `currentAllowedSeats`; the caller mounts this only while it is open, so every opening starts
 * from the authoritative set and later room snapshots never overwrite the draft.
 */
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { useState } from 'react';

import { RoomPlayerPickModal } from '@/features/room/components/RoomPlayerPickModal';
import { TESTIDS } from '@/testids';

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
  const [initialSelection] = useState<readonly number[]>(() => {
    const visibleSeatSet = new Set(seats.map((seat) => seat.seat));
    return currentAllowedSeats.filter((seat) => visibleSeatSet.has(seat));
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async (picked: readonly number[]) => {
    setIsSubmitting(true);
    try {
      await onConfirm([...picked].sort((a, b) => a - b));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RoomPlayerPickModal
      title="授权查看本局复盘"
      hint="选择可以查看「本局复盘」的玩家"
      mode={{ kind: 'any' }}
      initialSelection={initialSelection}
      players={seats.map(({ seat, displayName }) => ({
        seat,
        label: `${formatSeat(seat)} ${displayName}`,
        tag: null,
        isPreselected: false,
        disabledReason: null,
      }))}
      isSubmitting={isSubmitting}
      confirmLabel={(picked) => `确认${picked > 0 ? `（${picked}人）` : ''}`}
      onConfirm={(picked) => void handleConfirm(picked)}
      onClose={onClose}
      testIds={{
        modal: TESTIDS.shareReviewModal,
        row: TESTIDS.shareReviewSeat,
        confirm: TESTIDS.shareReviewConfirmButton,
      }}
    />
  );
}
