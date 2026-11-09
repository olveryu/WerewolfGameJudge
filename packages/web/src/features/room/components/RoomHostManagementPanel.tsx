/** Host management surface: game-owned action sections, as a bottom sheet or a side inspector. */
import './RoomHostManagementPanel.css';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { IonIcon } from '@/components/icons/IonIcon';
import {
  HOST_MANAGEMENT_LABEL,
  type RoomHostManagementAction,
  type RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import IconClose from '~icons/ion/close';

import { DisabledReasonCaption } from './RoomControls';

function ManagementAction({
  action,
  isTaskAction,
  onClose,
}: {
  readonly action: RoomHostManagementAction;
  /** The task card already renders this action's blocked reason; the sheet row carries none. */
  readonly isTaskAction: boolean;
  readonly onClose: () => void;
}) {
  const reason =
    !action.isEnabled && !isTaskAction && action.disabledReason !== null
      ? action.disabledReason
      : null;
  return (
    <div className="host-management-action">
      <Button
        variant={action.variant}
        loading={action.isLoading === true}
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

function ManagementContent({
  model,
  onClose,
}: {
  readonly model: RoomHostManagementModel;
  readonly onClose: () => void;
}) {
  return (
    <>
      <header className="host-management-header">
        <h2 className="host-management-title">{HOST_MANAGEMENT_LABEL}</h2>
        <IconButton
          label={`关闭${HOST_MANAGEMENT_LABEL}`}
          icon={<IconClose aria-hidden />}
          onClick={onClose}
        />
      </header>
      <div className="host-management-body">
        {model.sections.map((section) => (
          <section key={section.key} className="host-management-section">
            <h3 className="host-management-section-title">{section.title}</h3>
            <div className="host-management-actions">
              {section.actions.map((action) => (
                <ManagementAction
                  key={action.key}
                  action={action}
                  isTaskAction={
                    model.task?.kind === 'action' && model.task.actionKey === action.key
                  }
                  onClose={onClose}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

/** Mounted means open; `presentation` picks the sheet (narrow) or the side inspector (wide). */
export function RoomHostManagementPanel({
  model,
  presentation,
  onClose,
}: {
  readonly model: RoomHostManagementModel;
  readonly presentation: 'sheet' | 'inspector';
  readonly onClose: () => void;
}) {
  if (presentation === 'inspector') {
    return (
      <aside
        className="host-management-inspector"
        aria-label={HOST_MANAGEMENT_LABEL}
        data-testid={TESTIDS.roomHostManagementPanel}
      >
        <ManagementContent model={model} onClose={onClose} />
      </aside>
    );
  }
  return (
    <BottomSheet
      title={HOST_MANAGEMENT_LABEL}
      onClose={onClose}
      testId={TESTIDS.roomHostManagementPanel}
    >
      <ManagementContent model={model} onClose={onClose} />
    </BottomSheet>
  );
}
