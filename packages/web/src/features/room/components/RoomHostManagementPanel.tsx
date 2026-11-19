/** Host management surface: game-owned action sections, as a bottom sheet or a side inspector. */
import './RoomHostManagementPanel.css';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { IonIcon } from '@/components/icons/IonIcon';
import { AUDIO_PLAYBACK_LOCK_REASON } from '@/features/room/model/audioPlaybackLock';
import {
  resolveHostTaskView,
  type RoomHostTaskBody,
} from '@/features/room/model/resolveHostTaskView';
import type { RoomBottomActionModel } from '@/features/room/model/RoomBottomActions';
import {
  HOST_MANAGEMENT_LABEL,
  type RoomHostManagementAction,
  type RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import IconArrowForward from '~icons/ion/arrow-forward';
import IconCheckmarkCircle from '~icons/ion/checkmark-circle';
import IconClose from '~icons/ion/close';

import {
  resolveRoomBottomActionPresentation,
  type RoomPanelPlayerAction,
} from './RoomBottomActionPresentation';
import { DisabledReasonCaption } from './RoomControls';

function focusBackButton(button: HTMLButtonElement | null) {
  button?.focus({ preventScroll: true });
}

function ManagementAction({
  action,
  isTaskBlockedAction,
  onClose,
  hideAudioLockReason,
}: {
  readonly action: RoomHostManagementAction;
  readonly isTaskBlockedAction: boolean;
  readonly onClose: () => void;
  readonly hideAudioLockReason: boolean;
}) {
  const reason =
    !action.isEnabled &&
    !isTaskBlockedAction &&
    action.disabledReason !== null &&
    !(hideAudioLockReason && action.disabledReason === AUDIO_PLAYBACK_LOCK_REASON)
      ? action.disabledReason
      : null;
  return (
    <div className="host-management-action">
      <Button
        variant={action.variant}
        loading={'isLoading' in action && action.isLoading === true}
        disabled={!action.isEnabled}
        data-testid={action.testID}
        onClick={
          action.isEnabled
            ? () => {
                onClose();
                action.onPress();
              }
            : undefined
        }
      >
        <IonIcon name={action.icon} />
        {action.label}
      </Button>
      {reason !== null && reason.length > 0 && <DisabledReasonCaption reason={reason} />}
    </div>
  );
}

function PlayerManagementAction({
  action,
  onClose,
  hideAudioLockReason,
}: {
  readonly action: RoomPanelPlayerAction;
  readonly onClose: () => void;
  readonly hideAudioLockReason: boolean;
}) {
  const reason =
    action.isEnabled ||
    action.disabledReason === null ||
    (hideAudioLockReason && action.disabledReason === AUDIO_PLAYBACK_LOCK_REASON)
      ? null
      : action.disabledReason;
  const style = {
    ...('textColor' in action && action.textColor !== undefined ? { color: action.textColor } : {}),
    ...('buttonColor' in action && action.buttonColor !== undefined
      ? { background: action.buttonColor }
      : {}),
  };
  const variant = 'variant' in action ? action.variant : 'secondary';
  return (
    <div className="host-management-action">
      <Button
        variant={variant}
        size={'size' in action ? action.size : 'md'}
        loading={'isLoading' in action && action.isLoading === true}
        disabled={!action.isEnabled}
        style={style}
        data-testid={action.testID}
        onClick={
          action.isEnabled
            ? () => {
                onClose();
                action.onPress();
              }
            : undefined
        }
      >
        {action.icon !== undefined && <IonIcon name={action.icon} />}
        {action.label}
      </Button>
      {reason !== null && reason.length > 0 && <DisabledReasonCaption reason={reason} />}
    </div>
  );
}

function taskBodyActionKeys(body: RoomHostTaskBody): ReadonlySet<string> {
  switch (body.kind) {
    case 'ready':
      return new Set([body.action.key]);
    case 'blocked':
      return new Set();
    case 'choice':
      return new Set(body.actions.map((action) => action.key));
    case 'message':
      return body.escape === null ? new Set() : new Set([body.escape.key]);
  }
}

function TaskStepsRow({
  steps,
  coveredActionKeys,
  onClose,
}: {
  readonly steps: NonNullable<ReturnType<typeof resolveHostTaskView>>['steps'];
  readonly coveredActionKeys: ReadonlySet<string>;
  readonly onClose: () => void;
}) {
  if (steps === null) return null;
  return (
    <ol className="host-task-steps">
      {steps.map((step, index) => {
        const actionCovered = step.actionKey !== undefined && coveredActionKeys.has(step.actionKey);
        return (
          <li className="host-task-step-item" key={step.key}>
            {index > 0 && (
              <span className="host-task-step-separator" aria-hidden>
                →
              </span>
            )}
            <button
              type="button"
              className="host-task-step"
              data-state={step.state}
              data-testid={actionCovered ? undefined : step.testID}
              disabled={step.onPress === undefined || actionCovered}
              onClick={
                step.onPress === undefined || actionCovered
                  ? undefined
                  : () => {
                      onClose();
                      step.onPress?.();
                    }
              }
            >
              {step.state === 'complete' && <IconCheckmarkCircle aria-hidden />}
              {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function TaskActionButton({
  action,
  testId,
  showArrow = false,
  onClose,
  hideAudioLockReason,
}: {
  readonly action: RoomHostManagementAction;
  readonly testId: string;
  readonly showArrow?: boolean;
  readonly onClose: () => void;
  readonly hideAudioLockReason: boolean;
}) {
  const reason =
    action.isEnabled ||
    action.disabledReason === null ||
    (hideAudioLockReason && action.disabledReason === AUDIO_PLAYBACK_LOCK_REASON)
      ? null
      : action.disabledReason;
  return (
    <div className="bottom-action-slot">
      <Button
        variant={action.variant}
        loading={action.isLoading === true}
        disabled={!action.isEnabled}
        data-testid={testId}
        onClick={
          action.isEnabled
            ? () => {
                onClose();
                action.onPress();
              }
            : undefined
        }
      >
        {testId === TESTIDS.roomNextStepButton ? null : <IonIcon name={action.icon} />}
        {action.label}
        {showArrow && <IconArrowForward aria-hidden />}
      </Button>
      {reason !== null && <DisabledReasonCaption reason={reason} />}
    </div>
  );
}

function HostTaskBody({
  body,
  onClose,
  hideAudioLockReason,
}: {
  readonly body: RoomHostTaskBody;
  readonly onClose: () => void;
  readonly hideAudioLockReason: boolean;
}) {
  switch (body.kind) {
    case 'ready':
      return (
        <TaskActionButton
          action={body.action}
          testId={body.action.testID ?? TESTIDS.roomNextStepButton}
          showArrow
          onClose={onClose}
          hideAudioLockReason={hideAudioLockReason}
        />
      );
    case 'blocked': {
      const reason =
        hideAudioLockReason && body.reason === AUDIO_PLAYBACK_LOCK_REASON ? null : body.reason;
      return (
        <div className="host-task-blocked">
          <div className="host-task-blocked-text">
            <p className="host-task-blocked-label">{body.action.label}</p>
            {reason !== null && (
              <p
                className="host-task-blocked-reason"
                data-testid={TESTIDS.roomNextStepBlockedReason}
              >
                {reason}
              </p>
            )}
          </div>
          {body.remedy !== null && (
            <Button
              variant="secondary"
              data-testid={body.remedy.testID ?? TESTIDS.roomNextStepRemedyButton}
              onClick={() => {
                onClose();
                body.remedy?.onPress();
              }}
            >
              {body.remedy.label}
            </Button>
          )}
        </div>
      );
    }
    case 'choice':
      return (
        <div className="bottom-action-row">
          {body.actions.map((action) => (
            <TaskActionButton
              key={action.key}
              action={action}
              testId={action.testID ?? `${TESTIDS.roomHostTaskCard}-${action.key}`}
              onClose={onClose}
              hideAudioLockReason={hideAudioLockReason}
            />
          ))}
        </div>
      );
    case 'message':
      return (
        <div className="host-task-blocked">
          <div className="host-task-blocked-text">
            <p className="host-task-blocked-label">{body.text}</p>
          </div>
          {body.escape !== null && (
            <TaskActionButton
              action={body.escape}
              testId={TESTIDS.roomHostTaskEscapeButton}
              onClose={onClose}
              hideAudioLockReason={hideAudioLockReason}
            />
          )}
        </div>
      );
  }
}

function HostTaskSection({
  model,
  onClose,
  hideAudioLockReason,
}: {
  readonly model: RoomHostManagementModel;
  readonly onClose: () => void;
  readonly hideAudioLockReason: boolean;
}) {
  const view = resolveHostTaskView(model);
  if (view === null) return null;
  const coveredActionKeys = taskBodyActionKeys(view.body);
  return (
    <section className="host-task-card" data-testid={TESTIDS.roomHostTaskCard}>
      <h3 className="host-task-title">当前待办</h3>
      {view.steps !== null && (
        <TaskStepsRow steps={view.steps} coveredActionKeys={coveredActionKeys} onClose={onClose} />
      )}
      <HostTaskBody body={view.body} onClose={onClose} hideAudioLockReason={hideAudioLockReason} />
      {view.note !== null && view.note.length > 0 && <p className="host-task-note">{view.note}</p>}
    </section>
  );
}

function taskActionKeys(
  model: RoomHostManagementModel,
  view: ReturnType<typeof resolveHostTaskView>,
): ReadonlySet<string> {
  const task = model.task;
  if (view === null || task === null) return new Set();
  const keys = new Set(
    view.steps?.flatMap((step) =>
      step.actionKey !== undefined && step.onPress !== undefined ? [step.actionKey] : [],
    ),
  );
  switch (view.body.kind) {
    case 'ready':
      keys.add(view.body.action.key);
      break;
    case 'blocked':
      if (
        view.body.remedy !== null &&
        task.kind === 'action' &&
        task.remedyActionKey !== undefined
      ) {
        keys.add(task.remedyActionKey);
      }
      break;
    case 'choice':
      for (const action of view.body.actions) keys.add(action.key);
      break;
    case 'message':
      if (view.body.escape !== null && task.kind === 'message' && task.actionKey !== undefined) {
        keys.add(task.actionKey);
      }
      break;
  }
  return keys;
}

function ManagementContent({
  model,
  bottomActions,
  title,
  onClose,
  isAudioPlaying,
  isHand = false,
  onBack = onClose,
}: {
  readonly model: RoomHostManagementModel | null;
  readonly bottomActions: RoomBottomActionModel | null;
  readonly title: string;
  readonly onClose: () => void;
  readonly isAudioPlaying: boolean;
  readonly isHand?: boolean;
  readonly onBack?: () => void;
}) {
  const playerActions =
    bottomActions === null
      ? []
      : resolveRoomBottomActionPresentation(bottomActions).additionalActions;
  const hostTaskView = model === null ? null : resolveHostTaskView(model);
  const taskKeys = model === null ? new Set<string>() : taskActionKeys(model, hostTaskView);
  const hasPlayerActions = playerActions.length > 0;
  return (
    <>
      {isHand ? (
        <div className="room-action-hand host-hand-back">
          <Button
            ref={focusBackButton}
            variant="secondary"
            onClick={onBack}
            data-testid={TESTIDS.roomHostManagementCloseButton}
          >
            返回
          </Button>
        </div>
      ) : (
        <header className="host-management-header">
          <h2 className="host-management-title">{title}</h2>
          <IconButton
            label={`关闭${title}`}
            icon={<IconClose aria-hidden />}
            onClick={onClose}
            data-testid={TESTIDS.roomHostManagementCloseButton}
          />
        </header>
      )}
      <div className="host-management-body">
        {hasPlayerActions && (
          <section className="host-management-section">
            <h3 className="host-management-section-title">玩家操作</h3>
            <div className="host-management-actions">
              {playerActions.map((action) => (
                <PlayerManagementAction
                  key={action.key}
                  action={action}
                  onClose={onClose}
                  hideAudioLockReason={isAudioPlaying}
                />
              ))}
            </div>
          </section>
        )}
        {model !== null && (
          <>
            {hasPlayerActions && (
              <h3 className="host-management-group-title">{HOST_MANAGEMENT_LABEL}</h3>
            )}
            <HostTaskSection model={model} onClose={onClose} hideAudioLockReason={isAudioPlaying} />
            {model.sections.map((section) => {
              const actions = section.actions.filter((action) => !taskKeys.has(action.key));
              if (actions.length === 0) return null;
              return (
                <section key={section.key} className="host-management-section">
                  <h3 className="host-management-section-title">{section.title}</h3>
                  <div className="host-management-actions">
                    {actions.map((action) => (
                      <ManagementAction
                        key={action.key}
                        action={action}
                        isTaskBlockedAction={
                          hostTaskView?.body.kind === 'blocked' &&
                          hostTaskView.body.action.key === action.key
                        }
                        onClose={onClose}
                        hideAudioLockReason={isAudioPlaying}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

/** Mounted means open; `presentation` picks the sheet (narrow) or the side inspector (wide). */
export function RoomHostManagementPanel({
  model,
  bottomActions,
  presentation,
  onClose,
  onBack,
  isAudioPlaying,
}: {
  readonly model: RoomHostManagementModel | null;
  readonly bottomActions: RoomBottomActionModel | null;
  readonly presentation: 'sheet' | 'inspector' | 'hand';
  readonly onClose: () => void;
  readonly onBack?: () => void;
  readonly isAudioPlaying: boolean;
}) {
  const playerActions =
    bottomActions === null
      ? []
      : resolveRoomBottomActionPresentation(bottomActions).additionalActions;
  const title = playerActions.length === 0 && model !== null ? HOST_MANAGEMENT_LABEL : '更多操作';
  if (presentation === 'hand') {
    return (
      <section
        className="host-management-hand"
        aria-label={title}
        data-testid={TESTIDS.roomHostManagementPanel}
      >
        <ManagementContent
          model={model}
          bottomActions={null}
          title={title}
          onClose={onClose}
          onBack={onBack}
          isAudioPlaying={isAudioPlaying}
          isHand
        />
      </section>
    );
  }
  if (presentation === 'inspector') {
    return (
      <aside
        className="host-management-inspector"
        aria-label={title}
        data-testid={TESTIDS.roomHostManagementPanel}
      >
        <ManagementContent
          model={model}
          bottomActions={bottomActions}
          title={title}
          onClose={onClose}
          isAudioPlaying={isAudioPlaying}
        />
      </aside>
    );
  }
  return (
    <BottomSheet title={title} onClose={onClose} testId={TESTIDS.roomHostManagementPanel}>
      <ManagementContent
        model={model}
        bottomActions={bottomActions}
        title={title}
        onClose={onClose}
        isAudioPlaying={isAudioPlaying}
      />
    </BottomSheet>
  );
}
