import {
  type DrawGuessPublicStats,
  parseDrawGuessPublicStats,
} from '@game-judge/game-engine/games/drawguess/public';

import { publicGameStatsOptions } from '@/games/model/publicGameStats';

export const drawGuessPublicStatsOptions = (userId: string) =>
  publicGameStatsOptions('drawguess', userId, parseDrawGuessPublicStats);

export type { DrawGuessPublicStats };
