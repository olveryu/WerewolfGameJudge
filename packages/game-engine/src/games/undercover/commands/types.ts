/** Typed Undercover commands; all caller identity is supplied by CommandContext. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type {
  UndercoverConfig,
  UndercoverPreparationFailure,
  UndercoverWordPair,
} from '../state/types';

export type UndercoverPublicCommand =
  | RoomSeatCommand<RoomSeatProfile>
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | { readonly type: 'undercover.config.update'; readonly config: UndercoverConfig }
  | { readonly type: 'undercover.bots.clear' }
  | { readonly type: 'undercover.round.start'; readonly shouldAllowRepeated: boolean }
  | { readonly type: 'undercover.round.retry'; readonly roundId: string }
  | { readonly type: 'undercover.round.confirm'; readonly roundId: string }
  | { readonly type: 'undercover.round.markAllBotsViewed'; readonly roundId: string }
  | { readonly type: 'undercover.round.reveal'; readonly roundId: string; readonly seat: number }
  | { readonly type: 'undercover.round.abort'; readonly roundId: string }
  | { readonly type: 'undercover.game.returnToLobby' };

export type UndercoverInternalCommand =
  | {
      readonly type: 'undercover.round.complete';
      readonly roundId: string;
      readonly wordPair: UndercoverWordPair;
    }
  | {
      readonly type: 'undercover.round.failPreparation';
      readonly roundId: string;
      readonly failureCode: UndercoverPreparationFailure;
    };

export type UndercoverCommand = UndercoverPublicCommand | UndercoverInternalCommand;
