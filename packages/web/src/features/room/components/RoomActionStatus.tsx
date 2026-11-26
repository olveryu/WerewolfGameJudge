import './RoomBottomActionPanel.css';

import type { NightStepProgress } from '@/features/room/model/nightProgress';
import { resolveHostTaskView } from '@/features/room/model/resolveHostTaskView';
import {
  resolveRoomBoardStatus,
  type RoomBoardStatusInput,
} from '@/features/room/model/resolveRoomBoardStatus';
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
  readonly board?: RoomBoardStatusInput;
}) {
  const taskBody =
    selectionMode?.kind === 'host-task' && hostManagement !== null
      ? resolveHostTaskView(hostManagement)?.body
      : null;
  const message = resolveStatusMessage(model, isAudioPlaying, selectionMode, taskBody ?? null);
  if (board !== undefined) {
    const status = resolveRoomBoardStatus(
      board,
      message,
      isAudioPlaying || selectionMode !== undefined,
    );
    return (
      <>
        {status !== null && (
          <RoomCompactStatus
            context={status.context}
            message={status.message}
            progress={status.progress}
            pendingSeats={status.pendingSeats?.seats ?? null}
            {...(status.pendingSeats === null ? {} : { pendingLabel: status.pendingSeats.label })}
            pendingTestId={status.pendingSeats?.testId}
            icon={status.icon}
            notices={status.notices}
            tracks={status.tracks}
            footnote={status.footnote}
            inline={status.inline}
            testId={status.testId}
            contextTestId={status.contextTestId}
            statusTestId={isAudioPlaying ? TESTIDS.audioWaitingMessage : TESTIDS.actionMessage}
          />
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
