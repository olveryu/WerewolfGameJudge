/**
 * 阿瓦隆路由解析；导航宿主收到校验过的游戏参数。
 */

import { AVALON_ROLES, type AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
  type StandardConfigRouteParams,
} from '@/features/navigation/model/standardRouteParsers';

export type AvalonConfigRouteParams = StandardConfigRouteParams<'avalon'>;

/** 只解析创建或活跃房间的设置编辑路由。 */
export const parseAvalonConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'avalon',
  displayName: 'Avalon',
});

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
export const parseAvalonGuideRouteParams: (value: unknown) => AvalonGuideRouteParams =
  createStandardGuideRouteParser({
    gameType: 'avalon',
    displayName: 'Avalon',
    extraFields: {
      keys: ['roleId'],
      parse: (params) => ({ roleId: parseGuideRoleId(params.roleId) }),
    },
  });

export const avalonGameNavigation = defineGameNavigation({
  gameType: 'avalon',
  config: { kind: 'screen', parseParams: parseAvalonConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseAvalonGuideRouteParams },
  notepad: { kind: 'unsupported' },
});
