/** Shared single-focus room action card. Games provide render-ready action models. */
import './RoomBottomActionPanel.css';

import {
  type CSSProperties,
  memo,
  type ReactNode,
  type Ref,
  useCallback,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/Button';
import { IonIcon } from '@/components/icons/IonIcon';
import { AUDIO_PLAYBACK_LOCK_REASON } from '@/features/room/model/audioPlaybackLock';
import type { NightStepProgress } from '@/features/room/model/nightProgress';
import { resolveHostTaskView } from '@/features/room/model/resolveHostTaskView';
import {
  AUDIO_WAITING_LABEL,
  isRoomBottomActionModelEmpty,
  listRoomBottomButtons,
  type RoomBottomActionModel,
  type RoomBottomButton,
  type RoomBottomToolButton,
} from '@/features/room/model/RoomBottomActions';
import {
  HOST_MANAGEMENT_LABEL,
  type RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import IconArrowBack from '~icons/ion/arrow-back';
import IconBookOutline from '~icons/ion/book-outline';
import IconConstructOutline from '~icons/ion/construct-outline';
import IconCreateOutline from '~icons/ion/create-outline';
import IconHandLeftOutline from '~icons/ion/hand-left-outline';
import IconNotificationsOutline from '~icons/ion/notifications-outline';

import { RoomActionHand } from './RoomActionHand';
import { resolveRoomBottomActionPresentation } from './RoomBottomActionPresentation';
import { DisabledReasonCaption } from './RoomControls';

interface RoomManualEntry {
  readonly label: string;
  readonly testId?: string;
  readonly onOpen: () => void;
}

function focusManualBack(button: HTMLButtonElement | null) {
  button?.focus({ preventScroll: true });
}

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
  isHand = false,
}: {
  readonly model: RoomBottomButton | RoomBottomToolButton;
  readonly hideAudioLockReason: boolean;
  readonly isHand?: boolean;
}) {
  const style: CSSProperties = {
    ...('textColor' in model ? { color: model.textColor } : {}),
    ...('buttonColor' in model ? { background: model.buttonColor } : {}),
  };
  const reason = model.isEnabled
    ? null
    : visibleDisabledReason(model.disabledReason, hideAudioLockReason);
  return (
    <div className="bottom-action-slot">
      <Button
        variant={
          'variant' in model ? model.variant : model.tone === 'danger' ? 'danger' : 'secondary'
        }
        size={'size' in model ? model.size : 'md'}
        loading={'isLoading' in model && model.isLoading === true}
        disabled={!model.isEnabled}
        style={style}
        data-testid={model.testID}
        onClick={model.isEnabled ? model.onPress : undefined}
      >
        {model.icon !== undefined ? (
          <IonIcon name={model.icon} />
        ) : (
          isHand && <IconHandLeftOutline aria-hidden />
        )}
        <span>{model.label}</span>
      </Button>
      {!isHand && reason !== null && <DisabledReasonCaption reason={reason} />}
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

function PlayerHand({
  model,
  isAudioPlaying,
  configurationEntry,
  hasManual,
  manualEntryRef,
  onOpenManual,
  mainEntries,
  hasMoreActions,
  hostEntryRef,
  onOpenMoreActions,
  hasReadyTask,
  moreActionsLabel,
}: {
  readonly model: RoomBottomActionModel;
  readonly isAudioPlaying: boolean;
  readonly configurationEntry: { readonly onOpen: () => void } | null;
  readonly hasManual: boolean;
  readonly manualEntryRef: Ref<HTMLButtonElement>;
  readonly onOpenManual: () => void;
  readonly mainEntries: readonly RoomManualEntry[];
  readonly hasMoreActions: boolean;
  readonly hostEntryRef: Ref<HTMLButtonElement> | undefined;
  readonly onOpenMoreActions: () => void;
  readonly hasReadyTask: boolean;
  readonly moreActionsLabel: string;
}) {
  const actions = listRoomBottomButtons(model);
  return (
    <>
      {actions.map((action) => {
        const reason = action.isEnabled
          ? null
          : visibleDisabledReason(action.disabledReason, isAudioPlaying);
        return reason === null ? null : (
          <p className="bottom-action-message" key={action.key}>
            {action.label}：{reason}
          </p>
        );
      })}
      <RoomActionHand label="行动手牌">
        {actions.map((action) => (
          <LayoutButton
            key={`action:${action.key}`}
            model={action}
            hideAudioLockReason={isAudioPlaying}
            isHand
          />
        ))}
        {configurationEntry !== null && (
          <Button
            key="room-entry:configuration"
            variant="secondary"
            data-card-category="resource"
            onClick={configurationEntry.onOpen}
            aria-haspopup="dialog"
          >
            <IconBookOutline aria-hidden />
            <span>本局配置</span>
          </Button>
        )}
        {hasManual && (
          <Button
            key="room-entry:manual"
            ref={manualEntryRef}
            variant="secondary"
            data-card-category="resource"
            data-testid={TESTIDS.roomManualButton}
            onClick={onOpenManual}
          >
            <IconBookOutline aria-hidden />
            <span>手册</span>
          </Button>
        )}
        {mainEntries.map((entry) => (
          <Button
            key={`main-entry:${entry.label}`}
            variant="secondary"
            aria-haspopup="dialog"
            data-testid={entry.testId}
            onClick={entry.onOpen}
          >
            <IconCreateOutline aria-hidden />
            <span>{entry.label}</span>
          </Button>
        ))}
        {hasMoreActions && (
          <Button
            key="room-entry:host"
            ref={hostEntryRef}
            variant="secondary"
            data-card-category="host"
            data-testid={TESTIDS.roomMoreActionsButton}
            data-player-action-ids=""
            onClick={onOpenMoreActions}
            aria-label={hasReadyTask ? `${moreActionsLabel}，有待处理操作` : undefined}
          >
            <IconConstructOutline aria-hidden />
            <span>{moreActionsLabel}</span>
            {hasReadyTask && (
              <IconNotificationsOutline className="bottom-action-pending" aria-hidden />
            )}
          </Button>
        )}
      </RoomActionHand>
    </>
  );
}

function RoomBottomActionPanelComponent({
  model,
  summary,
  isAudioPlaying,
  hostManagement,
  onOpenMoreActions,
  configurationEntry = null,
  showPlayerHand = false,
  hostHand,
  hostEntryRef,
  manualEntries,
  mainEntries = [],
}: {
  readonly model: RoomBottomActionModel;
  readonly summary: ReactNode;
  readonly isAudioPlaying: boolean;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly onOpenMoreActions: () => void;
  readonly configurationEntry?: { readonly onOpen: () => void } | null;
  readonly showPlayerHand?: boolean;
  readonly hostHand?: ReactNode;
  readonly hostEntryRef?: Ref<HTMLButtonElement>;
  readonly manualEntries?: readonly RoomManualEntry[];
  readonly mainEntries?: readonly RoomManualEntry[];
}) {
  const [isManualOpen, setIsManualOpen] = useState(false);
  const restoreManualFocus = useRef(false);
  const manualEntryRef = useCallback((button: HTMLButtonElement | null) => {
    if (button === null || !restoreManualFocus.current) return;
    restoreManualFocus.current = false;
    button.focus({ preventScroll: true });
  }, []);
  const hasManual = showPlayerHand && manualEntries !== undefined && manualEntries.length > 0;
  if (isManualOpen && !hasManual) setIsManualOpen(false);
  const hasSummary = summary !== null && summary !== undefined && summary !== false;
  const { focusAction, additionalActions, hasMultiplePrimaryChoices } =
    resolveRoomBottomActionPresentation(model);
  const hiddenActions = showPlayerHand ? [] : additionalActions;
  const hasMoreActions = hiddenActions.length > 0 || hostManagement !== null;
  const taskLabel = hostManagement === null ? null : hostTaskLabel(hostManagement);
  const taskBody =
    !showPlayerHand || hostManagement === null ? null : resolveHostTaskView(hostManagement)?.body;
  const hasReadyTask =
    taskBody?.kind === 'ready'
      ? taskBody.action.isLoading !== true
      : taskBody?.kind === 'choice' &&
        taskBody.actions.some((action) => action.isEnabled && action.isLoading !== true);
  const moreActionsLabel =
    hiddenActions.length === 0 && hostManagement !== null
      ? HOST_MANAGEMENT_LABEL
      : hasMultiplePrimaryChoices && hostManagement === null
        ? '选择操作'
        : '更多操作';
  const statusMessage = isAudioPlaying ? AUDIO_WAITING_LABEL : model.message;
  if (
    !hasSummary &&
    statusMessage === null &&
    configurationEntry === null &&
    mainEntries.length === 0 &&
    !hasManual &&
    isRoomBottomActionModelEmpty(model) &&
    !hasMoreActions
  ) {
    return null;
  }

  return (
    <footer
      className="bottom-action-panel"
      data-kind={model.kind}
      data-hand={showPlayerHand}
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
      {hostHand ??
        (isManualOpen && hasManual ? (
          <RoomActionHand label="手册">
            <Button
              ref={focusManualBack}
              variant="secondary"
              data-testid={TESTIDS.roomManualBackButton}
              onClick={() => {
                restoreManualFocus.current = true;
                setIsManualOpen(false);
              }}
            >
              <IconArrowBack aria-hidden />
              返回
            </Button>
            {manualEntries.map((entry) => (
              <Button
                key={entry.label}
                variant="secondary"
                data-card-category="resource"
                aria-haspopup="dialog"
                data-testid={entry.testId}
                onClick={entry.onOpen}
              >
                <IconBookOutline aria-hidden />
                <span>{entry.label}</span>
              </Button>
            ))}
          </RoomActionHand>
        ) : showPlayerHand ? (
          <PlayerHand
            model={model}
            isAudioPlaying={isAudioPlaying}
            configurationEntry={configurationEntry}
            hasManual={hasManual}
            manualEntryRef={manualEntryRef}
            onOpenManual={() => setIsManualOpen(true)}
            mainEntries={mainEntries}
            hasMoreActions={hasMoreActions}
            hostEntryRef={hostEntryRef}
            onOpenMoreActions={onOpenMoreActions}
            hasReadyTask={hasReadyTask}
            moreActionsLabel={moreActionsLabel}
          />
        ) : (
          <div
            className="bottom-action-control-row"
            data-has-focus={focusAction !== null || configurationEntry !== null}
          >
            {focusAction !== null && (
              <div className="bottom-action-focus">
                <LayoutButton model={focusAction} hideAudioLockReason={isAudioPlaying} />
              </div>
            )}
            {configurationEntry !== null && (
              <Button
                variant="secondary"
                className="bottom-action-focus"
                onClick={configurationEntry.onOpen}
                aria-haspopup="dialog"
              >
                本局配置
              </Button>
            )}
            {hasMoreActions && (
              <Button
                ref={hostEntryRef}
                variant={focusAction === null ? 'primary' : 'secondary'}
                className="bottom-action-more"
                data-testid={TESTIDS.roomMoreActionsButton}
                data-player-action-ids={hiddenActions
                  .filter((action) => action.isEnabled)
                  .map((action) => action.testID)
                  .join(' ')}
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
        ))}
    </footer>
  );
}

export const RoomBottomActionPanel = memo(RoomBottomActionPanelComponent);
