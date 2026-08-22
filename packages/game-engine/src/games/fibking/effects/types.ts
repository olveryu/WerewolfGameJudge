/** Durable effects emitted by the pure FibKing engine. */

import type { GameEffect } from '../../../platform/engine';

export interface FibSelectWordEffect extends GameEffect {
  readonly type: 'fib.word.select';
  readonly payload: {
    readonly roundId: string;
    readonly avoidWords: readonly string[];
  };
}

export interface FibRecordWordUsageEffect extends GameEffect {
  readonly type: 'fib.word.recordUsage';
  readonly payload: {
    readonly roundId: string;
    readonly word: string;
    readonly source: 'gemini' | 'local';
    readonly usedAt: number;
    readonly participantUserIds: readonly string[];
  };
}

export type FibEffect = FibSelectWordEffect | FibRecordWordUsageEffect;
