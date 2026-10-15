/**
 * 注册完整的Demo客户端：使用共享房间基础设施。
 */

import {
  DEMO_STATE_CODEC,
  type DemoCommand,
  type DemoState,
  getDemoUserSeat,
} from '@game-judge/game-engine/games/demo/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { demoHomeContribution } from './home';
import { demoGameNavigation } from './navigation/demoGameNavigation';
import { DemoRoomScreen } from './room/DemoRoomScreen';
import { DemoConfigScreen } from './screens/DemoConfigScreen';
import { DemoRulesScreen } from './screens/DemoRulesScreen';

export const createDemoUiModule = defineClientGameModule<'demo', DemoState, DemoCommand>({
  gameType: 'demo',
  stateCodec: DEMO_STATE_CODEC,
  home: demoHomeContribution,
  navigation: demoGameNavigation,
  RoomScreen: DemoRoomScreen,
  ConfigScreen: DemoConfigScreen,
  GuideScreen: DemoRulesScreen,
  isUserSeated: (state, userId) => getDemoUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase.kind === 'lobby',
});
