/** Typed composition boundary between pure game engines and the Worker runtime. */

import type {
  CommandContext,
  CommandOf,
  CommittedCommandOutcome,
  CommonGameLifecycle,
  CreateGameContext,
  GameCommand,
  GameEffect,
  GameEngineDefinition,
  GameEvent,
} from '@game-judge/game-engine/platform/engine';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import {
  parseRoomCommandResult,
  type RoomCommandResult,
} from '@game-judge/game-engine/platform/protocol/commandResult';
import { GAME_TYPES, type GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { Hono } from 'hono';
import type { ZodType } from 'zod';

import type { AppEnv, Env } from '../../env';
import type {
  EffectExecutionResult,
  EffectTerminalReason,
  RuntimeWorkerGameModule,
  WorkerEffectBusinessContext,
  WorkerEffectRoomIdentity,
} from './runtimeGameModule';

export interface WorkerGameHttpRoute<TGameType extends string> {
  readonly path: `/api/games/${TGameType}/${string}`;
  readonly router: Hono<AppEnv>;
}

export interface WorkerEffectContext<TState extends BaseGameState<string>, TInternalCommand> {
  readonly bindings: Env;
  readonly effectId: string;
  readonly state: TState;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly createdRevision: number;
  dispatchInternal(
    commandId: string,
    command: TInternalCommand,
  ): Promise<RoomCommandResult<TState>>;
  publishUserEvent(userId: string, eventId: string, message: object): Promise<void>;
}

export interface WorkerModuleCommittedDecision<
  TState extends BaseGameState<string>,
  TEffect extends GameEffect,
> {
  readonly kind: 'commit';
  readonly commandType: string;
  readonly state: TState;
  readonly hasStateEvents: boolean;
  readonly effects: readonly TEffect[];
  readonly broadcast: 'state' | 'none';
  readonly outcome: CommittedCommandOutcome;
  readonly previousLifecycle: CommonGameLifecycle;
  readonly lifecycle: CommonGameLifecycle;
}

export type WorkerModuleDecision<
  TState extends BaseGameState<string>,
  TEffect extends GameEffect,
> =
  | WorkerModuleCommittedDecision<TState, TEffect>
  | { readonly kind: 'reject'; readonly reason: string };

export type WorkerModuleCreateResult<TState extends BaseGameState<string>> =
  | {
      readonly kind: 'created';
      readonly state: TState;
      readonly configJson: string;
    }
  | { readonly kind: 'invalidConfig'; readonly reason: string };

export type WorkerModuleConfigResult<TConfig> =
  | {
      readonly kind: 'valid';
      readonly config: TConfig;
      readonly configJson: string;
    }
  | { readonly kind: 'invalid'; readonly reason: string };

export interface WorkerModuleRuntimeEffectContext<TState extends BaseGameState<string>> {
  readonly bindings: Env;
  readonly effectId: string;
  readonly state: TState;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly createdRevision: number;
  dispatchInternal(commandId: string, command: unknown): Promise<RoomCommandResult<TState>>;
  publishUserEvent(userId: string, eventId: string, message: object): Promise<void>;
}

export interface WorkerModuleRuntime<
  TState extends BaseGameState<string>,
  TConfig,
  TEffect extends GameEffect,
  TPublicUserStats,
> {
  readonly stateVersion: number;
  parseCreateConfig(config: unknown): WorkerModuleConfigResult<TConfig>;
  createInitialState(config: unknown, context: CreateGameContext): WorkerModuleCreateResult<TState>;
  parseState(value: unknown): TState;
  parseCommandResult(value: unknown): RoomCommandResult<TState>;
  decidePublic(
    state: unknown,
    command: unknown,
    context: CommandContext,
  ): WorkerModuleDecision<TState, TEffect>;
  decideInternal(
    state: unknown,
    command: unknown,
    context: CommandContext,
  ): WorkerModuleDecision<TState, TEffect>;
  getPublicUserStats(userId: string, bindings: Env): Promise<TPublicUserStats>;
  getEffectBusinessKey(effect: unknown, context: WorkerEffectBusinessContext): string;
  handleEffect(
    effect: unknown,
    context: WorkerModuleRuntimeEffectContext<TState>,
  ): Promise<EffectExecutionResult>;
  handleTerminalEffect(
    effect: unknown,
    context: WorkerModuleRuntimeEffectContext<TState>,
    reason: EffectTerminalReason,
  ): Promise<void>;
}

export interface WorkerGameModuleDefinition<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
  TConfig,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
  TPublicCommand extends GameCommand,
  TInternalCommand extends GameCommand,
  TEngine extends GameEngineDefinition<
    TGameType,
    TState,
    TConfig,
    TPublicCommand | TInternalCommand,
    TEvent,
    TEffect
  >,
  TPublicUserStats,
> {
  readonly gameType: TGameType;
  readonly engine: TEngine;
  readonly stateCodec: GameStateCodec<TState>;
  readonly createConfigSchema: ZodType<TConfig>;
  readonly publicCommandSchema: ZodType<TPublicCommand>;
  readonly internalCommandSchema: ZodType<TInternalCommand>;
  readonly effectSchema: ZodType<TEffect>;
  readonly httpRoutes: readonly WorkerGameHttpRoute<TGameType>[];
  parsePublicUserStats(value: unknown): TPublicUserStats;
  getPublicUserStats(userId: string, bindings: Env): Promise<TPublicUserStats>;
  getEffectBusinessKey(effect: TEffect, context: WorkerEffectBusinessContext): string;
  handleEffect(
    effect: TEffect,
    context: WorkerEffectContext<TState, TInternalCommand>,
  ): Promise<EffectExecutionResult>;
  handleTerminalEffect(
    effect: TEffect,
    context: WorkerEffectContext<TState, TInternalCommand>,
    reason: EffectTerminalReason,
  ): Promise<void>;
}

export type WorkerGameModule<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
  TConfig,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
  TPublicCommand extends GameCommand,
  TInternalCommand extends GameCommand,
  TEngine extends GameEngineDefinition<
    TGameType,
    TState,
    TConfig,
    TPublicCommand | TInternalCommand,
    TEvent,
    TEffect
  >,
  TPublicUserStats,
> = Omit<
  WorkerGameModuleDefinition<
    TGameType,
    TState,
    TConfig,
    TEvent,
    TEffect,
    TPublicCommand,
    TInternalCommand,
    TEngine,
    TPublicUserStats
  >,
  'getPublicUserStats' | 'getEffectBusinessKey' | 'handleEffect' | 'handleTerminalEffect'
> &
  WorkerModuleRuntime<TState, TConfig, TEffect, TPublicUserStats>;

type ExactCommandPartition<TCommand, TPublicCommand, TInternalCommand> =
  Exclude<TCommand, TPublicCommand | TInternalCommand> extends never
    ? Extract<TPublicCommand, TInternalCommand> extends never
      ? unknown
      : never
    : never;

/** Build callable runtime operations while preserving the authored game identity. */
export function defineWorkerGameModule<
  const TGameType extends string,
  TState extends BaseGameState<TGameType>,
  TConfig,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
  const TPublicCommand extends GameCommand,
  const TInternalCommand extends GameCommand,
  const TEngine extends GameEngineDefinition<
    TGameType,
    TState,
    TConfig,
    TPublicCommand | TInternalCommand,
    TEvent,
    TEffect
  >,
  const TPublicUserStats,
>(
  definition: WorkerGameModuleDefinition<
    TGameType,
    TState,
    TConfig,
    TEvent,
    TEffect,
    TPublicCommand,
    TInternalCommand,
    TEngine,
    TPublicUserStats
  > &
    ExactCommandPartition<CommandOf<TEngine>, TPublicCommand, TInternalCommand>,
): WorkerGameModule<
  TGameType,
  TState,
  TConfig,
  TEvent,
  TEffect,
  TPublicCommand,
  TInternalCommand,
  TEngine,
  TPublicUserStats
> {
  const engine: GameEngineDefinition<
    TGameType,
    TState,
    TConfig,
    TPublicCommand | TInternalCommand,
    TEvent,
    TEffect
  > = definition.engine;

  const routePrefix = `/api/games/${definition.gameType}/`;
  for (const route of definition.httpRoutes) {
    if (!route.path.startsWith(routePrefix) || route.path.length === routePrefix.length) {
      throw new Error(
        `Game module ${definition.gameType} registered HTTP route outside ${routePrefix}`,
      );
    }
  }

  const assertStateIdentity = (state: TState): void => {
    if (state.gameType !== definition.gameType) {
      throw new Error(
        `Game module ${definition.gameType} produced state for ${String(state.gameType)}`,
      );
    }
    if (state.stateVersion !== engine.stateVersion) {
      throw new Error(
        `Game module ${definition.gameType} produced unsupported state version ${state.stateVersion}`,
      );
    }
  };

  const parseState = (value: unknown): TState => {
    const state = engine.normalize(definition.stateCodec.parse(value));
    assertStateIdentity(state);
    return state;
  };

  const parseCreateConfig = (
    rawConfig: unknown,
  ):
    | { readonly kind: 'valid'; readonly config: TConfig; readonly configJson: string }
    | { readonly kind: 'invalid'; readonly reason: string } => {
    const parsedConfig = definition.createConfigSchema.safeParse(rawConfig);
    if (!parsedConfig.success) return { kind: 'invalid', reason: 'VALIDATION_ERROR' };
    return {
      kind: 'valid',
      config: parsedConfig.data,
      configJson: canonicalJson(parsedConfig.data),
    };
  };

  const executeDecision = (
    state: TState,
    command: TPublicCommand | TInternalCommand,
    context: CommandContext,
  ): WorkerModuleDecision<TState, TEffect> => {
    const decision = engine.decide(state, command, context);
    if (decision.kind === 'reject') return decision;

    let nextState = state;
    for (const event of decision.events) {
      nextState = engine.evolve(nextState, event);
    }
    nextState = engine.normalize(nextState);
    assertStateIdentity(nextState);

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
      previousLifecycle: engine.getLifecycle(state),
      lifecycle: engine.getLifecycle(nextState),
    };
  };

  return {
    ...definition,
    stateVersion: engine.stateVersion,
    parseCreateConfig,
    createInitialState: (rawConfig, context) => {
      const parsedConfig = parseCreateConfig(rawConfig);
      if (parsedConfig.kind === 'invalid') {
        return { kind: 'invalidConfig', reason: parsedConfig.reason };
      }
      const state = engine.normalize(engine.createInitialState(parsedConfig.config, context));
      assertStateIdentity(state);
      return {
        kind: 'created',
        state,
        configJson: parsedConfig.configJson,
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
      return executeDecision(state, parsedCommand.data, context);
    },
    decideInternal: (rawState, rawCommand, context) =>
      executeDecision(
        parseState(rawState),
        definition.internalCommandSchema.parse(rawCommand),
        context,
      ),
    getPublicUserStats: async (userId, bindings) =>
      definition.parsePublicUserStats(await definition.getPublicUserStats(userId, bindings)),
    getEffectBusinessKey: (rawEffect, context) => {
      const businessKey = definition.getEffectBusinessKey(
        definition.effectSchema.parse(rawEffect),
        context,
      );
      if (businessKey.length === 0) {
        throw new Error(`Game module ${definition.gameType} produced an empty effect business key`);
      }
      return businessKey;
    },
    handleEffect: (rawEffect, context) =>
      definition.handleEffect(definition.effectSchema.parse(rawEffect), {
        bindings: context.bindings,
        effectId: context.effectId,
        state: parseState(context.state),
        roomIdentity: context.roomIdentity,
        createdRevision: context.createdRevision,
        dispatchInternal: (commandId, command) => context.dispatchInternal(commandId, command),
        publishUserEvent: (userId, eventId, message) =>
          context.publishUserEvent(userId, eventId, message),
      }),
    handleTerminalEffect: (rawEffect, context, reason) =>
      definition.handleTerminalEffect(
        definition.effectSchema.parse(rawEffect),
        {
          bindings: context.bindings,
          effectId: context.effectId,
          state: parseState(context.state),
          roomIdentity: context.roomIdentity,
          createdRevision: context.createdRevision,
          dispatchInternal: (commandId, command) => context.dispatchInternal(commandId, command),
          publishUserEvent: (userId, eventId, message) =>
            context.publishUserEvent(userId, eventId, message),
        },
        reason,
      ),
  };
}

/** Erase one authored module only after its ID and engine match the production catalog. */
export function registerWorkerGameModule<
  const TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TConfig,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
  const TPublicCommand extends GameCommand,
  const TInternalCommand extends GameCommand,
  const TEngine extends GameEngineDefinition<
    TGameType,
    TState,
    TConfig,
    TPublicCommand | TInternalCommand,
    TEvent,
    TEffect
  >,
  const TPublicUserStats,
>(
  module: WorkerGameModule<
    TGameType,
    TState,
    TConfig,
    TEvent,
    TEffect,
    TPublicCommand,
    TInternalCommand,
    TEngine,
    TPublicUserStats
  >,
) {
  const runtimeModule: RuntimeWorkerGameModule = {
    gameType: module.gameType,
    stateVersion: module.stateVersion,
    parseCreateConfig: (config) => module.parseCreateConfig(config),
    createInitialState: (config, context) => module.createInitialState(config, context),
    parseState: (value) => module.parseState(value),
    parseCommandResult: (value) => module.parseCommandResult(value),
    decidePublic: (state, command, context) => module.decidePublic(state, command, context),
    decideInternal: (state, command, context) => module.decideInternal(state, command, context),
    getPublicUserStats: (userId, bindings) => module.getPublicUserStats(userId, bindings),
    getEffectBusinessKey: (effect, context) => module.getEffectBusinessKey(effect, context),
    handleEffect: (effect, context) =>
      module.handleEffect(effect, {
        bindings: context.bindings,
        effectId: context.effectId,
        state: module.parseState(context.state),
        roomIdentity: context.roomIdentity,
        createdRevision: context.createdRevision,
        dispatchInternal: async (commandId, command) =>
          module.parseCommandResult(await context.dispatchInternal(commandId, command)),
        publishUserEvent: (userId, eventId, message) =>
          context.publishUserEvent(userId, eventId, message),
      }),
    handleTerminalEffect: (effect, context, reason) =>
      module.handleTerminalEffect(
        effect,
        {
          bindings: context.bindings,
          effectId: context.effectId,
          state: module.parseState(context.state),
          roomIdentity: context.roomIdentity,
          createdRevision: context.createdRevision,
          dispatchInternal: async (commandId, command) =>
            module.parseCommandResult(await context.dispatchInternal(commandId, command)),
          publishUserEvent: (userId, eventId, message) =>
            context.publishUserEvent(userId, eventId, message),
        },
        reason,
      ),
  };

  return {
    ...module,
    ...runtimeModule,
    gameType: module.gameType,
    engine: module.engine,
  };
}

export type WorkerGameCatalogShape = {
  readonly [TGameType in GameType]: RuntimeWorkerGameModule & {
    readonly gameType: TGameType;
    readonly engine: object;
  };
};

type EngineCatalogShape = {
  readonly [TGameType in GameType]: {
    readonly gameType: TGameType;
  };
};

type ValidatedWorkerGameCatalog<
  TEngineCatalog extends EngineCatalogShape,
  TCatalog extends WorkerGameCatalogShape,
> = {
  readonly [TGameType in GameType]: TCatalog[TGameType] extends RuntimeWorkerGameModule & {
    readonly gameType: TGameType;
    readonly engine: TEngineCatalog[TGameType];
  }
    ? TCatalog[TGameType]
    : never;
} & {
  readonly [TExtraKey in Exclude<keyof TCatalog, GameType>]: never;
};

/** Bind canonical Worker modules to the one production engine catalog. */
export function defineWorkerGameCatalog<
  const TEngineCatalog extends EngineCatalogShape,
  const TCatalog extends WorkerGameCatalogShape,
>(
  engineCatalog: TEngineCatalog,
  catalog: TCatalog & ValidatedWorkerGameCatalog<TEngineCatalog, TCatalog>,
): TCatalog {
  for (const gameType of GAME_TYPES) {
    if (catalog[gameType].engine !== engineCatalog[gameType]) {
      throw new Error(`[FAIL-FAST] Worker module ${gameType} does not use its production engine`);
    }
  }
  return catalog;
}
