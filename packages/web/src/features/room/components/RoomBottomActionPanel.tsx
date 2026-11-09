/**
 * Shared three-tier room action panel plus the host task card. Games provide render-ready
 * button models; the card renders the host's declared task by resolving its sheet actions.
 */
import './RoomBottomActionPanel.css';

import { type CSSProperties, Fragment, memo } from 'react';

import { Button } from '@/components/Button';
import { IonIcon } from '@/components/icons/IonIcon';
import { AUDIO_PLAYBACK_LOCK_REASON } from '@/features/room/model/audioPlaybackLock';
import type { NightStepProgress } from '@/features/room/model/nightProgress';
import type { RoomHostTaskBody, RoomHostTaskView } from '@/features/room/model/resolveHostTaskView';
import { resolveHostTaskView } from '@/features/room/model/resolveHostTaskView';
import {
  AUDIO_WAITING_LABEL,
  type RoomBottomActionModel,
  type RoomBottomButton,
  type RoomBottomDockModel,
  type RoomBottomToolButton,
} from '@/features/room/model/RoomBottomActions';
import {
  HOST_MANAGEMENT_LABEL,
  type RoomHostManagementAction,
  type RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import IconArrowForward from '~icons/ion/arrow-forward';
import IconCheckmarkCircle from '~icons/ion/checkmark-circle';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconShieldCheckmarkOutline from '~icons/ion/shield-checkmark-outline';

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

function DockTool({
  model,
  hideAudioLockReason,
}: {
  readonly model: RoomBottomToolButton | null;
  readonly hideAudioLockReason: boolean;
}) {
  if (model === null) return null;
  const reason = model.isEnabled
    ? null
    : visibleDisabledReason(model.disabledReason, hideAudioLockReason);
  return (
    <div className="bottom-action-slot">
      <Button
        variant="secondary"
        className="bottom-dock-tool"
        data-tone={model.tone}
        disabled={!model.isEnabled}
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

/** A sheet action rendered on the task card; the card carries its own test ids. */
function HostTaskActionButton({
  action,
  testId,
  hideAudioLockReason,
}: {
  readonly action: RoomHostManagementAction;
  readonly testId: string;
  readonly hideAudioLockReason: boolean;
}) {
  const reason = action.isEnabled
    ? null
    : visibleDisabledReason(action.disabledReason, hideAudioLockReason);
  return (
    <div className="bottom-action-slot">
      <Button
        variant={action.variant}
        loading={action.isLoading === true}
        disabled={!action.isEnabled}
        data-testid={testId}
        onClick={action.isEnabled ? action.onPress : undefined}
      >
        <IonIcon name={action.icon} />
        {action.label}
      </Button>
      {reason !== null && <DisabledReasonCaption reason={reason} />}
    </div>
  );
}

/** Multi-step host flow; completed steps show a check, only steps with an action respond. */
function TaskStepsRow({ steps }: { readonly steps: NonNullable<RoomHostTaskView['steps']> }) {
  return (
    <ol className="host-task-steps">
      {steps.map((step, index) => (
        <Fragment key={step.key}>
          {index > 0 && (
            <li className="host-task-step-separator" aria-hidden>
              →
            </li>
          )}
          <li>
            <button
              type="button"
              className="host-task-step"
              data-state={step.state}
              disabled={step.onPress === undefined}
              onClick={step.onPress}
            >
              {step.state === 'complete' && <IconCheckmarkCircle aria-hidden />}
              {step.label}
            </button>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

function HostTaskBody({
  body,
  hasPrimaryAction,
  hideAudioLockReason,
}: {
  readonly body: RoomHostTaskBody;
  readonly hasPrimaryAction: boolean;
  readonly hideAudioLockReason: boolean;
}) {
  switch (body.kind) {
    case 'ready':
      return (
        <Button
          variant={hasPrimaryAction ? 'secondary' : 'primary'}
          loading={body.action.isLoading === true}
          className="host-task-next"
          data-testid={TESTIDS.roomNextStepButton}
          onClick={body.action.onPress}
        >
          {body.action.label}
          <IconArrowForward aria-hidden />
        </Button>
      );
    case 'blocked': {
      const reason = visibleDisabledReason(body.reason, hideAudioLockReason);
      return (
        <div className="host-task-blocked">
          <div className="host-task-blocked-text">
            <p className="host-task-blocked-label">{body.action.label}</p>
            {reason !== null && <p className="host-task-blocked-reason">{reason}</p>}
          </div>
          {body.remedy !== null && (
            <Button
              variant="secondary"
              data-testid={TESTIDS.roomNextStepRemedyButton}
              onClick={body.remedy.onPress}
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
            <HostTaskActionButton
              key={action.key}
              action={action}
              testId={`${TESTIDS.roomHostTaskCard}-${action.key}`}
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
            <HostTaskActionButton
              action={body.escape}
              testId={`${TESTIDS.roomHostTaskCard}-escape`}
              hideAudioLockReason={hideAudioLockReason}
            />
          )}
        </div>
      );
  }
}

/** The host task card: steps, task body, note, then the entry to the full sheet. */
function HostManagementBlock({
  model,
  hasPrimaryAction,
  onOpenHostManagement,
  hideAudioLockReason,
}: {
  readonly model: RoomHostManagementModel;
  readonly hasPrimaryAction: boolean;
  readonly onOpenHostManagement: () => void;
  readonly hideAudioLockReason: boolean;
}) {
  const view = resolveHostTaskView(model);
  return (
    <section className="host-task-card" data-testid={TESTIDS.roomHostTaskCard}>
      {view?.steps != null && <TaskStepsRow steps={view.steps} />}
      {view !== null && (
        <HostTaskBody
          body={view.body}
          hasPrimaryAction={hasPrimaryAction}
          hideAudioLockReason={hideAudioLockReason}
        />
      )}
      {view?.note != null && view.note.length > 0 && <p className="host-task-note">{view.note}</p>}
      <button
        type="button"
        className="host-management-entry"
        data-testid={TESTIDS.roomHostManagementButton}
        aria-label={HOST_MANAGEMENT_LABEL}
        onClick={onOpenHostManagement}
      >
        <span className="host-management-entry-title">
          <IconShieldCheckmarkOutline aria-hidden />
          {HOST_MANAGEMENT_LABEL}
        </span>
        <span className="host-management-entry-expand">
          全部操作
          <IconChevronForward aria-hidden />
        </span>
      </button>
    </section>
  );
}

function hasEnabledPrimary(button: RoomBottomButton): boolean {
  return button.variant === 'primary' && (button.isEnabled || button.isLoading === true);
}

function DockActions({
  model,
  hideAudioLockReason,
}: {
  readonly model: RoomBottomDockModel;
  readonly hideAudioLockReason: boolean;
}) {
  return (
    <>
      {model.primary !== null && (
        <LayoutButton model={model.primary} hideAudioLockReason={hideAudioLockReason} />
      )}
      {(model.leading !== null || model.trailing !== null) && (
        <div className="bottom-action-row">
          <DockTool model={model.leading} hideAudioLockReason={hideAudioLockReason} />
          <DockTool model={model.trailing} hideAudioLockReason={hideAudioLockReason} />
        </div>
      )}
    </>
  );
}

function StackedActions({
  model,
  hideAudioLockReason,
}: {
  readonly model: Extract<RoomBottomActionModel, { readonly kind: 'stacked' }>;
  readonly hideAudioLockReason: boolean;
}) {
  const rows = [
    ['primary', model.layout.primary],
    ['secondary', model.layout.secondary],
    ['ghost', model.layout.ghost],
  ] as const;
  return rows.map(([tier, buttons]) =>
    buttons.length === 0 ? null : (
      <div key={tier} className="bottom-action-row" data-tier={tier}>
        {buttons.map((button) => (
          <LayoutButton key={button.key} model={button} hideAudioLockReason={hideAudioLockReason} />
        ))}
      </div>
    ),
  );
}

function RoomBottomActionPanelComponent({
  model,
  isAudioPlaying,
  hostManagement,
  onOpenHostManagement,
}: {
  readonly model: RoomBottomActionModel;
  readonly isAudioPlaying: boolean;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly onOpenHostManagement: () => void;
}) {
  const hasButtons =
    hostManagement !== null ||
    (model.kind === 'dock'
      ? model.primary !== null || model.leading !== null || model.trailing !== null
      : model.layout.primary.length > 0 ||
        model.layout.secondary.length > 0 ||
        model.layout.ghost.length > 0);
  const message = model.message;
  const hasMessage = message !== null && message.length > 0;
  if (!isAudioPlaying && !hasButtons && !hasMessage && model.progress === null) return null;

  const hasPrimaryAction =
    model.kind === 'dock'
      ? model.primary !== null && hasEnabledPrimary(model.primary)
      : model.layout.primary.some(hasEnabledPrimary);

  return (
    <footer
      className="bottom-action-panel"
      data-kind={model.kind}
      data-testid={TESTIDS.bottomActionPanel}
    >
      {model.progress !== null && <RoomProgressIndicator progress={model.progress} />}
      {isAudioPlaying && <p className="bottom-action-message">{AUDIO_WAITING_LABEL}</p>}
      {hasMessage && (
        <p
          key={message}
          className="bottom-action-message"
          data-animate="true"
          aria-live="polite"
          data-testid={TESTIDS.actionMessage}
        >
          {message}
        </p>
      )}
      <div className="bottom-action-stack">
        {model.kind === 'dock' ? (
          <DockActions model={model} hideAudioLockReason={isAudioPlaying} />
        ) : (
          <StackedActions model={model} hideAudioLockReason={isAudioPlaying} />
        )}
        {hostManagement !== null && (
          <HostManagementBlock
            model={hostManagement}
            hasPrimaryAction={hasPrimaryAction}
            onOpenHostManagement={onOpenHostManagement}
            hideAudioLockReason={isAudioPlaying}
          />
        )}
      </div>
    </footer>
  );
}

export const RoomBottomActionPanel = memo(RoomBottomActionPanelComponent);
