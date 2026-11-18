/**
 * 秘密希特勒路由解析；导航宿主收到校验过的游戏参数。
 */

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
  type StandardConfigRouteParams,
} from '@/features/navigation/model/standardRouteParsers';

export type SecrethitlerConfigRouteParams = StandardConfigRouteParams<'secrethitler'>;

/** 只解析创建或活跃房间的设置编辑路由。 */
export const parseSecrethitlerConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'secrethitler',
  displayName: 'Secrethitler',
});

const parseGuide = createStandardGuideRouteParser({
  gameType: 'secrethitler',
  displayName: 'Secrethitler',
});

export const secrethitlerGameNavigation = defineGameNavigation({
  gameType: 'secrethitler',
  config: { kind: 'screen', parseParams: parseSecrethitlerConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});
