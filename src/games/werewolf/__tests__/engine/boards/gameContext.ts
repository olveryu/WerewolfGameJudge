/** Canonical Werewolf command harness contract used by cross-package board tests. */

import type {
  GameState,
  NightPlan,
  RoleId,
  SchemaId,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import type { CommandExecutionContext } from '@game-judge/game-engine/platform/engine';
import type { RoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';

export interface TestCommandActor {
  readonly userId: string;
  readonly controlledSeat: number | null;
}

export type TestCommandExecution = Partial<Pick<CommandExecutionContext, 'nowMs' | 'randomSeed'>>;

export interface GameContext {
  readonly getGameState: () => GameState;
  readonly getRevision: () => number;
  readonly getNightPlan: () => NightPlan;
  readonly dispatch: (
    command: WerewolfPublicCommand,
    actor?: TestCommandActor,
    execution?: TestCommandExecution,
  ) => RoomCommandResult<GameState>;
  readonly dispatchAsSeat: (
    seat: number,
    command: WerewolfPublicCommand,
    execution?: TestCommandExecution,
  ) => RoomCommandResult<GameState>;
  readonly dispatchOrThrow: (
    command: WerewolfPublicCommand,
    context: string,
    actor?: TestCommandActor,
    execution?: TestCommandExecution,
  ) => RoomCommandResult<GameState>;
  readonly dispatchAsSeatOrThrow: (
    seat: number,
    command: WerewolfPublicCommand,
    context: string,
    execution?: TestCommandExecution,
  ) => RoomCommandResult<GameState>;
  readonly acknowledgePendingAudioOrThrow: (context: string) => void;
  readonly assertStep: (expectedStepId: SchemaId) => void;
  readonly findSeatByRole: (role: RoleId) => number;
  readonly getRoleAtSeat: (seat: number) => RoleId | null;
}
