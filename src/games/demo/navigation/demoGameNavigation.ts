/**
 * Demo路由解析；导航宿主收到校验过的游戏参数。
 */

import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  assertExactRouteParamKeys,
  parseRouteParams,
} from '@/features/navigation/model/routeParams';

export type DemoConfigRouteParams =
  | { readonly gameType: 'demo'; readonly mode: 'create' }
  | { readonly gameType: 'demo'; readonly mode: 'edit'; readonly roomCode: string };

/** 只解析创建或活跃房间的设置编辑路由。 */
export function parseDemoConfigRouteParams(value: unknown): DemoConfigRouteParams {
  const params = parseRouteParams(value, 'Demo config');
  assertExactRouteParamKeys(params, ['gameType', 'mode', 'roomCode'], 'Demo config');
  if (params.gameType !== 'demo') throw new Error('Demo config game mismatch');
  if (params.mode === 'create' && params.roomCode === undefined)
    return { gameType: 'demo', mode: 'create' };
  if (params.mode === 'edit')
    return { gameType: 'demo', mode: 'edit', roomCode: parseRoomCode(params.roomCode) };
  throw new Error('Invalid Demo config route');
}

function parseGuide(value: unknown): {
  readonly gameType: 'demo';
  readonly roomCode?: string;
} {
  const params = parseRouteParams(value, 'Demo guide');
  assertExactRouteParamKeys(params, ['gameType', 'roomCode'], 'Demo guide');
  if (params.gameType !== 'demo') throw new Error('Demo guide game mismatch');
  return {
    gameType: 'demo' as const,
    roomCode: params.roomCode === undefined ? undefined : parseRoomCode(params.roomCode),
  };
}

export const demoGameNavigation = defineGameNavigation({
  gameType: 'demo',
  config: { kind: 'screen', parseParams: parseDemoConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});
