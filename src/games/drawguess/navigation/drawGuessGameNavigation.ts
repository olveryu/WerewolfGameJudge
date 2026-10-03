/**
 * 你画我猜路由解析；导航宿主收到校验过的游戏参数。
 */

import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  assertExactRouteParamKeys,
  parseRouteParams,
} from '@/features/navigation/model/routeParams';

export type DrawGuessConfigRouteParams =
  | { readonly gameType: 'drawguess'; readonly mode: 'create' }
  | { readonly gameType: 'drawguess'; readonly mode: 'edit'; readonly roomCode: string };

/** 只解析创建或活跃房间的设置编辑路由。 */
export function parseDrawGuessConfigRouteParams(value: unknown): DrawGuessConfigRouteParams {
  const params = parseRouteParams(value, 'DrawGuess config');
  assertExactRouteParamKeys(params, ['gameType', 'mode', 'roomCode'], 'DrawGuess config');
  if (params.gameType !== 'drawguess') throw new Error('DrawGuess config game mismatch');
  if (params.mode === 'create' && params.roomCode === undefined)
    return { gameType: 'drawguess', mode: 'create' };
  if (params.mode === 'edit')
    return { gameType: 'drawguess', mode: 'edit', roomCode: parseRoomCode(params.roomCode) };
  throw new Error('Invalid DrawGuess config route');
}

function parseGuide(value: unknown): {
  readonly gameType: 'drawguess';
  readonly roomCode?: string;
} {
  const params = parseRouteParams(value, 'DrawGuess guide');
  assertExactRouteParamKeys(params, ['gameType', 'roomCode'], 'DrawGuess guide');
  if (params.gameType !== 'drawguess') throw new Error('DrawGuess guide game mismatch');
  return {
    gameType: 'drawguess' as const,
    roomCode: params.roomCode === undefined ? undefined : parseRoomCode(params.roomCode),
  };
}

export const drawGuessGameNavigation = defineGameNavigation({
  gameType: 'drawguess',
  config: { kind: 'screen', parseParams: parseDrawGuessConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});
