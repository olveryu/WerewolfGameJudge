/** Typed composition boundary between pure game engines and the Worker runtime. */

import type { GameEngineCatalog } from '@werewolf/game-engine/games/catalog';
import type {
  CommandContext,
  CommandOf,
  CommittedCommandOutcome,
  CommonGameLifecycle,
  ConfigOf,
  CreateGameContext,
  EffectOf,
  GameEffect,
  StateOf,
} from '@werewolf/game-engine/platform/engine';
import {
  parseRoomCommandResult,
  type RoomCommandResult,
} from '@werewolf/game-engine/platform/protocol/commandResult';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  GameStateCodec,
} from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { ZodType } from 'zod';

import type { Env } from '../env';

export type RegisteredGameEngine = GameEngineCatalog[GameType];

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

export interface WorkerEffectContext<TInternalCommand> {
  readonly bindings: Env;
  readonly effectId: string;
  readonly roomCode: string;
  readonly revision: number;
  dispatchInternal(
    commandId: string,
    command: TInternalCommand,
  ): Promise<RoomCommandResult<BaseGameState<GameType>>>;
  publishUserEvent(userId: string, eventId: string, message: object): Promise<void>;
}

export interface RuntimeWorkerEffectContext {
  readonly bindings: Env;
  readonly effectId: string;
  readonly roomCode: string;
  readonly revision: number;
  dispatchInternal(
    commandId: string,
    command: unknown,
  ): Promise<RoomCommandResult<BaseGameState<GameType>>>;
  publishUserEvent(userId: string, eventId: string, message: object): Promise<void>;
}

/** Runtime-erased operations. Concrete engine types stay closed inside the module factory. */
export interface RuntimeWorkerGameModule {
  readonly gameType: GameType;
  readonly stateVersion: number;
  createInitialState(config: unknown, context: CreateGameContext): RuntimeCreateResult;
  parseState(value: unknown): BaseGameState<GameType>;
  parseCommandResult(value: unknown): RoomCommandResult<BaseGameState<GameType>>;
  decidePublic(state: unknown, command: unknown, context: CommandContext): RuntimeDecision;
  decideInternal(state: unknown, command: unknown, context: CommandContext): RuntimeDecision;
  handleEffect(effect: unknown, context: RuntimeWorkerEffectContext): Promise<void>;
}

export interface WorkerGameModuleDefinition<
  TEngine extends RegisteredGameEngine,
  TPublicCommand extends CommandOf<TEngine>,
  TInternalCommand extends CommandOf<TEngine>,
> {
  readonly gameType: TEngine['gameType'];
  readonly engine: TEngine;
  readonly stateCodec: GameStateCodec<StateOf<TEngine>>;
  readonly createConfigSchema: ZodType<ConfigOf<TEngine>>;
  readonly publicCommandSchema: ZodType<TPublicCommand>;
  readonly internalCommandSchema: ZodType<TInternalCommand>;
  readonly effectSchema: ZodType<EffectOf<TEngine>>;
  handleEffect(
    effect: EffectOf<TEngine>,
    context: WorkerEffectContext<TInternalCommand>,
  ): Promise<void>;
}

export type WorkerGameModule<
  TEngine extends RegisteredGameEngine,
  TPublicCommand extends CommandOf<TEngine>,
  TInternalCommand extends CommandOf<TEngine>,
> = WorkerGameModuleDefinition<TEngine, TPublicCommand, TInternalCommand> & RuntimeWorkerGameModule;

type ExactCommandPartition<
  TEngine extends RegisteredGameEngine,
  TPublicCommand extends CommandOf<TEngine>,
  TInternalCommand extends CommandOf<TEngine>,
> =
  Exclude<CommandOf<TEngine>, TPublicCommand | TInternalCommand> extends never
    ? Extract<TPublicCommand, TInternalCommand> extends never
      ? unknown
      : never
    : never;

function assertStateIdentity<
  TEngine extends RegisteredGameEngine,
  TPublicCommand extends CommandOf<TEngine>,
  TInternalCommand extends CommandOf<TEngine>,
>(
  definition: WorkerGameModuleDefinition<TEngine, TPublicCommand, TInternalCommand>,
  state: StateOf<TEngine>,
): void {
  if (state.gameType !== definition.gameType) {
    throw new Error(
      `Game module ${definition.gameType} produced state for ${String(state.gameType)}`,
    );
  }
  if (state.stateVersion !== definition.engine.stateVersion) {
    throw new Error(
      `Game module ${definition.gameType} produced unsupported state version ${state.stateVersion}`,
    );
  }
}

