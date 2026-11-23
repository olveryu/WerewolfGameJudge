import './RoomStatusSummary.css';
import '@/components/PaperboardPanel.css';

import { useId } from 'react';

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
  className,
}: {
  readonly summary: string;
  readonly detail?: string;
  readonly header?: {
    readonly title: string;
    readonly prefix?: string;
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
  readonly className?: string;
}) {
  const summaryId = useId();
  const content = (
    <>
      {header !== undefined && (
        <>
          <span className="room-status-summary-context">
            {header.prefix !== undefined && (
              <>
                <span>{header.prefix}</span> ·{' '}
              </>
            )}
            <span>{header.title}</span>
          </span>
          <span
            className="room-status-summary-phase"
            aria-live="polite"
            data-testid={header.phaseTestId}
          >
            {header.phase}
          </span>
        </>
      )}
      {(summary.length > 0 || action !== null) && (
        <span className="room-status-summary-row">
          {summary.length > 0 && (
            <span className="room-status-summary-text" id={summaryId}>
              {summary}
            </span>
          )}
          {action !== null && (
            <span className="room-status-summary-entry" data-testid={action.testId}>
              {action.label}
              <IconChevronForward aria-hidden />
            </span>
          )}
        </span>
      )}
      {detail !== undefined && <span className="room-status-summary-detail">{detail}</span>}
      {pendingSeats !== null && (
        <PendingSeatsRow label={pendingLabel} seats={pendingSeats} testId={pendingTestId} />
      )}
    </>
  );
  if (action === null) {
    return (
      <div
        className={['room-status-summary', 'paperboard-panel', className].filter(Boolean).join(' ')}
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
      className={['room-status-summary', 'paperboard-panel', className].filter(Boolean).join(' ')}
      data-has-header={header !== undefined}
      aria-label={action.accessibleLabel}
      aria-describedby={summary.length > 0 ? summaryId : undefined}
      aria-haspopup="dialog"
      data-testid={testId}
      onClick={action.onOpen}
    >
      {content}
    </button>
  );
}
