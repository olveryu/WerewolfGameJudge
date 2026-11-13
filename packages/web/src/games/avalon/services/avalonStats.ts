import {
  type AvalonPublicStats,
  parseAvalonPublicStats,
} from '@game-judge/game-engine/games/avalon/public';

import { publicGameStatsOptions } from '@/games/model/publicGameStats';

export const avalonPublicStatsOptions = (userId: string) =>
  publicGameStatsOptions('avalon', userId, parseAvalonPublicStats);

export type { AvalonPublicStats };
