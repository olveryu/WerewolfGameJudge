/** 聚会工具路由解析；导航宿主收到校验过的游戏参数。 */

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
  type StandardConfigRouteParams,
} from '@/features/navigation/model/standardRouteParsers';

export type ToolboxConfigRouteParams = StandardConfigRouteParams<'toolbox'>;

/** 只解析创建或准备中房间的设置路由。 */
export const parseToolboxConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'toolbox',
  displayName: 'Toolbox',
});

const parseGuide = createStandardGuideRouteParser({ gameType: 'toolbox', displayName: 'Toolbox' });

export const toolboxGameNavigation = defineGameNavigation({
  gameType: 'toolbox',
  config: { kind: 'screen', parseParams: parseToolboxConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});
