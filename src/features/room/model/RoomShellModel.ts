/** Complete game-neutral model rendered by RoomShell. */

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { RoomBottomActionModel } from './RoomBottomActions';
import type { RoomCapabilities } from './RoomCapabilities';
import type { RoomConnectionStatus } from './RoomConnection';
import type { RoomProfileCardModel } from './RoomProfile';
import type { RoomSeatConfirmationModel } from './RoomSeatConfirmation';
import type { RoomSeatDataSource } from './RoomSeatDataSource';
import type { RoomShareModel } from './RoomShare';

export type RoomIconName = ComponentProps<typeof Ionicons>['name'];

export interface RoomConnectionViewModel {
  readonly status: RoomConnectionStatus;
  /** Number of this user's confirmed commands still awaiting a Worker decision. */
  readonly pendingCommandCount: number;
  readonly onManualReconnect: () => void;
}

export type RoomStatusRibbonModel =
  | {
      readonly kind: 'progress';
      readonly current: number;
      readonly total: number;
      readonly label: string | null;
    }
  | {
      readonly kind: 'message';
      readonly icon: 'guide' | 'speaking';
      readonly text: string;
      readonly supportingText: string | null;
    };

export interface RoomHeaderMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon: RoomIconName;
  readonly group: 'utility' | 'operation';
  readonly tone: 'default' | 'danger';
  readonly testID?: string;
  readonly onPress: () => void;
}

export interface RoomHeaderUserAction {
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly ticketCount: number | null;
  readonly onPress: () => void;
}

export interface RoomHeaderModel {
  readonly onBack: () => void;
  readonly onTitlePress: (() => void) | null;
  readonly userAction: RoomHeaderUserAction | null;
  readonly menuItems: readonly RoomHeaderMenuItem[];
}

export interface RoomSeatBoardModel {
  readonly source: RoomSeatDataSource;
  readonly visuallyDisabled: boolean;
  readonly onSeatPress: (seat: number, disabledReason?: string) => void;
  readonly onBotSeatLongPress: ((seat: number) => void) | null;
}

export type RoomControlledSeatModel =
  | {
      readonly kind: 'controlled';
      readonly seat: number;
      readonly displayName: string;
      readonly onRelease: () => void;
    }
  | {
      readonly kind: 'hint';
      readonly showBulkViewHint: boolean;
    };

export interface RoomShellModel {
  readonly roomCode: string;
  readonly capabilities: RoomCapabilities;
  readonly header: RoomHeaderModel;
  readonly connection: RoomConnectionViewModel;
  readonly statusRibbon: RoomStatusRibbonModel | null;
  readonly seats: RoomSeatBoardModel;
  readonly seatConfirmation: RoomSeatConfirmationModel | null;
  readonly profile: RoomProfileCardModel | null;
  readonly share: RoomShareModel;
  readonly bottomActions: RoomBottomActionModel;
  readonly controlledSeat: RoomControlledSeatModel | null;
}
