/** Render-ready host management model. Games own action availability and execution. */

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { RoomCapability } from './RoomCapabilities';

type RoomHostManagementIconName = ComponentProps<typeof Ionicons>['name'];

/** A concrete remedy offered beside a blocked primary action (e.g. share the room to fill seats). */
export interface RoomHostRemedy {
  readonly label: string;
  readonly onPress: () => void;
}

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
  /**
   * Marks the phase's single primary action. The collapsed host console
   * re-presents it above the management entry; the expanded panel renders
   * the same action inside its section. At most one action per model may
   * carry this mark.
   */
  readonly isPrimary?: boolean;
  /** Remedy offered beside this action when the console renders it blocked. */
  readonly remedy?: RoomHostRemedy | null;
  /**
   * Press handler used by the collapsed console only (e.g. the confirm the
   * console carries while the panel action runs directly). Falls back to
   * the action's own onPress when absent. Meaningful only on an enabled
   * primary action.
   */
  readonly onConsolePress?: () => void;
  /**
   * Console-only blocked reason for a primary action that stays enabled in
   * the panel because its gate lives in a later layer (e.g. a dialog the
   * panel action opens). When set to a non-empty string, the console
   * renders the action blocked with this reason even though the action
   * itself is enabled.
   */
  readonly consoleBlockedReason?: string | null;
}

export type RoomHostManagementAction = RoomHostManagementActionBase &
  RoomHostManagementActionAvailability;

export interface RoomHostManagementSection {
  readonly key: string;
  readonly title: string;
  readonly actions: readonly RoomHostManagementAction[];
}

/** The share-room remedy for a seat-blocked primary, from the room's share capability. */
export function buildShareRoomRemedy(canShareRoom: RoomCapability): RoomHostRemedy | null {
  return canShareRoom.isAllowed ? { label: '分享房间', onPress: canShareRoom.execute } : null;
}

export interface RoomHostManagementModel {
  /** When true, a host action awaits the host now; the console entry marks it as pending. */
  readonly hasPendingAction?: boolean;
  readonly sections: readonly RoomHostManagementSection[];
}

/** Label for the persistent host-management entry. Referenced by hints; do not hardcode. */
export const HOST_MANAGEMENT_LABEL = '主持管理';
