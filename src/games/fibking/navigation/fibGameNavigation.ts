/** FibKing root-navigation definition and strict route parsers. */

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

import { parseFibConfigRouteParams } from './fibConfigRoute';
import type { FibGuideRouteParams } from './types';

function parseFibGuideRouteParams(params: unknown): FibGuideRouteParams {
  const routeParams = parseRouteParams(params, 'FibKing guide');
  const gameType = parseGameType(routeParams.gameType);
  if (gameType !== 'fibking') {
    throw new Error(`[FAIL-FAST] FibKing guide received game type ${gameType}`);
  }
  assertExactRouteParamKeys(routeParams, ['gameType', 'roomCode'], 'FibKing guide');

  const roomCode =
    routeParams.roomCode === undefined ? undefined : parseRoomCode(routeParams.roomCode);
  return { gameType, roomCode };
}

const unsupportedRoute: UnsupportedGameNavigationRoute = { kind: 'unsupported' };

export const fibGameNavigation = defineGameNavigation({
  gameType: 'fibking',
  config: {
    kind: 'screen',
    parseParams: parseFibConfigRouteParams,
  },
  guide: {
    kind: 'screen',
    parseParams: parseFibGuideRouteParams,
  },
  notepad: unsupportedRoute,
});
