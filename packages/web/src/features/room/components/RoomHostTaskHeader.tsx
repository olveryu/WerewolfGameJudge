import './RoomHostTaskHeader.css';

import { resolveHostTaskView } from '@/features/room/model/resolveHostTaskView';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';

/** Renders the current host task above the shared management hand. */
export function RoomHostTaskHeader({ model }: { readonly model: RoomHostManagementModel | null }) {
  if (model === null) return null;
  const task = resolveHostTaskView(model);
  if (task === null) return null;
  const actionKeys = new Set(
    task.body.kind === 'action'
      ? [task.body.action.key]
      : task.body.kind === 'choice'
        ? task.body.actions.map((action) => action.key)
        : task.body.escape === null
          ? []
          : [task.body.escape.key],
  );
  return (
    <div className="host-task-card" data-testid={TESTIDS.roomHostTaskCard}>
      {task.steps !== null && (
        <ol className="host-task-steps">
          {task.steps.map((step, index) => {
            const actionCovered = step.actionKey !== undefined && actionKeys.has(step.actionKey);
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
                  onClick={step.onPress === undefined || actionCovered ? undefined : step.onPress}
                >
                  {step.label}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {task.body.kind === 'message' && <p className="host-task-note">{task.body.text}</p>}
      {task.note !== null && <p className="host-task-note">{task.note}</p>}
    </div>
  );
}
