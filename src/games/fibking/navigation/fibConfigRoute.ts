/** Strict root-route parsing for FibKing configuration. */

import { parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import {
  assertExactRouteParamKeys,
  parseRouteParams,
} from '@/features/navigation/model/routeParams';

import type { FibConfigRouteParams } from './types';

export function parseFibConfigRouteParams(params: unknown): FibConfigRouteParams {
  const routeParams = parseRouteParams(params, 'FibKing config');
  const gameType = parseGameType(routeParams.gameType);
  if (gameType !== 'fibking') {
    throw new Error(`[FAIL-FAST] FibKing config received game type ${gameType}`);
  }

  const mode = routeParams.mode;
  if (typeof mode !== 'string') {
    throw new Error('[FAIL-FAST] FibKing config mode must be a string');
  }
  assertExactRouteParamKeys(routeParams, ['gameType', 'mode', 'roomCode'], 'FibKing config');

  switch (mode) {
    case 'create':
      if (routeParams.roomCode !== undefined) {
        throw new Error('[FAIL-FAST] FibKing create config must not include a room code');
      }
      return { gameType, mode };
    case 'edit':
      return { gameType, mode, roomCode: parseRoomCode(routeParams.roomCode) };
    default:
      throw new Error(`[FAIL-FAST] Unknown FibKing config mode: ${mode}`);
  }
}
