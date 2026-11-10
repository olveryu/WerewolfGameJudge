/**
 * Demo路由解析；导航宿主收到校验过的游戏参数。
 */

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
  type StandardConfigRouteParams,
} from '@/features/navigation/model/standardRouteParsers';

export type DemoConfigRouteParams = StandardConfigRouteParams<'demo'>;

/** 只解析创建或活跃房间的设置编辑路由。 */
export const parseDemoConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'demo',
  displayName: 'Demo',
});

const parseGuide = createStandardGuideRouteParser({
  gameType: 'demo',
  displayName: 'Demo',
});

export const demoGameNavigation = defineGameNavigation({
  gameType: 'demo',
  config: { kind: 'screen', parseParams: parseDemoConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});
