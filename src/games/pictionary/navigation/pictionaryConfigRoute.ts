/** Strict root-route parsing for Pictionary configuration. */

import { parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import {
  assertExactRouteParamKeys,
  parseRouteParams,
} from '@/features/navigation/model/routeParams';
import type { PictionaryConfigRouteParams } from '@/games/pictionary/navigation/types';

export function parsePictionaryConfigRouteParams(params: unknown): PictionaryConfigRouteParams {
  const routeParams = parseRouteParams(params, 'Pictionary config');
  const gameType = parseGameType(routeParams.gameType);
  if (gameType !== 'pictionary') {
    throw new Error(`[FAIL-FAST] Pictionary config received game type ${gameType}`);
  }
  const mode = routeParams.mode;
  if (typeof mode !== 'string') {
    throw new Error('[FAIL-FAST] Pictionary config mode must be a string');
  }
  assertExactRouteParamKeys(routeParams, ['gameType', 'mode', 'roomCode'], 'Pictionary config');
  switch (mode) {
    case 'create':
      if (routeParams.roomCode !== undefined) {
        throw new Error('[FAIL-FAST] Pictionary create config must not include a room code');
      }
      return { gameType, mode };
    case 'edit':
      return { gameType, mode, roomCode: parseRoomCode(routeParams.roomCode) };
    default:
      throw new Error(`[FAIL-FAST] Unknown Pictionary config mode: ${mode}`);
  }
}
