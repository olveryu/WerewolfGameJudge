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

import { IonIcon } from '@/components/icons/IonIcon';
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
import IconOptionsOutline from '~icons/ion/options-outline';

import { RoomActionHand, type RoomHandCard } from './RoomActionHand';
import type { RoomSelectionMode, RoomSummaryPresentation } from './RoomBottomActionPresentation';
import { RoomHandButton } from './RoomHandButton';

interface RoomManualEntry {
  readonly label: string;
  readonly testId?: string;
  readonly icon?: ReactNode;
  readonly onOpen: () => void;
}

function focusManualBack(button: HTMLButtonElement | null) {
  button?.focus({ preventScroll: true });
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
  selectionMode: RoomSelectionMode | undefined,
  selectionBody: NonNullable<ReturnType<typeof resolveHostTaskView>>['body'] | null,
): string | null {
  if (isAudioPlaying) return AUDIO_WAITING_LABEL;
  return selectionMode === 'host-task' && selectionBody?.kind === 'message'
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
  readonly model: RoomBottomActionModel;
  readonly summary: ReactNode;
  readonly isAudioPlaying: boolean;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly selectionMode?: RoomSelectionMode;
  readonly boardStatus?: {
    readonly phaseLabel: string | null;
    readonly title: string | null;
    readonly detail: string | null;
    readonly summaryPresentation?: RoomSummaryPresentation;
  };
}) {
  const taskBody =
    selectionMode === 'host-task' && hostManagement !== null
      ? resolveHostTaskView(hostManagement)?.body
      : null;
  const message = resolveStatusMessage(model, isAudioPlaying, selectionMode, taskBody ?? null);
  const hasSummary = summary !== null && summary !== undefined && summary !== false;
  const title =
    isAudioPlaying || selectionMode !== undefined
      ? message
      : boardStatus?.summaryPresentation === 'replaces-message' && hasSummary
        ? boardStatus.title
        : (boardStatus?.title ?? message);
  if (boardStatus !== undefined) {
    if (
      boardStatus.summaryPresentation === 'status' &&
      hasSummary &&
      !isAudioPlaying &&
      selectionMode === undefined
    ) {
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
          (!isAudioPlaying && selectionMode === undefined && boardStatus.detail !== null) ||
          hasSummary) && (
          <div className="room-board-status-card">
            {boardStatus.phaseLabel !== null && (
              <p className="room-board-phase">{boardStatus.phaseLabel}</p>
            )}
            {hasSummary && boardStatus.summaryPresentation !== 'after-message' && (
              <div className="room-board-status-summary">{summary}</div>
            )}
            {title !== null && title.length > 0 && (
              <h2
                className={hasSummary ? 'room-board-status-detail' : 'room-board-status-title'}
                aria-live="polite"
                data-testid={isAudioPlaying ? TESTIDS.audioWaitingMessage : TESTIDS.actionMessage}
              >
                {title}
              </h2>
            )}
            {!isAudioPlaying && selectionMode === undefined && boardStatus.detail !== null && (
              <p className="room-board-status-detail">{boardStatus.detail}</p>
            )}
            {hasSummary && boardStatus.summaryPresentation === 'after-message' && (
              <div className="room-board-status-summary">{summary}</div>
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
}: {
  readonly model: RoomBottomButton | RoomBottomToolButton | RoomHostManagementAction;
}) {
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
  const isLoading = 'isLoading' in model && model.isLoading === true;
  const disabledReason =
    !model.isEnabled && 'disabledReason' in model ? model.disabledReason : null;
  const isPending = 'isPending' in model && model.isPending === true;
  const variant =
    'variant' in model ? model.variant : model.tone === 'danger' ? 'danger' : 'secondary';
  return (
    <div className="bottom-action-slot">
      <RoomHandButton
        ref={buttonRef}
        model={{
          label: model.label,
          category: model.category ?? 'player',
          variant,
          size: 'size' in model ? model.size : 'md',
          icon: model.icon === undefined ? undefined : <IonIcon name={model.icon} />,
          isEnabled: model.isEnabled,
          onPress: model.isEnabled ? model.onPress : undefined,
          disabledReason,
          isLoading,
          isPending,
          testId: model.testID,
          dataPlayerActionIds:
            'containedActionTestIDs' in model ? model.containedActionTestIDs?.join(' ') : undefined,
          style,
        }}
      />
    </div>
  );
}

function PlayerHand({
  model,
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
  const cards: RoomHandCard[] = actions.map((action) => ({
    id: `action:${action.key}`,
    category:
      ('variant' in action && action.variant === 'danger') ||
      ('tone' in action && action.tone === 'danger')
        ? 'danger'
        : (action.category ?? 'player'),
    unavailable: !action.isEnabled || ('isLoading' in action && action.isLoading === true),
    content: <LayoutButton model={action} />,
  }));
  if (selectionAction !== null) {
    cards.push({
      id: `selection:${selectionAction.key}`,
      category:
        selectionAction.variant === 'danger' ? 'danger' : (selectionAction.category ?? 'player'),
      unavailable: !selectionAction.isEnabled || selectionAction.isLoading === true,
      content: <LayoutButton model={selectionAction} />,
    });
  }
  if (configurationEntry !== null) {
    cards.push({
      id: 'room-entry:configuration',
      category: 'resource',
      content: (
        <RoomHandButton
          model={{
            label: '本局配置',
            category: 'resource',
            variant: 'secondary',
            isEnabled: true,
            onPress: configurationEntry.onOpen,
            icon: <IconOptionsOutline aria-hidden />,
            ariaHasPopup: 'dialog',
          }}
        />
      ),
    });
  }
  if (hasManual) {
    cards.push({
      id: 'room-entry:manual',
      category: 'resource',
      content: (
        <RoomHandButton
          ref={manualEntryRef}
          model={{
            label: '手册',
            category: 'resource',
            variant: 'secondary',
            isEnabled: true,
            onPress: onOpenManual,
            icon: <IconBookOutline aria-hidden />,
            testId: TESTIDS.roomManualButton,
          }}
        />
      ),
    });
  }
  for (const entry of mainEntries) {
    cards.push({
      id: `main-entry:${entry.label}`,
      category: 'resource',
      content: (
        <RoomHandButton
          model={{
            label: entry.label,
            category: 'resource',
            variant: 'secondary',
            isEnabled: true,
            onPress: entry.onOpen,
            icon: entry.icon ?? <IconCreateOutline aria-hidden />,
            testId: entry.testId,
            ariaHasPopup: 'dialog',
          }}
        />
      ),
    });
  }
  if (hasMoreActions) {
    cards.push({
      id: 'room-entry:host',
      category: 'host',
      content: (
        <RoomHandButton
          ref={hostEntryRef}
          model={{
            label: moreActionsLabel,
            category: 'host',
            variant: 'secondary',
            isEnabled: true,
            onPress: onOpenMoreActions,
            icon: <IconConstructOutline aria-hidden />,
            testId: TESTIDS.roomMoreActionsButton,
            dataPlayerActionIds: '',
            ariaLabel: hasReadyTask ? `${moreActionsLabel}，有待处理操作` : undefined,
            isPending: hasReadyTask,
          }}
        />
      ),
    });
  }
  return <RoomActionHand label="行动手牌" cards={cards} />;
}

function RoomBottomActionPanelComponent({
  model,
  summary,
  isAudioPlaying,
  hostManagement,
  onOpenMoreActions,
  configurationEntry = null,
  selectionMode,
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
  readonly selectionMode?: RoomSelectionMode;
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
    selectionMode === undefined && manualEntries !== undefined && manualEntries.length > 0;
  if (isManualOpen && !hasManual) setIsManualOpen(false);
  const hasSummary = summary !== null && summary !== undefined && summary !== false;
  const hasMoreActions = selectionMode === undefined && hostManagement !== null;
  const taskBody =
    selectionMode !== 'host-task' || hostManagement === null
      ? null
      : resolveHostTaskView(hostManagement)?.body;
  const selectionAction =
    selectionMode === 'host-task' && taskBody?.kind === 'message' ? taskBody.escape : null;
  const hasReadyTask =
    (hostManagement?.pendingActionKeys?.length ?? 0) > 0 ||
    hostManagement?.hasPendingDecision === true;
  const moreActionsLabel = HOST_MANAGEMENT_LABEL;
  const statusMessage = resolveStatusMessage(
    model,
    isAudioPlaying,
    selectionMode,
    taskBody ?? null,
  );
  if (
    !hasSummary &&
    statusMessage === null &&
    (selectionMode !== undefined || configurationEntry === null) &&
    (selectionMode !== undefined || mainEntries.length === 0) &&
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
      data-testid={TESTIDS.bottomActionPanel}
    >
      {!statusInBoard && (
        <RoomActionStatus
          model={model}
          summary={summary}
          isAudioPlaying={isAudioPlaying}
          hostManagement={hostManagement}
          selectionMode={selectionMode}
        />
      )}
      {hostHand ??
        (isManualOpen && hasManual ? (
          <RoomActionHand
            label="手册"
            cards={[
              {
                id: 'manual:back',
                category: 'back',
                content: (
                  <RoomHandButton
                    ref={focusManualBack}
                    model={{
                      label: '返回',
                      category: 'back',
                      variant: 'secondary',
                      isEnabled: true,
                      onPress: () => {
                        restoreManualFocus.current = true;
                        setIsManualOpen(false);
                      },
                      icon: <IconArrowBack aria-hidden />,
                      testId: TESTIDS.roomManualBackButton,
                    }}
                  />
                ),
              },
              ...manualEntries.map((entry) => ({
                id: `manual:${entry.label}`,
                category: 'resource' as const,
                content: (
                  <RoomHandButton
                    model={{
                      label: entry.label,
                      category: 'resource',
                      variant: 'secondary',
                      isEnabled: true,
                      onPress: entry.onOpen,
                      icon: entry.icon ?? <IconBookOutline aria-hidden />,
                      testId: entry.testId,
                      ariaHasPopup: 'dialog',
                    }}
                  />
                ),
              })),
            ]}
          />
        ) : (
          <PlayerHand
            model={model}
            configurationEntry={selectionMode === undefined ? configurationEntry : null}
            hasManual={hasManual}
            manualEntryRef={manualEntryRef}
            onOpenManual={() => setIsManualOpen(true)}
            mainEntries={selectionMode === undefined ? mainEntries : []}
            hasMoreActions={hasMoreActions}
            hostEntryRef={hostEntryRef}
            onOpenMoreActions={onOpenMoreActions}
            hasReadyTask={hasReadyTask}
            moreActionsLabel={moreActionsLabel}
            selectionAction={selectionAction}
          />
        ))}
    </footer>
  );
}

export const RoomBottomActionPanel = memo(RoomBottomActionPanelComponent);
