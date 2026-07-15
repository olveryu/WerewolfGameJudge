/** Typed FibKing commands; actor identity comes only from CommandContext. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { FibProfileUpdate, FibSeatProfile, FibWordSource } from '../state/types';

type FibRoomCommand = RoomSeatCommand<FibSeatProfile> | RoomProfileUpdateCommand<FibProfileUpdate>;

export type FibPublicCommand =
  | FibRoomCommand
  | { readonly type: 'fib.config.update'; readonly numberOfPlayers: number }
  | { readonly type: 'fib.round.start' }
  | { readonly type: 'fib.round.cancelPreparing' }
  | { readonly type: 'fib.round.reveal' };

export interface FibCompleteRoundCommand {
  readonly type: 'fib.round.complete';
  readonly roundId: string;
  readonly word: string;
  readonly definition: string;
  readonly source: FibWordSource;
}

export type FibInternalCommand = FibCompleteRoundCommand;
export type FibCommand = FibPublicCommand | FibInternalCommand;
