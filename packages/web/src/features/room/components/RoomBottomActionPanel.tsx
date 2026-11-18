/** Shared single-focus room action card. Games provide render-ready action models. */
import './RoomBottomActionPanel.css';

import { type CSSProperties, memo, type ReactNode } from 'react';

import { Button } from '@/components/Button';
import { IonIcon } from '@/components/icons/IonIcon';
import { AUDIO_PLAYBACK_LOCK_REASON } from '@/features/room/model/audioPlaybackLock';
import type { NightStepProgress } from '@/features/room/model/nightProgress';
import { resolveHostTaskView } from '@/features/room/model/resolveHostTaskView';
import {
  AUDIO_WAITING_LABEL,
  isRoomBottomActionModelEmpty,
  type RoomBottomActionModel,
  type RoomBottomButton,
} from '@/features/room/model/RoomBottomActions';
import {
  HOST_MANAGEMENT_LABEL,
  type RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';

import { resolveRoomBottomActionPresentation } from './RoomBottomActionPresentation';
import { DisabledReasonCaption } from './RoomControls';

/**
 * A disabled reason stays visible unless the panel already announces the audio playback
 * lock above it: the lock reason must appear once.
 */
function visibleDisabledReason(reason: string | null, hideAudioLockReason: boolean): string | null {
  if (reason === null || reason.length === 0) return null;
  return hideAudioLockReason && reason === AUDIO_PLAYBACK_LOCK_REASON ? null : reason;
}

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

function LayoutButton({
  model,
  hideAudioLockReason,
}: {
  readonly model: RoomBottomButton;
  readonly hideAudioLockReason: boolean;
}) {
  const style: CSSProperties = {
    ...(model.textColor === undefined ? {} : { color: model.textColor }),
    ...(model.buttonColor === undefined ? {} : { background: model.buttonColor }),
  };
  const reason = model.isEnabled
    ? null
    : visibleDisabledReason(model.disabledReason, hideAudioLockReason);
  return (
    <div className="bottom-action-slot">
      <Button
        variant={model.variant}
        size={model.size}
        loading={model.isLoading === true}
        disabled={!model.isEnabled}
        style={style}
        data-testid={model.testID}
        onClick={model.isEnabled ? model.onPress : undefined}
      >
        {model.icon !== undefined && <IonIcon name={model.icon} />}
        {model.label}
      </Button>
      {reason !== null && <DisabledReasonCaption reason={reason} />}
    </div>
  );
}

function hostTaskLabel(model: RoomHostManagementModel): string | null {
  const view = resolveHostTaskView(model);
  if (view === null) return null;
  switch (view.body.kind) {
    case 'ready':
    case 'blocked':
      return view.body.action.label;
    case 'choice':
      return view.body.actions.map((action) => action.label).join(' / ');
    case 'message':
      return view.body.text;
  }
}

function RoomBottomActionPanelComponent({
  model,
  summary,
  isAudioPlaying,
  hostManagement,
  onOpenMoreActions,
}: {
  readonly model: RoomBottomActionModel;
  readonly summary: ReactNode;
  readonly isAudioPlaying: boolean;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly onOpenMoreActions: () => void;
}) {
  const hasSummary = summary !== null && summary !== undefined && summary !== false;
  const { focusAction, additionalActions, hasMultiplePrimaryChoices } =
    resolveRoomBottomActionPresentation(model);
  const hasMoreActions = additionalActions.length > 0 || hostManagement !== null;
  const taskLabel = hostManagement === null ? null : hostTaskLabel(hostManagement);
  const moreActionsLabel =
    additionalActions.length === 0 && hostManagement !== null
      ? HOST_MANAGEMENT_LABEL
      : hasMultiplePrimaryChoices && hostManagement === null
        ? '选择操作'
        : '更多操作';
  const statusMessage = isAudioPlaying ? AUDIO_WAITING_LABEL : model.message;
  if (
    !hasSummary &&
    statusMessage === null &&
    isRoomBottomActionModelEmpty(model) &&
    !hasMoreActions
  ) {
    return null;
  }

  return (
    <footer
      className="bottom-action-panel"
      data-kind={model.kind}
      data-testid={TESTIDS.bottomActionPanel}
    >
      {hasSummary && <div className="bottom-action-summary">{summary}</div>}
      {model.progress !== null && <RoomProgressIndicator progress={model.progress} />}
      {statusMessage !== null && statusMessage.length > 0 && (
        <p
          className="bottom-action-message"
          data-animate="true"
          aria-live="polite"
          data-testid={isAudioPlaying ? TESTIDS.audioWaitingMessage : TESTIDS.actionMessage}
        >
          {statusMessage}
        </p>
      )}
      <div
        className="bottom-action-control-row"
        data-has-focus={focusAction === null ? 'false' : 'true'}
      >
        {focusAction !== null && (
          <div className="bottom-action-focus">
            <LayoutButton model={focusAction} hideAudioLockReason={isAudioPlaying} />
          </div>
        )}
        {hasMoreActions && (
          <Button
            variant={focusAction === null ? 'primary' : 'secondary'}
            className="bottom-action-more"
            data-testid={TESTIDS.roomMoreActionsButton}
            onClick={onOpenMoreActions}
            aria-haspopup="dialog"
          >
            <span className="bottom-action-more-title">{moreActionsLabel}</span>
            {taskLabel !== null && (
              <span className="bottom-action-more-hint">当前待办 · {taskLabel}</span>
            )}
          </Button>
        )}
      </div>
    </footer>
  );
}

export const RoomBottomActionPanel = memo(RoomBottomActionPanelComponent);
