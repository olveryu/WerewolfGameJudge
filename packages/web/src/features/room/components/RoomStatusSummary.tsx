import './RoomStatusSummary.css';

import { type ReactNode, useId } from 'react';

import IconChevronForward from '~icons/ion/chevron-forward';

import { PendingSeatsRow } from './PendingSeatsRow';

/** Public stage summary; games own its content, visibility and detail surface. */
export function RoomStatusSummary({
  summary,
  detail,
  header,
  pendingSeats = null,
  pendingLabel = '未投票',
  action,
  testId,
  pendingTestId,
}: {
  readonly summary: string;
  readonly detail?: string;
  readonly header?: {
    readonly title: string;
    readonly icon: ReactNode;
    readonly phase: string;
    readonly phaseTestId?: string;
  };
  readonly pendingSeats?: readonly number[] | null;
  readonly pendingLabel?: string;
  readonly action: {
    readonly label: string;
    readonly accessibleLabel: string;
    readonly onOpen: () => void;
    readonly testId?: string;
  } | null;
  readonly testId?: string;
  readonly pendingTestId?: string;
}) {
  const summaryId = useId();
  const content = (
    <>
      {header !== undefined && (
        <span className="room-status-summary-header">
          <span className="room-status-summary-title-group">
            <span className="room-status-summary-icon" aria-hidden>
              {header.icon}
            </span>
            <span className="room-status-summary-title">{header.title}</span>
          </span>
          <span className="room-status-summary-phase" data-testid={header.phaseTestId}>
            {header.phase}
          </span>
        </span>
      )}
      <span className="room-status-summary-row">
        <span className="room-status-summary-text" id={summaryId}>
          {summary}
        </span>
        {action !== null && (
          <span className="room-status-summary-entry" data-testid={action.testId}>
            {action.label}
            <IconChevronForward aria-hidden />
          </span>
        )}
      </span>
      {detail !== undefined && <span className="room-status-summary-detail">{detail}</span>}
      {pendingSeats !== null && (
        <PendingSeatsRow label={pendingLabel} seats={pendingSeats} testId={pendingTestId} />
      )}
    </>
  );
  if (action === null) {
    return (
      <div
        className="room-status-summary"
        data-has-header={header !== undefined}
        data-testid={testId}
      >
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="room-status-summary"
      data-has-header={header !== undefined}
      aria-label={action.accessibleLabel}
      aria-describedby={summaryId}
      aria-haspopup="dialog"
      data-testid={testId}
      onClick={action.onOpen}
    >
      {content}
    </button>
  );
}
