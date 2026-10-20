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
  | { readonly type: 'fibking.config.update'; readonly numberOfPlayers: number }
  | { readonly type: 'fibking.game.returnToLobby' }
  | { readonly type: 'fibking.roles.assign' }
  | { readonly type: 'fibking.round.cancelPreparing' }
  | { readonly type: 'fibking.role.viewed' }
  | { readonly type: 'fibking.bots.markAllBotsViewed' }
  | { readonly type: 'fibking.game.begin' }
  | { readonly type: 'fibking.round.guess'; readonly seat: number }
  | { readonly type: 'fibking.round.reveal' };

export interface FibCompleteRoundCommand {
  readonly type: 'fibking.round.complete';
  readonly roundId: string;
  readonly word: string;
  readonly definition: FibWordDefinition;
  readonly source: FibWordSource;
}

export interface FibUpdatePreparationStageCommand {
  readonly type: 'fibking.round.updatePreparationStage';
  readonly roundId: string;
  readonly stage: FibPreparationStage;
}

export interface FibFailPreparationCommand {
  readonly type: 'fibking.round.failPreparation';
  readonly roundId: string;
  readonly failureCode: FibPreparationFailureCode;
}

export type FibInternalCommand =
  | FibCompleteRoundCommand
  | FibUpdatePreparationStageCommand
  | FibFailPreparationCommand;
export type FibCommand = FibPublicCommand | FibInternalCommand;
