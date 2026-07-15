/** Public FibKing statistics contract shared by Worker and client runtimes. */

import { FIBKING_GAME_TYPE } from '../../platform/protocol/gameTypes';
import { finishObject, parseObject } from '../../platform/protocol/runtimeDecoder';

export interface FibPublicStats {
  readonly gameType: typeof FIBKING_GAME_TYPE;
}

export function parseFibPublicStats(value: unknown): FibPublicStats {
  const raw = parseObject(value, 'fibPublicStats');
  if (raw.gameType !== FIBKING_GAME_TYPE) {
    throw new Error(`fibPublicStats.gameType must be ${FIBKING_GAME_TYPE}`);
  }
  return finishObject(raw, { gameType: FIBKING_GAME_TYPE }, 'fibPublicStats');
}
