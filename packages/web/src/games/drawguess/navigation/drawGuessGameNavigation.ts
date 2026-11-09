/**
 * 你画我猜路由解析；导航宿主收到校验过的游戏参数。
 */

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
  type StandardConfigRouteParams,
} from '@/features/navigation/model/standardRouteParsers';

export type DrawGuessConfigRouteParams = StandardConfigRouteParams<'drawguess'>;

/** 只解析创建或活跃房间的设置编辑路由。 */
export const parseDrawGuessConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'drawguess',
  displayName: 'DrawGuess',
});

const parseGuide = createStandardGuideRouteParser({
  gameType: 'drawguess',
  displayName: 'DrawGuess',
});

export const drawGuessGameNavigation = defineGameNavigation({
  gameType: 'drawguess',
  config: { kind: 'screen', parseParams: parseDrawGuessConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});
