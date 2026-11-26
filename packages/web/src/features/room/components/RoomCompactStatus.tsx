import './RoomCompactStatus.css';

import type { ReactNode } from 'react';

import { formatPendingSeats } from './PendingSeatsRow';

/**
 * A read-only, compact room status with optional submission progress.
 *
 * `statusTestId` marks the one status line: the message when there is one, otherwise the
 * progress. Callers never choose which element carries it.
 */
export function RoomCompactStatus({
  context,
  message,
  progress,
  pendingSeats,
  pendingLabel = '未投票',
  icon,
  inline = false,
  testId,
  statusTestId,
  contextTestId,
  pendingTestId,
  children,
}: {
  readonly context: string | null;
  readonly message: string | null;
  readonly progress?: string | null;
  readonly pendingSeats?: readonly number[] | null;
  readonly pendingLabel?: string;
  readonly icon?: ReactNode;
  readonly inline?: boolean;
  readonly testId?: string;
  readonly statusTestId?: string;
  readonly contextTestId?: string;
  readonly pendingTestId?: string;
  readonly children?: ReactNode;
}) {
  const pending =
    pendingSeats === null || pendingSeats === undefined
      ? ''
      : formatPendingSeats(pendingLabel, pendingSeats);
  const hasMessage = message !== null && message.length > 0;
  return (
    <div className="room-compact-status" data-inline={inline} data-testid={testId}>
      {(context !== null || (progress !== null && progress !== undefined)) && (
        <div className="room-compact-status-heading">
          {context !== null && (
            <span className="room-compact-status-context" data-testid={contextTestId}>
              {icon}
              {context}
            </span>
          )}
          {progress !== null && progress !== undefined && (
            <span
              className="room-compact-status-progress"
              data-testid={hasMessage ? undefined : statusTestId}
            >
              {progress}
            </span>
          )}
        </div>
      )}
      {hasMessage && (
        <p className="room-compact-status-message" aria-live="polite" data-testid={statusTestId}>
          {message}
        </p>
      )}
      {pending.length > 0 && (
        <p className="room-compact-status-message" data-testid={pendingTestId}>
          {pending}
        </p>
      )}
      {children}
    </div>
  );
}
