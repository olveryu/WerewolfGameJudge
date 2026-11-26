import { parseDecryptoPublicStats } from '@game-judge/game-engine/games/decrypto/public';

import { publicGameStatsOptions } from '@/games/model/publicGameStats';

export const decryptoPublicStatsOptions = (userId: string) =>
  publicGameStatsOptions('decrypto', userId, parseDecryptoPublicStats);
