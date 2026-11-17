import { parseSpotmatchPublicStats } from '@game-judge/game-engine/games/spotmatch/public';

import { publicGameStatsOptions } from '@/games/model/publicGameStats';

export const spotmatchPublicStatsOptions = (userId: string) =>
  publicGameStatsOptions('spotmatch', userId, parseSpotmatchPublicStats);
