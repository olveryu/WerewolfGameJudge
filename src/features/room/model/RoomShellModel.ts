/** Complete game-neutral model rendered by RoomShell. */

import type { LinkStatus } from '@/platform/realtime/types';

import type { RoomBottomActionModel } from './RoomBottomActions';
import type { RoomCapabilities } from './RoomCapabilities';
import type { RoomHostManagementModel } from './RoomHostManagement';
import type { RoomProfileCardModel } from './RoomProfile';
import type { RoomSeatConfirmationModel } from './RoomSeatConfirmation';
import type { RoomSeatDataSource } from './RoomSeatDataSource';
import type { RoomShareModel } from './RoomShare';
import type { RoomViewer } from './RoomViewer';

export interface RoomConnectionViewModel {
  readonly status: LinkStatus;
  /** Durable commands persisted locally and still awaiting a Worker decision. */
  readonly pendingDurableCount: number;
  /** User IDs with an open room socket per the latest PRESENCE frame; empty until one arrives. */
  readonly presence: ReadonlySet<string>;
  /** Reconnect now while `status.kind === 'waiting'`. */
  readonly onRetryNow: () => void;
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
   * Who is looking at this shell. The one identity declaration the
   * shell's ownership checks read: host management exists only for
   * `viewer.isHost`; bottom buttons declare their audience against it.
   */
  readonly viewer: RoomViewer;
  /**
   * The game's own phase identifier — its state machine's current status,
   * verbatim (e.g. werewolf 'Ongoing' / 'Day' / 'Ended'). Rendered on the
   * shell header as the `data-phase` anchor: the machine-readable contract
   * for phase waits. The shell never interprets the value, and it must
   * never carry display copy — copy may be redesigned freely, this may not.
   */
  readonly phase: string;
  /**
   * The game's current step inside its phase, verbatim from its state
   * machine (e.g. werewolf's current night step), or null when the game
   * has no step inside the current phase. Rendered on the shell header
   * as the `data-step` anchor alongside `data-phase`: the same
   * machine-readable contract, one level down. The shell never
   * interprets the value, and it must never carry display copy.
   */
  readonly step: string | null;
  /** Authoritative narration status; presentation only, never an interaction gate. */
  readonly isAudioPlaying: boolean;
  readonly capabilities: RoomCapabilities;
  readonly header: RoomHeaderModel;
  readonly connection: RoomConnectionViewModel;
  readonly seats: RoomSeatBoardModel;
  readonly seatConfirmation: RoomSeatConfirmationModel | null;
  readonly profile: RoomProfileCardModel | null;
  readonly share: RoomShareModel;
  readonly bottomActions: RoomBottomActionModel;
  /** Host management surface; always null for non-hosts, null for a host only when the phase offers nothing to manage. */
  readonly hostManagement: RoomHostManagementModel | null;
  readonly controlledSeat: RoomControlledSeatModel | null;
}
