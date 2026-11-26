import './RoomCompactStatus.css';

import { IonIcon, type IoniconName } from '@/components/icons/IonIcon';
import type { RoomStatusNotice, RoomTrack } from '@/features/room/model/RoomBoardStatus';

import { formatPendingSeats } from './PendingSeatsRow';
import { RoomTracks } from './RoomTracks';

/**
 * The room's one status bar above the seat board, rendered only by `RoomActionStatus` and drawn
 * entirely from data.
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
  notices,
  tracks,
  footnote,
  inline,
  testId,
  statusTestId,
  contextTestId,
  pendingTestId,
}: {
  readonly context: string | null;
  readonly message: string | null;
  readonly progress: string | null;
  readonly pendingSeats: readonly number[] | null;
  readonly pendingLabel?: string;
  readonly icon: IoniconName | null;
  readonly notices: readonly RoomStatusNotice[];
  readonly tracks: readonly RoomTrack[];
  readonly footnote: string | null;
  readonly inline: boolean;
  readonly testId?: string;
  readonly statusTestId: string;
  readonly contextTestId?: string;
  readonly pendingTestId?: string;
}) {
  const pending = pendingSeats === null ? '' : formatPendingSeats(pendingLabel, pendingSeats);
  const hasMessage = message !== null && message.length > 0;
  return (
    <div className="room-compact-status" data-inline={inline} data-testid={testId}>
      {(context !== null || progress !== null) && (
        <div className="room-compact-status-heading">
          {context !== null && (
            <span className="room-compact-status-context" data-testid={contextTestId}>
              {icon !== null && <IonIcon name={icon} />}
              {context}
            </span>
          )}
          {progress !== null && (
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
      {notices.map((notice) => (
        <p className="room-compact-status-message" key={notice.key}>
          {notice.text}
        </p>
      ))}
      {(tracks.length > 0 || footnote !== null) && (
        <div className="room-compact-status-tracks">
          {tracks.length > 0 && <RoomTracks tracks={tracks} />}
          {footnote !== null && <p className="room-compact-status-footnote">{footnote}</p>}
        </div>
      )}
    </div>
  );
}
