// Fashion Shadow root-navigation definition and strict route parsers.

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

import type { FashionConfigRouteParams, FashionGuideRouteParams } from './types';

export function parseFashionConfigRouteParams(params: unknown): FashionConfigRouteParams {
  const routeParams = parseRouteParams(params, 'Fashion Shadow config');
  const gameType = parseGameType(routeParams.gameType);
  if (gameType !== 'fashion-shadow') {
    throw new Error(`[FAIL-FAST] Fashion Shadow config received game type ${gameType}`);
  }
  assertExactRouteParamKeys(routeParams, ['gameType', 'mode', 'roomCode'], 'Fashion Shadow config');
  if (routeParams.mode !== 'create') {
    throw new Error('[FAIL-FAST] Fashion Shadow v1 only supports create config mode');
  }
  if (routeParams.roomCode !== undefined) {
    throw new Error('[FAIL-FAST] Fashion Shadow create config does not accept a room code');
  }
  return { gameType, mode: 'create' };
}

export function parseFashionGuideRouteParams(params: unknown): FashionGuideRouteParams {
  const routeParams = parseRouteParams(params, 'Fashion Shadow guide');
  const gameType = parseGameType(routeParams.gameType);
  if (gameType !== 'fashion-shadow') {
    throw new Error(`[FAIL-FAST] Fashion Shadow guide received game type ${gameType}`);
  }
  assertExactRouteParamKeys(routeParams, ['gameType', 'roomCode'], 'Fashion Shadow guide');
  const roomCode =
    routeParams.roomCode === undefined ? undefined : parseRoomCode(routeParams.roomCode);
  return { gameType, roomCode };
}

const unsupportedRoute: UnsupportedGameNavigationRoute = { kind: 'unsupported' };

export const fashionGameNavigation = defineGameNavigation({
  gameType: 'fashion-shadow',
  config: {
    kind: 'screen',
    parseParams: parseFashionConfigRouteParams,
  },
  guide: {
    kind: 'screen',
    parseParams: parseFashionGuideRouteParams,
  },
  notepad: unsupportedRoute,
});
