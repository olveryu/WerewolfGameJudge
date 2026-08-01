/** Exhaustive catalog helper; concrete composition remains outside platform. */

import type { GameType } from '../protocol/gameTypes';
import type { GameEngineDefinition } from './types';

type ValidatedEngineCatalog<TCatalog extends Readonly<Record<GameType, object>>> = {
  readonly [TGameType in GameType]: TCatalog[TGameType] extends GameEngineDefinition<
    TGameType,
    infer _TState,
    infer _TConfig,
    infer _TCommand,
    infer _TEvent,
    infer _TEffect
  >
    ? TCatalog[TGameType]
    : never;
} & {
  readonly [TExtraKey in Exclude<keyof TCatalog, GameType>]: never;
};

export function defineGameEngineCatalog<const TCatalog extends Readonly<Record<GameType, object>>>(
  catalog: TCatalog & ValidatedEngineCatalog<TCatalog>,
): TCatalog {
  return catalog;
}
