import {
  type FibPublicStats,
  parseFibPublicStats,
} from '@game-judge/game-engine/games/fibking/public';

import { publicGameStatsOptions } from '@/games/model/publicGameStats';

export const fibPublicStatsOptions = (userId: string) =>
  publicGameStatsOptions('fibking', userId, parseFibPublicStats);

export type { FibPublicStats };
