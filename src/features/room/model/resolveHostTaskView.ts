/**
 * Resolve the host task card view from a host management model.
 *
 * The task references sheet actions by key; this is the one place those
 * references are looked up, so the card renders the sheet action's own
 * onPress, enabled state and disabled reason. Dangling references, a
 * choice with fewer than two options and more than one current step are
 * model construction errors and fail fast.
 */

import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
  RoomHostTaskStep,
} from './RoomHostManagement';

export interface RoomHostTaskRemedy {
  readonly label: string;
  readonly testID?: string;
  readonly onPress: () => void;
}

export type RoomHostTaskBody =
  | {
      /** The action is enabled: the card's button runs the sheet action's own onPress. */
      readonly kind: 'ready';
      readonly action: RoomHostManagementAction & { readonly isEnabled: true };
    }
  | {
      /** The action is disabled: the card shows its label, reason and the optional remedy. */
      readonly kind: 'blocked';
      readonly action: RoomHostManagementAction & { readonly isEnabled: false };
      readonly reason: string | null;
      readonly remedy: RoomHostTaskRemedy | null;
    }
  | {
      readonly kind: 'choice';
      readonly actions: readonly RoomHostManagementAction[];
    }
  | {
      readonly kind: 'message';
      readonly text: string;
      readonly escape: RoomHostManagementAction | null;
    };

export interface RoomHostTaskView {
  readonly steps: readonly (RoomHostTaskStep & { readonly onPress?: () => void })[] | null;
  readonly body: RoomHostTaskBody;
  readonly note: string | null;
}

function indexActions(model: RoomHostManagementModel): Map<string, RoomHostManagementAction> {
  const index = new Map<string, RoomHostManagementAction>();
  for (const section of model.sections) {
    for (const action of section.actions) {
      if (index.has(action.key)) {
        throw new Error(`Host management model declares action "${action.key}" twice`);
      }
      index.set(action.key, action);
    }
  }
  return index;
}

function requireAction(
  index: ReadonlyMap<string, RoomHostManagementAction>,
  key: string,
  role: string,
): RoomHostManagementAction {
  const action = index.get(key);
  if (action === undefined) {
    throw new Error(`Host task ${role} references action "${key}" missing from the sheet`);
  }
  return action;
}

export function resolveHostTaskView(model: RoomHostManagementModel): RoomHostTaskView | null {
  const task = model.task;
  if (task === null) return null;
  const index = indexActions(model);

  const steps =
    task.steps === undefined
      ? null
      : task.steps.map((step) => {
          if (step.actionKey === undefined) return step;
          const action = requireAction(index, step.actionKey, `step "${step.key}"`);
          return action.isEnabled && step.state !== 'upcoming'
            ? { ...step, onPress: action.onPress }
            : step;
        });
  if (steps !== null && steps.filter((step) => step.state === 'current').length > 1) {
    throw new Error('Host task declares more than one current step');
  }

  const note = task.note ?? null;

  switch (task.kind) {
    case 'action': {
      const action = requireAction(index, task.actionKey, 'action');
      if (action.isEnabled) {
        return { steps, note, body: { kind: 'ready', action } };
      }
      const remedyAction =
        task.remedyActionKey === undefined
          ? null
          : requireAction(index, task.remedyActionKey, 'remedy');
      const remedy: RoomHostTaskRemedy | null =
        remedyAction !== null && remedyAction.isEnabled
          ? {
              label: remedyAction.label,
              testID: remedyAction.testID,
              onPress: remedyAction.onPress,
            }
          : null;
      return {
        steps,
        note,
        body: { kind: 'blocked', action, reason: action.disabledReason, remedy },
      };
    }
    case 'choice': {
      if (task.actionKeys.length < 2) {
        throw new Error('Host choice task needs at least two actions');
      }
      return {
        steps,
        note,
        body: {
          kind: 'choice',
          actions: task.actionKeys.map((key) => requireAction(index, key, 'choice')),
        },
      };
    }
    case 'message':
      return {
        steps,
        note,
        body: {
          kind: 'message',
          text: task.text,
          escape:
            task.actionKey === undefined ? null : requireAction(index, task.actionKey, 'escape'),
        },
      };
  }
}
