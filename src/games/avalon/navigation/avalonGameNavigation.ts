/**
 * 阿瓦隆路由解析；导航宿主收到校验过的游戏参数。
 */

import { AVALON_ROLES, type AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';
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

export interface AvalonGuideRouteParams {
  readonly gameType: 'avalon';
  readonly roomCode?: string;
  /** 深链直达角色详情（对齐狼人杀 guide 的 roleId 语义）；缺省为 undefined。 */
  readonly roleId?: AvalonRoleId;
}

function parseGuideRoleId(value: unknown): AvalonRoleId | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error('[FAIL-FAST] Avalon guide role must be a string');
  }
  const roleId = AVALON_ROLES.find((role) => role === value);
  if (roleId === undefined) {
    throw new Error(`[FAIL-FAST] Unknown Avalon guide role: ${value}`);
  }
  return roleId;
}

/** 解析图鉴路由：gameType 必填，roomCode / roleId 可选且严格校验。 */
export function parseAvalonGuideRouteParams(value: unknown): AvalonGuideRouteParams {
  const params = parseRouteParams(value, 'Avalon guide');
  assertExactRouteParamKeys(params, ['gameType', 'roomCode', 'roleId'], 'Avalon guide');
  if (params.gameType !== 'avalon') throw new Error('Avalon guide game mismatch');
  return {
    gameType: 'avalon',
    roomCode: params.roomCode === undefined ? undefined : parseRoomCode(params.roomCode),
    roleId: parseGuideRoleId(params.roleId),
  };
}

export const avalonGameNavigation = defineGameNavigation({
  gameType: 'avalon',
  config: { kind: 'screen', parseParams: parseAvalonConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseAvalonGuideRouteParams },
  notepad: { kind: 'unsupported' },
});
