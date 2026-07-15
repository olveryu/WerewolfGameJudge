/** Durable effects emitted by the pure FibKing engine. */

import type { GameEffect } from '../../../platform/engine';

export interface FibGenerateWordEffect extends GameEffect {
  readonly type: 'fib.word.generate';
  readonly payload: {
    readonly roundId: string;
    readonly avoidWords: readonly string[];
  };
}

export type FibEffect = FibGenerateWordEffect;
