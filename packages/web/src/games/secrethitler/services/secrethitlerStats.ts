import { parseSecrethitlerPublicStats } from '@game-judge/game-engine/games/secrethitler/public';

import { publicGameStatsOptions } from '@/games/model/publicGameStats';

export const secrethitlerPublicStatsOptions = (userId: string) =>
  publicGameStatsOptions('secrethitler', userId, parseSecrethitlerPublicStats);
