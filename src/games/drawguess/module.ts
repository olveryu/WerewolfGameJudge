/**
 * 注册完整的你画我猜客户端：使用共享房间基础设施。
 */

import {
  DRAWGUESS_CONFIG_SCHEMA,
  DRAWGUESS_STATE_CODEC,
  type DrawGuessCommand,
  type DrawGuessState,
  getDrawGuessUserSeat,
} from '@game-judge/game-engine/games/drawguess/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { drawGuessHomeContribution } from './home';
import {
  drawGuessGameNavigation,
  parseDrawGuessConfigRouteParams,
} from './navigation/drawGuessGameNavigation';
import { getDrawGuessRoomCommandFailureMessage } from './room/drawGuessRoomCommandFailureMessage';
import { DrawGuessRoomScreen } from './room/DrawGuessRoomScreen';
import { DrawGuessConfigEstimate } from './screens/DrawGuessConfigEstimate';
import { DrawGuessRulesScreen } from './screens/DrawGuessRulesScreen';

export const createDrawGuessUiModule = defineClientGameModule<
  'drawguess',
  DrawGuessState,
  DrawGuessCommand
>({
  gameType: 'drawguess',
  stateCodec: DRAWGUESS_STATE_CODEC,
  home: drawGuessHomeContribution,
  navigation: drawGuessGameNavigation,
  RoomScreen: DrawGuessRoomScreen,
  config: (define) =>
    define({
      schema: DRAWGUESS_CONFIG_SCHEMA,
      parseRouteParams: parseDrawGuessConfigRouteParams,
      readConfig: (state) => (state.phase.kind === 'lobby' ? state.config : null),
      buildUpdateCommand: (config) => ({ type: 'drawguess.config.update', config }),
      getFailureMessage: getDrawGuessRoomCommandFailureMessage,
      creationLabel: '创建你画我猜房间',
      Extra: DrawGuessConfigEstimate,
    }),
  GuideScreen: DrawGuessRulesScreen,
  isUserSeated: (state, userId) => getDrawGuessUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase.kind === 'lobby',
});
