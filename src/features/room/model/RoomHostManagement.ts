/** Render-ready host management model. Games own action availability and execution. */

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

export interface RoomHostManagementModel {
  /** Context shown on the persistent entry without executing the action. */
  readonly preview: string;
  readonly status: string | null;
  readonly sections: readonly RoomHostManagementSection[];
}
