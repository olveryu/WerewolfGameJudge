/** Platform-owned port for resolving runtime-erased game modules. */

import type {
  CommandContext,
  CommittedCommandOutcome,
  CommonGameLifecycle,
  CreateGameContext,
  GameEffect,
} from '@werewolf/game-engine/platform/engine';
import type { RoomCommandResult } from '@werewolf/game-engine/platform/protocol/commandResult';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import type { Env } from '../../env';

export interface RuntimeCommittedDecision {
  readonly kind: 'commit';
  readonly commandType: string;
  readonly state: BaseGameState<GameType>;
  readonly hasStateEvents: boolean;
  readonly effects: readonly GameEffect[];
  readonly broadcast: 'state' | 'none';
  readonly outcome: CommittedCommandOutcome;
  readonly previousLifecycle: CommonGameLifecycle;
  readonly lifecycle: CommonGameLifecycle;
}

export type RuntimeDecision =
  | RuntimeCommittedDecision
  | { readonly kind: 'reject'; readonly reason: string };

export type RuntimeCreateResult =
  | {
      readonly kind: 'created';
      readonly state: BaseGameState<GameType>;
      readonly configJson: string;
    }
  | { readonly kind: 'invalidConfig'; readonly reason: string };

export type RuntimeConfigResult =
  | {
      readonly kind: 'valid';
      readonly config: unknown;
      readonly configJson: string;
    }
  | { readonly kind: 'invalid'; readonly reason: string };

export interface WorkerEffectRoomIdentity {
  readonly roomId: string;
  readonly roomCode: string;
  readonly creationId: string;
}

export interface WorkerEffectBusinessContext {
  readonly originCommandId: string;
  readonly createdRevision: number;
}

export interface RuntimeWorkerEffectContext {
  readonly bindings: Env;
  readonly effectId: string;
  readonly state: BaseGameState<GameType>;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly createdRevision: number;
  dispatchInternal(
    commandId: string,
    command: unknown,
  ): Promise<RoomCommandResult<BaseGameState<GameType>>>;
  publishUserEvent(userId: string, eventId: string, message: object): Promise<void>;
}

/** Runtime-erased game operations consumed by the generic room authority. */
export interface RuntimeWorkerGameModule {
  readonly gameType: GameType;
  readonly stateVersion: number;
  parseCreateConfig(config: unknown): RuntimeConfigResult;
  createInitialState(config: unknown, context: CreateGameContext): RuntimeCreateResult;
  parseState(value: unknown): BaseGameState<GameType>;
  parseCommandResult(value: unknown): RoomCommandResult<BaseGameState<GameType>>;
  decidePublic(state: unknown, command: unknown, context: CommandContext): RuntimeDecision;
  decideInternal(state: unknown, command: unknown, context: CommandContext): RuntimeDecision;
  getPublicUserStats(userId: string, bindings: Env): Promise<unknown>;
  getEffectBusinessKey(effect: unknown, context: WorkerEffectBusinessContext): string;
  handleEffect(effect: unknown, context: RuntimeWorkerEffectContext): Promise<void>;
}

export type WorkerGameModuleResolver = (gameType: GameType) => RuntimeWorkerGameModule;
