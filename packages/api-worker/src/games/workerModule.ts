/** Compile-time binding between a registered pure engine and Worker runtime schemas. */

import type { GameEngineCatalog } from '@werewolf/game-engine/games/catalog';
import type {
  CommandOf,
  ConfigOf,
  EffectOf,
  GameEffect,
  StateOf,
} from '@werewolf/game-engine/platform/engine';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { GameStateCodec } from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { ZodType } from 'zod';

export type RegisteredGameEngine = GameEngineCatalog[GameType];

export type EffectHandlerMap<TEffect extends GameEffect> = {
  readonly [TType in TEffect['type']]: (
    effect: Extract<TEffect, { readonly type: TType }>,
  ) => Promise<void>;
};

export interface WorkerGameModule<TEngine extends RegisteredGameEngine> {
  readonly gameType: TEngine['gameType'];
  readonly engine: TEngine;
  readonly stateCodec: GameStateCodec<StateOf<TEngine>>;
  readonly createConfigSchema: ZodType<ConfigOf<TEngine>>;
  readonly commandSchema: ZodType<CommandOf<TEngine>>;
  readonly effectHandlers: EffectHandlerMap<EffectOf<TEngine>>;
}

export function defineWorkerGameModule<const TEngine extends RegisteredGameEngine>(
  module: WorkerGameModule<TEngine>,
): WorkerGameModule<TEngine> {
  return module;
}

export type WorkerGameCatalogShape = {
  readonly [TGameType in GameType]: WorkerGameModule<GameEngineCatalog[TGameType]>;
};

type NoExtraGameTypes<TCatalog> = {
  readonly [TKey in Exclude<keyof TCatalog, GameType>]: never;
};

export function defineWorkerGameCatalog<const TCatalog extends WorkerGameCatalogShape>(
  catalog: TCatalog & NoExtraGameTypes<TCatalog>,
): TCatalog {
  return catalog;
}
