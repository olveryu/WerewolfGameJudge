/** Durable effects emitted by the pure FibKing engine. */

import type { GameEffect } from '../../../platform/engine';
import type { GameCompletionPayload } from '../../../platform/engine/completionEffect';
import type { FibCompletionPayload } from '../publicStats';

export interface FibSelectWordEffect extends GameEffect {
  readonly type: 'fibking.word.select';
  readonly payload: {
    readonly roundId: string;
    readonly avoidWords: readonly string[];
    readonly participantUserIds: readonly string[];
  };
}

export interface FibRecordWordUsageEffect extends GameEffect {
  readonly type: 'fibking.word.recordUsage';
  readonly payload: {
    readonly roundId: string;
    readonly word: string;
    readonly source: 'gemini' | 'local';
    readonly usedAt: number;
    readonly participantUserIds: readonly string[];
  };
}

export interface FibCompletedEffect extends GameEffect {
  readonly type: 'fibking.game.completed';
  readonly payload: GameCompletionPayload | FibCompletionPayload;
}

export type FibEffect = FibSelectWordEffect | FibRecordWordUsageEffect | FibCompletedEffect;
