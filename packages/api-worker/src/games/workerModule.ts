/** Typed composition boundary between pure game engines and the Worker runtime. */

import type { GameEngineCatalog } from '@game-judge/game-engine/games/catalog';
import type {
  CommandContext,
  CommandOf,
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
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { Hono } from 'hono';
import type { ZodType } from 'zod';

import type { AppEnv, Env } from '../env';
import type {
  RuntimeDecision,
  RuntimeWorkerGameModule,
  WorkerEffectBusinessContext,
  WorkerEffectRoomIdentity,
} from '../platform/room/runtimeGameModule';

export type RegisteredGameEngine = GameEngineCatalog[GameType];

export interface WorkerGameHttpRoute<TGameType extends GameType> {
  readonly path: `/api/games/${TGameType}/${string}`;
  readonly router: Hono<AppEnv>;
}

export interface WorkerEffectContext<TState extends BaseGameState<GameType>, TInternalCommand> {
  readonly bindings: Env;
  readonly effectId: string;
  readonly state: TState;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly createdRevision: number;
  dispatchInternal(
    commandId: string,
    command: TInternalCommand,
  ): Promise<RoomCommandResult<BaseGameState<GameType>>>;
  publishUserEvent(userId: string, eventId: string, message: object): Promise<void>;
}

export interface WorkerGameModuleDefinition<
  TGameType extends GameType,
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
  ): Promise<void>;
}

export type WorkerGameModule<
  TGameType extends GameType,
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
> = WorkerGameModuleDefinition<
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
  RuntimeWorkerGameModule;

type ExactCommandPartition<TCommand, TPublicCommand, TInternalCommand> =
  Exclude<TCommand, TPublicCommand | TInternalCommand> extends never
    ? Extract<TPublicCommand, TInternalCommand> extends never
      ? unknown
      : never
    : never;

/** Close concrete game types inside callable runtime operations. */
export function defineWorkerGameModule<
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
    ExactCommandPartition<CommandOf<TEngine>, TPublicCommand, TInternalCommand> & {
      readonly engine: TEngine & GameEngineCatalog[TGameType];
    },
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
  ): RuntimeDecision => {
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
