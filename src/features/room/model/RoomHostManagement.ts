/** Render-ready host management model. Games own action availability and execution. */

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { RoomCapability } from './RoomCapabilities';

type RoomHostManagementIconName = ComponentProps<typeof Ionicons>['name'];

type RoomHostManagementActionAvailability =
  | {
      readonly isEnabled: true;
      readonly onPress: () => void;
    }
  | {
      readonly isEnabled: false;
      readonly disabledReason: string | null;
      readonly onDisabledPress: (() => void) | null;
    };

interface RoomHostManagementActionBase {
  readonly key: string;
  readonly label: string;
  readonly icon: RoomHostManagementIconName;
  readonly variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly testID?: string;
  readonly isLoading?: boolean;
}

export type RoomHostManagementAction = RoomHostManagementActionBase &
  RoomHostManagementActionAvailability;

export interface RoomHostManagementSection {
  readonly key: string;
  readonly title: string;
  readonly actions: readonly RoomHostManagementAction[];
}

/** A concrete remedy offered beside a blocked next step (e.g. share the room to fill seats). */
export interface RoomNextStepRemedy {
  readonly label: string;
  readonly onPress: () => void;
}

export type RoomNextStepState =
  | {
      /** Executable now: pressing the strip runs the step (through its original confirm, if any). */
      readonly kind: 'ready';
      readonly onPress: () => void;
    }
  | {
      /** Not executable yet: the reason renders on the strip itself, next to the step label. */
      readonly kind: 'blocked';
      readonly reason: string;
      readonly remedy: RoomNextStepRemedy | null;
    };

/**
 * The single next action a Host should take, rendered as a persistent
 * strip above the management entry. It re-presents the same panel
 * action (same key, same execution callback); it never introduces a
 * second execution path.
 */
export interface RoomNextStep {
  /** Key of the panel action this step re-presents. */
  readonly actionKey: string;
  readonly label: string;
  readonly state: RoomNextStepState;
}

/**
 * The one derivation of a next step from its panel action: an enabled
 * action becomes a ready step (an explicit `onPress` override may gate
 * the press, e.g. with the confirm the strip carries); a disabled
 * action with a non-empty reason becomes a blocked step; a disabled
 * action without a reason (transient submission lock) yields no step.
 */
export function buildRoomNextStep(input: {
  readonly action: RoomHostManagementAction;
  readonly onPress?: () => void;
  readonly blockedReason?: string;
  readonly remedy?: RoomNextStepRemedy | null;
}): RoomNextStep | null {
  const { action } = input;
  if (action.isEnabled) {
    return {
      actionKey: action.key,
      label: action.label,
      state: { kind: 'ready', onPress: input.onPress ?? action.onPress },
    };
  }
  const reason = input.blockedReason ?? action.disabledReason;
  if (reason === null || reason === undefined || reason.length === 0) return null;
  return {
    actionKey: action.key,
    label: action.label,
    state: { kind: 'blocked', reason, remedy: input.remedy ?? null },
  };
}

/** The share-room remedy for a seat-blocked step, from the room's share capability. */
export function buildShareRoomRemedy(canShareRoom: RoomCapability): RoomNextStepRemedy | null {
  return canShareRoom.isAllowed ? { label: '分享房间', onPress: canShareRoom.execute } : null;
}

export interface RoomHostManagementModel {
  /** Context shown on the persistent entry without executing the action. */
  readonly preview: string;
  /** When true, the preview names an action the host should take now; render it prominently. */
  readonly hasPendingAction?: boolean;
  /** The host's single next step, or null when the phase has no single next action. */
  readonly nextStep: RoomNextStep | null;
  readonly status: string | null;
  readonly sections: readonly RoomHostManagementSection[];
}

/** Label for the persistent host-management entry. Referenced by hints; do not hardcode. */
export const HOST_MANAGEMENT_LABEL = '主持管理';