function executeDecision<
  TEngine extends RegisteredGameEngine,
  TPublicCommand extends CommandOf<TEngine>,
  TInternalCommand extends CommandOf<TEngine>,
>(
  definition: WorkerGameModuleDefinition<TEngine, TPublicCommand, TInternalCommand>,
  state: StateOf<TEngine>,
  command: CommandOf<TEngine>,
  context: CommandContext,
): RuntimeDecision {
  const decision = definition.engine.decide(state, command, context);
  if (decision.kind === 'reject') return decision;

  let nextState = state;
  for (const event of decision.events) {
    nextState = definition.engine.evolve(nextState, event);
  }
  nextState = definition.engine.normalize(nextState);
  assertStateIdentity(definition, nextState);

  const hasStateEvents = decision.events.length > 0;
  if (hasStateEvents !== (decision.broadcast === 'state')) {
    throw new Error(
      `Game module ${definition.gameType} must broadcast exactly when state events commit`,
    );
  }

  return {
    kind: 'commit',
    commandType: command.type,
    state: nextState,
    hasStateEvents,
    effects: decision.effects,
    broadcast: decision.broadcast,
    outcome: decision.outcome,
    previousLifecycle: definition.engine.getLifecycle(state),
    lifecycle: definition.engine.getLifecycle(nextState),
  };
}

/** Close concrete generic types inside callable runtime operations. */
export function defineWorkerGameModule<
  const TEngine extends RegisteredGameEngine,
  const TPublicCommand extends CommandOf<TEngine>,
  const TInternalCommand extends CommandOf<TEngine>,
>(
  definition: WorkerGameModuleDefinition<TEngine, TPublicCommand, TInternalCommand> &
    ExactCommandPartition<TEngine, TPublicCommand, TInternalCommand>,
): WorkerGameModule<TEngine, TPublicCommand, TInternalCommand> {
  const parseState = (value: unknown): StateOf<TEngine> => {
    const state = definition.engine.normalize(definition.stateCodec.parse(value));
    assertStateIdentity(definition, state);
    return state;
  };

  return {
    ...definition,
    stateVersion: definition.engine.stateVersion,
    createInitialState: (rawConfig, context) => {
      const parsedConfig = definition.createConfigSchema.safeParse(rawConfig);
      if (!parsedConfig.success) {
        return { kind: 'invalidConfig', reason: 'VALIDATION_ERROR' };
      }
      const state = definition.engine.normalize(
        definition.engine.createInitialState(parsedConfig.data, context),
      );
      assertStateIdentity(definition, state);
      return {
        kind: 'created',
        state,
        configJson: JSON.stringify(parsedConfig.data),
      };
    },
    parseState,
    parseCommandResult: (value) => parseRoomCommandResult(value, definition.stateCodec),
    decidePublic: (rawState, rawCommand, context) => {
      const state = parseState(rawState);
      const parsedCommand = definition.publicCommandSchema.safeParse(rawCommand);
      if (!parsedCommand.success) {
        return { kind: 'reject', reason: 'VALIDATION_ERROR' };
      }
      return executeDecision(definition, state, parsedCommand.data, context);
    },
    decideInternal: (rawState, rawCommand, context) =>
      executeDecision(
        definition,
        parseState(rawState),
        definition.internalCommandSchema.parse(rawCommand),
        context,
      ),
    handleEffect: (rawEffect, context) =>
      definition.handleEffect(definition.effectSchema.parse(rawEffect), {
        bindings: context.bindings,
        effectId: context.effectId,
        roomCode: context.roomCode,
        revision: context.revision,
        dispatchInternal: (commandId, command) => context.dispatchInternal(commandId, command),
        publishUserEvent: (userId, eventId, message) =>
          context.publishUserEvent(userId, eventId, message),
      }),
  };
}

export type WorkerGameCatalogShape = {
  readonly [TGameType in GameType]: RuntimeWorkerGameModule & {
    readonly gameType: TGameType;
    readonly engine: GameEngineCatalog[TGameType];
  };
};

type NoExtraGameTypes<TCatalog> = {
  readonly [TKey in Exclude<keyof TCatalog, GameType>]: never;
};

export function defineWorkerGameCatalog<const TCatalog extends WorkerGameCatalogShape>(
  catalog: TCatalog & NoExtraGameTypes<TCatalog>,
): TCatalog {
  return catalog;
}
