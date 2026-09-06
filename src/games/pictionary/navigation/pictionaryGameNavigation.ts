/** Pictionary root-navigation definition and strict route parsers. */

import { parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import {
  defineGameNavigation,
  type UnsupportedGameNavigationRoute,
} from '@/features/navigation/model/GameNavigationContribution';
import {
  assertExactRouteParamKeys,
  parseRouteParams,
} from '@/features/navigation/model/routeParams';
import { parsePictionaryConfigRouteParams } from '@/games/pictionary/navigation/pictionaryConfigRoute';
import type { PictionaryGuideRouteParams } from '@/games/pictionary/navigation/types';

function parsePictionaryGuideRouteParams(params: unknown): PictionaryGuideRouteParams {
  const routeParams = parseRouteParams(params, 'Pictionary guide');
  const gameType = parseGameType(routeParams.gameType);
  if (gameType !== 'pictionary') {
    throw new Error(`[FAIL-FAST] Pictionary guide received game type ${gameType}`);
  }
  assertExactRouteParamKeys(routeParams, ['gameType', 'roomCode'], 'Pictionary guide');
  const roomCode =
    routeParams.roomCode === undefined ? undefined : parseRoomCode(routeParams.roomCode);
  return { gameType, roomCode };
}

const unsupportedRoute: UnsupportedGameNavigationRoute = { kind: 'unsupported' };

export const pictionaryGameNavigation = defineGameNavigation({
  gameType: 'pictionary',
  config: { kind: 'screen', parseParams: parsePictionaryConfigRouteParams },
  guide: { kind: 'screen', parseParams: parsePictionaryGuideRouteParams },
  notepad: unsupportedRoute,
});
