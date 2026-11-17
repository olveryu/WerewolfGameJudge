/**
 * 一眼成对路由解析；导航宿主收到校验过的游戏参数。
 */

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
  type StandardConfigRouteParams,
} from '@/features/navigation/model/standardRouteParsers';

export type SpotmatchConfigRouteParams = StandardConfigRouteParams<'spotmatch'>;

/** 只解析创建或活跃房间的设置编辑路由。 */
export const parseSpotmatchConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'spotmatch',
  displayName: 'Spotmatch',
});

const parseGuide = createStandardGuideRouteParser({
  gameType: 'spotmatch',
  displayName: 'Spotmatch',
});

export const spotmatchGameNavigation = defineGameNavigation({
  gameType: 'spotmatch',
  config: { kind: 'screen', parseParams: parseSpotmatchConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});
