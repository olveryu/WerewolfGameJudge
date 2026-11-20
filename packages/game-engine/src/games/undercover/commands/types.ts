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
  | { readonly type: 'undercover.roles.assign'; readonly shouldAllowRepeated: boolean }
  | { readonly type: 'undercover.round.retry'; readonly roundId: string }
  | { readonly type: 'undercover.round.allowRepeated'; readonly roundId: string }
  | { readonly type: 'undercover.role.viewed'; readonly roundId: string }
  | { readonly type: 'undercover.review.complete'; readonly roundId: string }
  | { readonly type: 'undercover.game.begin'; readonly roundId: string }
  | { readonly type: 'undercover.bots.markAllBotsViewed'; readonly roundId: string }
  | { readonly type: 'undercover.round.reveal'; readonly roundId: string; readonly seat: number }
  | {
      readonly type: 'undercover.game.restart';
      readonly roundId: string;
      readonly wasEnded: boolean;
    };

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
