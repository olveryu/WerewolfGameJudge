// Public account stats contract for Fashion Shadow.

import { FASHION_SHADOW_GAME_TYPE } from '../../platform/protocol/gameTypes';
import { failDecode, finishObject, parseObject } from '../../platform/protocol/runtimeDecoder';

export interface FashionPublicStats {
  readonly gameType: typeof FASHION_SHADOW_GAME_TYPE;
}

export function parseFashionPublicStats(value: unknown): FashionPublicStats {
  const raw = parseObject(value, 'fashionPublicStats');
  if (raw.gameType !== FASHION_SHADOW_GAME_TYPE) {
    return failDecode('fashionPublicStats.gameType', FASHION_SHADOW_GAME_TYPE);
  }
  return finishObject(raw, { gameType: FASHION_SHADOW_GAME_TYPE }, 'fashionPublicStats');
}
