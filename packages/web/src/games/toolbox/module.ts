/** 聚会工具 client module, on the shared room infrastructure. */
import {
  TOOLBOX_VIEW_CODEC,
  type ToolboxPublicCommand,
  type ToolboxView,
} from '@game-judge/game-engine/games/toolbox/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { ToolboxConfigScreen } from './config/ToolboxConfigScreen';
import { toolboxGameNavigation } from './navigation/toolboxGameNavigation';
import { toolboxReview } from './review/toolboxReview';
import { ToolboxRoomScreen } from './room/ToolboxRoomScreen';
import { ToolboxGuideScreen } from './screens/ToolboxGuideScreen';

export const createToolboxClientModule = defineClientGameModule<
  'toolbox',
  ToolboxView,
  ToolboxPublicCommand
>({
  gameType: 'toolbox',
  displayName: '聚会工具',
  stateCodec: TOOLBOX_VIEW_CODEC,
  navigation: toolboxGameNavigation,
  RoomScreen: ToolboxRoomScreen,
  // 工具选择与身份编辑超出 schema 表单的表达力，使用游戏自有设置页。
  config: () => ToolboxConfigScreen,
  GuideScreen: ToolboxGuideScreen,
  review: toolboxReview,
  // 账号能力只用于同步座位资料与切换前离座；工具箱无座位命令，入座与参与由视图表达。
  isUserSeated: () => false,
  canSwitchAccount: (view) => view.phase.kind === 'preparing' && !view.phase.isViewerSeated,
});
