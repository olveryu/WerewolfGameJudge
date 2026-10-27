/**
 * 注册完整的Demo客户端：使用共享房间基础设施。
 */

import {
  DEMO_CONFIG_SCHEMA,
  DEMO_STATE_CODEC,
  type DemoCommand,
  type DemoState,
  getDemoUserSeat,
} from '@game-judge/game-engine/games/demo/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { demoHomeContribution } from './home';
import { demoGameNavigation, parseDemoConfigRouteParams } from './navigation/demoGameNavigation';
import { getDemoRoomCommandFailureMessage } from './room/demoRoomCommandFailureMessage';
import { DemoRoomScreen } from './room/DemoRoomScreen';
import { DemoRulesScreen } from './screens/DemoRulesScreen';

// TODO(gameplay): 玩法配置项（时长、模式等）按设计文档加进引擎 DEMO_CONFIG_SCHEMA。

export const createDemoUiModule = defineClientGameModule<'demo', DemoState, DemoCommand>({
  gameType: 'demo',
  stateCodec: DEMO_STATE_CODEC,
  home: demoHomeContribution,
  navigation: demoGameNavigation,
  RoomScreen: DemoRoomScreen,
  config: (define) =>
    define({
      schema: DEMO_CONFIG_SCHEMA,
      parseRouteParams: parseDemoConfigRouteParams,
      readConfig: (state) => (state.phase.kind === 'lobby' ? state.config : null),
      buildUpdateCommand: (config) => ({ type: 'demo.config.update', config }),
      getFailureMessage: getDemoRoomCommandFailureMessage,
      creationLabel: '创建Demo房间',
    }),
  GuideScreen: DemoRulesScreen,
  isUserSeated: (state, userId) => getDemoUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase.kind === 'lobby',
});
