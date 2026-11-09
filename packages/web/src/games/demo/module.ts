/** Demo client module: the reference game, on the shared room infrastructure. */
import {
  DEMO_CONFIG_SCHEMA,
  DEMO_STATE_CODEC,
  type DemoCommand,
  type DemoState,
  getDemoUserSeat,
} from '@game-judge/game-engine/games/demo/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { demoGameNavigation, parseDemoConfigRouteParams } from './navigation/demoGameNavigation';
import { demoReview } from './review/demoReview';
import { getDemoRoomCommandFailureMessage } from './room/demoRoomCommandFailureMessage';
import { DemoRoomScreen } from './room/DemoRoomScreen';
import { DemoRulesScreen } from './screens/DemoRulesScreen';

export const createDemoClientModule = defineClientGameModule<'demo', DemoState, DemoCommand>({
  gameType: 'demo',
  displayName: 'Demo',
  stateCodec: DEMO_STATE_CODEC,
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
  review: demoReview,
  isUserSeated: (state, userId) => getDemoUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase.kind === 'lobby',
});
