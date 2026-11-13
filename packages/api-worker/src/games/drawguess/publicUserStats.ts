import {
  type drawGuessCompletionPayloadSchema,
  parseDrawGuessPublicStats,
} from '@game-judge/game-engine/games/drawguess/public';
import { getTableName } from 'drizzle-orm';
import type { z } from 'zod';

import type { Env } from '../../env';
import { countGameStats, readCountGameStats } from '../../features/account/gameStats';
import { drawguessUserStats } from './dbSchema';

type Fact = z.infer<typeof drawGuessCompletionPayloadSchema>['stats'][number];
const table = getTableName(drawguessUserStats);
const columns = {
  gamesPlayed: 'games_played',
  guessAttempts: 'guess_attempts',
  guessRounds: 'guess_rounds',
  guessedRounds: 'guessed_rounds',
  guessTimeMs: 'guess_time_ms',
  guessTimedRounds: 'guess_timed_rounds',
  drawingRounds: 'drawing_rounds',
  guessedDrawingRounds: 'guessed_drawing_rounds',
  totalScore: 'total_score',
  flowersReceived: 'flowers_received',
  eggsReceived: 'eggs_received',
  tomatoesReceived: 'tomatoes_received',
} as const;

export function drawGuessStatsSettlement(facts: readonly Fact[]) {
  return countGameStats(facts, table, (fact) => ({
    games_played: fact.gamesPlayed,
    guess_attempts: fact.guessAttempts,
    guess_rounds: fact.guessRounds,
    guessed_rounds: fact.guessedRounds,
    guess_time_ms: fact.guessTimeMs,
    guess_timed_rounds: fact.guessTimedRounds,
    drawing_rounds: fact.drawingRounds,
    guessed_drawing_rounds: fact.guessedDrawingRounds,
    total_score: fact.totalScore,
    flowers_received: fact.flowersReceived,
    eggs_received: fact.eggsReceived,
    tomatoes_received: fact.tomatoesReceived,
  }));
}

export async function getDrawGuessPublicUserStats(userId: string, bindings: Env) {
  return parseDrawGuessPublicStats({
    gameType: 'drawguess',
    ...(await readCountGameStats(bindings.DB, userId, table, columns)),
  });
}
