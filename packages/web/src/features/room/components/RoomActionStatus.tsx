import './RoomBottomActionPanel.css';

import type { ReactElement, ReactNode } from 'react';

import type { NightStepProgress } from '@/features/room/model/nightProgress';
import { resolveHostTaskView } from '@/features/room/model/resolveHostTaskView';
import type { RoomBoardStatusModel } from '@/features/room/model/RoomBoardStatus';
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

/**
 * Status shared by the room information area and the action panel. Above the seats it renders
 * exactly one status bar: the game's status (or the shell's phase/lobby status), whose message
 * line the audio or selection prompt replaces.
 */
export function RoomActionStatus({
  model,
  isAudioPlaying,
  hostManagement,
  selectionMode,
  board,
}: {
  readonly model: RoomPlayerActionModel;
  readonly isAudioPlaying: boolean;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly selectionMode?: RoomSelectionMode;
  readonly board?: {
    readonly phaseLabel: string | null;
    readonly lobbyTitle: string | null;
    readonly lobbyDetail: string | null;
    readonly icon: ReactElement | null;
    readonly gameStatus: RoomBoardStatusModel | null;
    /** Extra lines (e.g. public announcements) kept inside the one bar in every phase. */
    readonly additionalContent?: ReactNode;
  };
}) {
  const taskBody =
    selectionMode?.kind === 'host-task' && hostManagement !== null
      ? resolveHostTaskView(hostManagement)?.body
      : null;
  const message = resolveStatusMessage(model, isAudioPlaying, selectionMode, taskBody ?? null);
  if (board !== undefined) {
    const isPromptOverride = isAudioPlaying || selectionMode !== undefined;
    const gameStatus = board.gameStatus;
    const status =
      gameStatus === null
        ? {
            context: board.phaseLabel,
            message: isPromptOverride ? message : (board.lobbyTitle ?? message),
            progress: isPromptOverride ? null : board.lobbyDetail,
            pendingSeats: null,
            icon: board.icon,
            attachment: null,
            inline: board.lobbyTitle !== null && !isPromptOverride,
          }
        : {
            ...gameStatus,
            context: gameStatus.context ?? board.phaseLabel,
            icon: gameStatus.icon ?? board.icon,
            message: isPromptOverride ? message : gameStatus.message,
            progress: isPromptOverride ? null : gameStatus.progress,
            pendingSeats: isPromptOverride ? null : gameStatus.pendingSeats,
            inline: false,
          };
    const hasAdditionalContent =
      board.additionalContent !== null && board.additionalContent !== undefined;
    const hasStatus =
      status.context !== null ||
      (status.message !== null && status.message.length > 0) ||
      status.progress !== null ||
      status.attachment !== null ||
      hasAdditionalContent;
    return (
      <>
        {hasStatus && (
          <RoomCompactStatus
            context={status.context}
            message={status.message}
            progress={status.progress}
            pendingSeats={status.pendingSeats?.seats ?? null}
            {...(status.pendingSeats === null ? {} : { pendingLabel: status.pendingSeats.label })}
            pendingTestId={status.pendingSeats?.testId}
            icon={status.icon}
            attachment={status.attachment}
            inline={status.inline}
            testId={gameStatus?.testId}
            contextTestId={gameStatus?.contextTestId}
            statusTestId={isAudioPlaying ? TESTIDS.audioWaitingMessage : TESTIDS.actionMessage}
          >
            {board.additionalContent}
          </RoomCompactStatus>
        )}
        {model.progress !== null && <RoomProgressIndicator progress={model.progress} />}
      </>
    );
  }
  return (
    <>
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
