import {
  parsePictionaryPublicStats,
  type PictionaryPublicStats,
} from '@game-judge/game-engine/games/pictionary/public';

import { publicGameStatsOptions } from '@/games/model/publicGameStats';

export const pictionaryPublicStatsOptions = (userId: string) =>
  publicGameStatsOptions('pictionary', userId, parsePictionaryPublicStats);

export type { PictionaryPublicStats };
