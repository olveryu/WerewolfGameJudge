/**
 * Render-ready host management model. Games own action availability and execution.
 *
 * Two parts (docs/room-shell-contract.md "Host Task"): `sections` is the
 * complete command inventory — every host command's onPress lives there and
 * only there; `task` is the one declared "what the host does now", which
 * references sheet actions by key and never carries a handler of its own.
 */

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type RoomHostManagementIconName = ComponentProps<typeof Ionicons>['name'];

type RoomHostManagementActionAvailability =
  | {
      readonly isEnabled: true;
      readonly onPress: () => void;
    }
  | {
      readonly isEnabled: false;
      readonly disabledReason: string | null;
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

/** One step of a multi-step host flow rendered on the task card. */
export interface RoomHostTaskStep {
  readonly key: string;
  readonly label: string;
  readonly state: 'complete' | 'current' | 'upcoming';
  /** A completed step may be revisited through this sheet action. */
  readonly actionKey?: string;
}

interface RoomHostTaskBase {
  /** Multi-step flow progress; omitted for a single step. At most one `current`. */
  readonly steps?: readonly RoomHostTaskStep[];
  /** Reminder rendered under the task. */
  readonly note?: string;
  /** A concrete remedy for a blocked action, referenced by sheet key. */
  readonly remedyActionKey?: string;
}

/**
 * The host's one current task. It has no handler: every key resolves to a
 * sheet action whose onPress, enabled state and disabled reason the card
 * renders — one command, one execution path.
 */
export type RoomHostTask = RoomHostTaskBase &
  (
    | { readonly kind: 'action'; readonly actionKey: string }
    | { readonly kind: 'choice'; readonly actionKeys: readonly string[] }
    | { readonly kind: 'message'; readonly text: string; readonly actionKey?: string }
  );

export interface RoomHostManagementModel {
  /** The one thing the host should do now; null when nothing awaits the host. */
  readonly task: RoomHostTask | null;
  /** The complete command inventory (the sheet). */
  readonly sections: readonly RoomHostManagementSection[];
}

/** Label for the persistent host-management entry. Referenced by hints; do not hardcode. */
export const HOST_MANAGEMENT_LABEL = '主持管理';
