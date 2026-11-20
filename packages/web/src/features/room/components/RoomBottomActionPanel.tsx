/** Shared single-focus room action card. Games provide render-ready action models. */
import './RoomBottomActionPanel.css';

import {
  type CSSProperties,
  memo,
  type ReactNode,
  type Ref,
  useCallback,
  useId,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/Button';
import { IonIcon } from '@/components/icons/IonIcon';
import { Spinner } from '@/components/Spinner';
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
  type RoomHostManagementAction,
  type RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import IconArrowBack from '~icons/ion/arrow-back';
import IconBookOutline from '~icons/ion/book-outline';
import IconConstructOutline from '~icons/ion/construct-outline';
import IconCreateOutline from '~icons/ion/create-outline';
import IconHandLeftOutline from '~icons/ion/hand-left-outline';
import IconLockClosedOutline from '~icons/ion/lock-closed-outline';
import IconOptionsOutline from '~icons/ion/options-outline';

import { PendingActionMarker, RoomActionHand, RoomHandCard } from './RoomActionHand';
import { resolveRoomBottomActionPresentation } from './RoomBottomActionPresentation';
import { DisabledReasonCaption } from './RoomControls';

interface RoomManualEntry {
  readonly label: string;
  readonly testId?: string;
  readonly icon?: ReactNode;
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

function resolveStatusMessage(
  model: RoomBottomActionModel,
  isAudioPlaying: boolean,
  selectionBody: NonNullable<ReturnType<typeof resolveHostTaskView>>['body'] | null,
): string | null {
  if (isAudioPlaying) return AUDIO_WAITING_LABEL;
  return selectionBody?.kind === 'message' ? selectionBody.text : model.message;
}

/** Status shared by the room information area and the legacy bottom panel. */
export function RoomActionStatus({
  model,
  summary,
  isAudioPlaying,
  hostManagement,
  isSelecting,
  selectionUsesHostTask,
  boardStatus,
}: {
  readonly model: RoomBottomActionModel;
  readonly summary: ReactNode;
  readonly isAudioPlaying: boolean;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly isSelecting: boolean;
  readonly selectionUsesHostTask: boolean;
  readonly boardStatus?: {
    readonly phaseLabel: string | null;
    readonly title: string | null;
    readonly detail: string | null;
    readonly summaryReplacesMessage?: boolean;
    readonly summaryIsStatus?: boolean;
  };
}) {
  const taskBody =
    isSelecting && selectionUsesHostTask && hostManagement !== null
      ? resolveHostTaskView(hostManagement)?.body
      : null;
  const message = resolveStatusMessage(model, isAudioPlaying, taskBody ?? null);
  const hasSummary = summary !== null && summary !== undefined && summary !== false;
  const title =
    isAudioPlaying || isSelecting
      ? message
      : boardStatus?.summaryReplacesMessage && hasSummary
        ? boardStatus.title
        : (boardStatus?.title ?? message);
  if (boardStatus !== undefined) {
    if (boardStatus.summaryIsStatus && hasSummary && !isAudioPlaying && !isSelecting) {
      return (
        <>
          {summary}
          {model.progress !== null && <RoomProgressIndicator progress={model.progress} />}
        </>
      );
    }
    return (
      <>
        {(boardStatus.phaseLabel !== null ||
          (title !== null && title.length > 0) ||
          (!isAudioPlaying && !isSelecting && boardStatus.detail !== null) ||
          hasSummary) && (
          <div className="room-board-status-card">
            {boardStatus.phaseLabel !== null && (
              <p className="room-board-phase">{boardStatus.phaseLabel}</p>
            )}
            {hasSummary && <div className="room-board-status-summary">{summary}</div>}
            {title !== null && title.length > 0 && (
              <h2
                className={hasSummary ? 'room-board-status-detail' : 'room-board-status-title'}
                aria-live="polite"
                data-testid={isAudioPlaying ? TESTIDS.audioWaitingMessage : TESTIDS.actionMessage}
              >
                {title}
              </h2>
            )}
            {!isAudioPlaying && !isSelecting && boardStatus.detail !== null && (
              <p className="room-board-status-detail">{boardStatus.detail}</p>
            )}
          </div>
        )}
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

function LayoutButton({
  model,
  hideAudioLockReason,
  isHand = false,
}: {
  readonly model: RoomBottomButton | RoomBottomToolButton | RoomHostManagementAction;
  readonly hideAudioLockReason: boolean;
  readonly isHand?: boolean;
}) {
  const reasonId = useId();
  const focusOnMount = 'focusOnMount' in model && model.focusOnMount === true;
  const buttonRef = useCallback(
    (button: HTMLButtonElement | null) => {
      if (button !== null && focusOnMount) button.focus({ preventScroll: true });
    },
    [focusOnMount],
  );
  const style: CSSProperties = {
    ...('textColor' in model ? { color: model.textColor } : {}),
    ...('buttonColor' in model ? { background: model.buttonColor } : {}),
  };
  const reason = model.isEnabled
    ? null
    : visibleDisabledReason(model.disabledReason, hideAudioLockReason);
  const isLoading = 'isLoading' in model && model.isLoading === true;
  const explanation =
    !model.isEnabled && !isLoading ? model.disabledReason || '当前暂不可用' : null;
  const isPending = isHand && 'isPending' in model && model.isPending === true;
  return (
    <div className="bottom-action-slot">
      <Button
        ref={buttonRef}
        variant={
          'variant' in model ? model.variant : model.tone === 'danger' ? 'danger' : 'secondary'
        }
        size={'size' in model ? model.size : 'md'}
        loading={isLoading}
        data-card-category={isHand ? (model.category ?? 'player') : undefined}
        data-disabled-reason={isHand ? (explanation ?? undefined) : undefined}
        disabled={!model.isEnabled && !isHand}
        aria-disabled={isHand && !model.isEnabled && explanation !== null ? true : undefined}
        aria-label={isHand && (explanation !== null || isPending) ? model.label : undefined}
        aria-describedby={isHand && (explanation !== null || isPending) ? reasonId : undefined}
        style={style}
        data-testid={model.testID}
        data-player-action-ids={
          'containedActionTestIDs' in model ? model.containedActionTestIDs?.join(' ') : undefined
        }
        onClick={model.isEnabled ? model.onPress : undefined}
      >
        {isHand && isLoading ? (
          <Spinner label="提交中" />
        ) : isHand && explanation !== null ? (
          <IconLockClosedOutline aria-hidden />
        ) : model.icon !== undefined ? (
          <IonIcon name={model.icon} />
        ) : (
          isHand && <IconHandLeftOutline aria-hidden />
        )}
        <span>{model.label}</span>
        {isPending && <PendingActionMarker />}
        {isHand && (explanation !== null || isPending) && (
          <span id={reasonId} className="visually-hidden">
            {isPending ? '有待处理操作' : ''}
            {isPending && explanation !== null ? '；' : ''}
            {explanation}
          </span>
        )}
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
  selectionAction,
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
  readonly selectionAction: RoomHostManagementAction | null;
}) {
  const actions = listRoomBottomButtons(model);
  return (
    <>
      <RoomActionHand label="行动手牌">
        {actions.map((action) => (
          <RoomHandCard
            key={`action:${action.key}`}
            unavailable={!action.isEnabled || ('isLoading' in action && action.isLoading === true)}
            category={
              ('variant' in action && action.variant === 'danger') ||
              ('tone' in action && action.tone === 'danger')
                ? 'danger'
                : (action.category ?? 'player')
            }
          >
            <LayoutButton model={action} hideAudioLockReason={isAudioPlaying} isHand />
          </RoomHandCard>
        ))}
        {selectionAction !== null && (
          <RoomHandCard
            key={`selection:${selectionAction.key}`}
            unavailable={!selectionAction.isEnabled || selectionAction.isLoading === true}
            category={
              selectionAction.variant === 'danger'
                ? 'danger'
                : (selectionAction.category ?? 'player')
            }
          >
            <LayoutButton model={selectionAction} hideAudioLockReason={isAudioPlaying} isHand />
          </RoomHandCard>
        )}
        {configurationEntry !== null && (
          <RoomHandCard key="room-entry:configuration" category="resource">
            <Button
              variant="secondary"
              data-card-category="resource"
              onClick={configurationEntry.onOpen}
              aria-haspopup="dialog"
            >
              <IconOptionsOutline aria-hidden />
              <span>本局配置</span>
            </Button>
          </RoomHandCard>
        )}
        {hasManual && (
          <RoomHandCard key="room-entry:manual" category="resource">
            <Button
              ref={manualEntryRef}
              variant="secondary"
              data-card-category="resource"
              data-testid={TESTIDS.roomManualButton}
              onClick={onOpenManual}
            >
              <IconBookOutline aria-hidden />
              <span>手册</span>
            </Button>
          </RoomHandCard>
        )}
        {mainEntries.map((entry) => (
          <RoomHandCard key={`main-entry:${entry.label}`} category="resource">
            <Button
              variant="secondary"
              data-card-category="resource"
              aria-haspopup="dialog"
              data-testid={entry.testId}
              onClick={entry.onOpen}
            >
              {entry.icon ?? <IconCreateOutline aria-hidden />}
              <span>{entry.label}</span>
            </Button>
          </RoomHandCard>
        ))}
        {hasMoreActions && (
          <RoomHandCard key="room-entry:host" category="host">
            <Button
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
              {hasReadyTask && <PendingActionMarker />}
            </Button>
          </RoomHandCard>
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
  isSelecting = false,
  selectionUsesHostTask = false,
  statusInBoard = false,
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
  readonly isSelecting?: boolean;
  readonly selectionUsesHostTask?: boolean;
  readonly statusInBoard?: boolean;
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
  const hasManual =
    showPlayerHand && !isSelecting && manualEntries !== undefined && manualEntries.length > 0;
  if (isManualOpen && !hasManual) setIsManualOpen(false);
  const hasSummary = summary !== null && summary !== undefined && summary !== false;
  const { focusAction, additionalActions, hasMultiplePrimaryChoices } =
    resolveRoomBottomActionPresentation(model);
  const hiddenActions = showPlayerHand ? [] : additionalActions;
  const hasMoreActions = !isSelecting && (hiddenActions.length > 0 || hostManagement !== null);
  const taskLabel = hostManagement === null ? null : hostTaskLabel(hostManagement);
  const taskBody =
    !showPlayerHand || hostManagement === null ? null : resolveHostTaskView(hostManagement)?.body;
  const selectionAction =
    isSelecting && selectionUsesHostTask && taskBody?.kind === 'message' ? taskBody.escape : null;
  const hasReadyTask =
    (hostManagement?.pendingActionKeys?.length ?? 0) > 0 ||
    hostManagement?.hasPendingDecision === true;
  const moreActionsLabel =
    hiddenActions.length === 0 && hostManagement !== null
      ? HOST_MANAGEMENT_LABEL
      : hasMultiplePrimaryChoices && hostManagement === null
        ? '选择操作'
        : '更多操作';
  const statusMessage = resolveStatusMessage(
    model,
    isAudioPlaying,
    isSelecting && selectionUsesHostTask ? (taskBody ?? null) : null,
  );
  if (
    !hasSummary &&
    statusMessage === null &&
    configurationEntry === null &&
    (isSelecting || mainEntries.length === 0) &&
    !hasManual &&
    isRoomBottomActionModelEmpty(model) &&
    selectionAction === null &&
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
      {!statusInBoard && (
        <RoomActionStatus
          model={model}
          summary={summary}
          isAudioPlaying={isAudioPlaying}
          hostManagement={hostManagement}
          isSelecting={isSelecting}
          selectionUsesHostTask={showPlayerHand && selectionUsesHostTask}
        />
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
                {entry.icon ?? <IconBookOutline aria-hidden />}
                <span>{entry.label}</span>
              </Button>
            ))}
          </RoomActionHand>
        ) : showPlayerHand ? (
          <PlayerHand
            model={model}
            isAudioPlaying={isAudioPlaying}
            configurationEntry={isSelecting ? null : configurationEntry}
            hasManual={hasManual}
            manualEntryRef={manualEntryRef}
            onOpenManual={() => setIsManualOpen(true)}
            mainEntries={isSelecting ? [] : mainEntries}
            hasMoreActions={hasMoreActions}
            hostEntryRef={hostEntryRef}
            onOpenMoreActions={onOpenMoreActions}
            hasReadyTask={hasReadyTask}
            moreActionsLabel={moreActionsLabel}
            selectionAction={selectionAction}
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
