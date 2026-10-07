/**
 * 阿瓦隆路由解析；导航宿主收到校验过的游戏参数。
 */

import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  assertExactRouteParamKeys,
  parseRouteParams,
} from '@/features/navigation/model/routeParams';

export type AvalonConfigRouteParams =
  | { readonly gameType: 'avalon'; readonly mode: 'create' }
  | { readonly gameType: 'avalon'; readonly mode: 'edit'; readonly roomCode: string };

/** 只解析创建或活跃房间的设置编辑路由。 */
export function parseAvalonConfigRouteParams(value: unknown): AvalonConfigRouteParams {
  const params = parseRouteParams(value, 'Avalon config');
  assertExactRouteParamKeys(params, ['gameType', 'mode', 'roomCode'], 'Avalon config');
  if (params.gameType !== 'avalon') throw new Error('Avalon config game mismatch');
  if (params.mode === 'create' && params.roomCode === undefined)
    return { gameType: 'avalon', mode: 'create' };
  if (params.mode === 'edit')
    return { gameType: 'avalon', mode: 'edit', roomCode: parseRoomCode(params.roomCode) };
  throw new Error('Invalid Avalon config route');
}

function parseGuide(value: unknown): {
  readonly gameType: 'avalon';
  readonly roomCode?: string;
} {
  const params = parseRouteParams(value, 'Avalon guide');
  assertExactRouteParamKeys(params, ['gameType', 'roomCode'], 'Avalon guide');
  if (params.gameType !== 'avalon') throw new Error('Avalon guide game mismatch');
  return {
    gameType: 'avalon' as const,
    roomCode: params.roomCode === undefined ? undefined : parseRoomCode(params.roomCode),
  };
}

export const avalonGameNavigation = defineGameNavigation({
  gameType: 'avalon',
  config: { kind: 'screen', parseParams: parseAvalonConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});
