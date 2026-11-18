import './RoomRecordSummary.css';

import { PendingSeatsRow } from './PendingSeatsRow';

/** Compact public match summary; opens game-owned details without replacing the seat board. */
export function RoomRecordSummary({
  summary,
  detail,
  pendingSeats = null,
  pendingLabel = '未投票',
  onOpen,
  testId,
  pendingTestId,
}: {
  readonly summary: string;
  readonly detail?: string;
  readonly pendingSeats?: readonly number[] | null;
  readonly pendingLabel?: string;
  readonly onOpen: () => void;
  readonly testId?: string;
  readonly pendingTestId?: string;
}) {
  return (
    <button
      type="button"
      className="room-record-summary"
      aria-label="对局记录"
      aria-haspopup="dialog"
      data-testid={testId}
      onClick={onOpen}
    >
      <span className="room-record-summary-row">
        <span className="room-record-summary-text">{summary}</span>
        <span className="room-record-summary-entry">对局记录 ›</span>
      </span>
      {detail !== undefined && <span className="room-record-summary-detail">{detail}</span>}
      {pendingSeats !== null && (
        <PendingSeatsRow label={pendingLabel} seats={pendingSeats} testId={pendingTestId} />
      )}
    </button>
  );
}
