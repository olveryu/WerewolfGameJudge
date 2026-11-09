/**
 * The one rendering of a "who has not submitted" list: a label plus one SeatDot per pending seat.
 * The text form for surfaces that cannot render dots (record rows, night review) is
 * {@link formatPendingSeats} — same words, same order. Seats are 0-based engine seats.
 * Renders nothing when no seat is pending.
 */
import './PendingSeatsRow.css';

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { SeatDot } from '@/components/SeatDot';

/** "未投票：2号 4号" — the text form of a pending-seats list. Empty when no seat is pending. */
export function formatPendingSeats(label: string, seats: readonly number[]): string {
  if (seats.length === 0) return '';
  return `${label}：${seats.map((seat) => formatSeat(seat)).join(' ')}`;
}

export function PendingSeatsRow({
  label,
  seats,
  testId,
}: {
  /** Caller-owned label, e.g. '未投票'. */
  readonly label: string;
  /** 0-based pending seats, ascending. */
  readonly seats: readonly number[];
  readonly testId?: string;
}) {
  if (seats.length === 0) return null;
  // Phrasing content only: the row also sits inside interactive surfaces (the sheriff HUD button).
  return (
    <span className="pending-seats-row" data-testid={testId}>
      <span
        className="pending-seats-label"
        data-testid={testId === undefined ? undefined : `${testId}-label`}
      >
        {label}：
      </span>
      {seats.map((seat) => (
        <SeatDot
          key={seat}
          seat={seat}
          size="sm"
          {...(testId === undefined ? {} : { testId: `${testId}-seat-${seat}` })}
        />
      ))}
    </span>
  );
}
