/** Complete game-neutral model rendered by RoomShell. */

import type { RoomBottomActionModel } from './RoomBottomActions';
import type { RoomCapabilities } from './RoomCapabilities';
import type { RoomConnectionStatus } from './RoomConnection';
import type { RoomHostManagementModel } from './RoomHostManagement';
import type { RoomProfileCardModel } from './RoomProfile';
import type { RoomSeatConfirmationModel } from './RoomSeatConfirmation';
import type { RoomSeatDataSource } from './RoomSeatDataSource';
import type { RoomShareModel } from './RoomShare';

export interface RoomConnectionViewModel {
  readonly status: RoomConnectionStatus;
  /** Number of this user's confirmed commands still awaiting a Worker decision. */
  readonly pendingCommandCount: number;
  readonly onManualReconnect: () => void;
}

export interface RoomHeaderUserAction {
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly ticketCount: number | null;
  readonly onPress: () => void;
}

export interface RoomHeaderModel {
  readonly onBack: () => void;
  readonly onTitlePress: () => void;
  readonly onTitleLongPress: () => void;
  readonly userAction: RoomHeaderUserAction | null;
}

export interface RoomSeatBoardModel {
  readonly source: RoomSeatDataSource;
  readonly visuallyDisabled: boolean;
  readonly onSeatPress: (seat: number, disabledReason?: string) => void;
  readonly onBotSeatLongPress: ((seat: number) => void) | null;
}

/** The active bot-seat takeover shown by the banner slot; null hides the banner. */
export interface RoomControlledSeatModel {
  readonly seat: number;
  readonly displayName: string;
  readonly onRelease: () => void;
}

export interface RoomShellModel {
  readonly roomCode: string;
  /**
   * The game's own phase identifier — its state machine's current status,
   * verbatim (e.g. werewolf 'Ongoing' / 'Day' / 'Ended'). Rendered on the
   * shell header as the `data-phase` anchor: the machine-readable contract
   * for phase waits. The shell never interprets the value, and it must
   * never carry display copy — copy may be redesigned freely, this may not.
   */
  readonly phase: string;
  readonly capabilities: RoomCapabilities;
  readonly header: RoomHeaderModel;
  readonly connection: RoomConnectionViewModel;
  readonly seats: RoomSeatBoardModel;
  readonly seatConfirmation: RoomSeatConfirmationModel | null;
  readonly profile: RoomProfileCardModel | null;
  readonly share: RoomShareModel;
  readonly bottomActions: RoomBottomActionModel;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly controlledSeat: RoomControlledSeatModel | null;
}
