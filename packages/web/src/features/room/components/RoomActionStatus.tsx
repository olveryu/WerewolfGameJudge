import './RoomBottomActionPanel.css';

import type { ReactNode } from 'react';

import type { NightStepProgress } from '@/features/room/model/nightProgress';
import { resolveHostTaskView } from '@/features/room/model/resolveHostTaskView';
import type { RoomSelectionMode } from '@/features/room/model/RoomHand';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import {
  AUDIO_WAITING_LABEL,
  type RoomPlayerActionModel,
} from '@/features/room/model/RoomPlayerActions';
import { TESTIDS } from '@/testids';

import { RoomCompactStatus } from './RoomCompactStatus';

/** Progress of the active step sequence: "第n步 / 共m步", an optional label, and a bar. */
function RoomProgressIndicator({ progress }: { readonly progress: NightStepProgress }) {
  const percent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  return (
    <div className="room-progress" data-testid={TESTIDS.roomProgressIndicator}>
      <div className="room-progress-header">
        <span className="room-progress-step">
          第{progress.current}步 / 共{progress.total}步
        </span>
        {progress.label !== '' && <span className="room-progress-label">{progress.label}</span>}
      </div>
      <div
        className="room-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.current}
      >
        <span className="room-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function resolveStatusMessage(
  model: RoomPlayerActionModel,
  isAudioPlaying: boolean,
  selectionMode: RoomSelectionMode | undefined,
  selectionBody: NonNullable<ReturnType<typeof resolveHostTaskView>>['body'] | null,
): string | null {
  if (isAudioPlaying) return AUDIO_WAITING_LABEL;
  return selectionMode?.kind === 'host-task' && selectionBody?.kind === 'message'
    ? selectionBody.text
    : model.message;
}

/** Status shared by the room information area and the action panel. */
export function RoomActionStatus({
  model,
  summary,
  isAudioPlaying,
  hostManagement,
  selectionMode,
  boardStatus,
}: {
  readonly model: RoomPlayerActionModel;
  readonly summary: ReactNode;
  readonly isAudioPlaying: boolean;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly selectionMode?: RoomSelectionMode;
  readonly boardStatus?: {
    readonly phaseLabel: string | null;
    readonly title: string | null;
    readonly detail: string | null;
    readonly compactContent?: ReactNode;
    readonly compactIcon?: ReactNode;
    readonly additionalContent?: ReactNode;
  };
}) {
  const taskBody =
    selectionMode?.kind === 'host-task' && hostManagement !== null
      ? resolveHostTaskView(hostManagement)?.body
      : null;
  const message = resolveStatusMessage(model, isAudioPlaying, selectionMode, taskBody ?? null);
  const hasSummary = summary !== null && summary !== undefined && summary !== false;
  const title =
    isAudioPlaying || selectionMode !== undefined ? message : (boardStatus?.title ?? message);
  if (boardStatus !== undefined) {
    if (
      boardStatus.compactContent !== null &&
      boardStatus.compactContent !== undefined &&
      !isAudioPlaying &&
      selectionMode === undefined
    ) {
      return (
        <>
          {boardStatus.compactContent}
          {model.progress !== null && <RoomProgressIndicator progress={model.progress} />}
        </>
      );
    }
    // The compact status is the board's only status surface (every seats-content game).
    const hasStatus =
      boardStatus.phaseLabel !== null ||
      (title !== null && title.length > 0) ||
      boardStatus.detail !== null;
    return (
      <>
        {hasStatus && (
          <RoomCompactStatus
            context={boardStatus.phaseLabel}
            message={title}
            progress={!isAudioPlaying && selectionMode === undefined ? boardStatus.detail : null}
            icon={boardStatus.compactIcon}
            inline={boardStatus.title !== null && !isAudioPlaying && selectionMode === undefined}
            statusTestId={isAudioPlaying ? TESTIDS.audioWaitingMessage : TESTIDS.actionMessage}
          >
            {boardStatus.additionalContent}
          </RoomCompactStatus>
        )}
        {hasSummary && <div className="room-board-status-summary">{summary}</div>}
        {model.progress !== null && <RoomProgressIndicator progress={model.progress} />}
      </>
    );
  }
  return (
    <>
      {hasSummary && <div className="bottom-action-summary">{summary}</div>}
      {model.progress !== null && <RoomProgressIndicator progress={model.progress} />}
      {message !== null && message.length > 0 && (
        <p
          className="bottom-action-message"
          data-animate="true"
          aria-live="polite"
          data-testid={isAudioPlaying ? TESTIDS.audioWaitingMessage : TESTIDS.actionMessage}
        >
          {message}
        </p>
      )}
    </>
  );
}
