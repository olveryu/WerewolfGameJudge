/** Typed FibKing commands; actor identity comes only from CommandContext. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type {
  FibPreparationFailureCode,
  FibPreparationStage,
  FibProfileUpdate,
  FibSeatProfile,
  FibWordDefinition,
  FibWordSource,
} from '../state/types';

type FibRoomCommand = RoomSeatCommand<FibSeatProfile> | RoomProfileUpdateCommand<FibProfileUpdate>;

export type FibPublicCommand =
  | FibRoomCommand
  | { readonly type: 'fib.config.update'; readonly numberOfPlayers: number }
  | { readonly type: 'fib.game.returnToLobby' }
  | { readonly type: 'fib.round.start' }
  | { readonly type: 'fib.round.cancelPreparing' }
  | { readonly type: 'fib.round.reveal' };

export interface FibCompleteRoundCommand {
  readonly type: 'fib.round.complete';
  readonly roundId: string;
  readonly word: string;
  readonly definition: FibWordDefinition;
  readonly source: FibWordSource;
}

export interface FibUpdatePreparationStageCommand {
  readonly type: 'fib.round.updatePreparationStage';
  readonly roundId: string;
  readonly stage: FibPreparationStage;
}

export interface FibFailPreparationCommand {
  readonly type: 'fib.round.failPreparation';
  readonly roundId: string;
  readonly failureCode: FibPreparationFailureCode;
}

export type FibInternalCommand =
  | FibCompleteRoundCommand
  | FibUpdatePreparationStageCommand
  | FibFailPreparationCommand;
export type FibCommand = FibPublicCommand | FibInternalCommand;
