import {
  parseUndercoverPublicStats,
  type UndercoverPublicStats,
} from '@game-judge/game-engine/games/undercover/public';

import { publicGameStatsOptions } from '@/games/model/publicGameStats';

export const undercoverPublicStatsOptions = (userId: string) =>
  publicGameStatsOptions('undercover', userId, parseUndercoverPublicStats);

export type { UndercoverPublicStats };
