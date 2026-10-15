/**
 * 注册完整的你画我猜客户端：使用共享房间基础设施。
 */

import {
  DRAWGUESS_STATE_CODEC,
  type DrawGuessCommand,
  type DrawGuessState,
  getDrawGuessUserSeat,
} from '@game-judge/game-engine/games/drawguess/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { drawGuessHomeContribution } from './home';
import { drawGuessGameNavigation } from './navigation/drawGuessGameNavigation';
import { DrawGuessRoomScreen } from './room/DrawGuessRoomScreen';
import { DrawGuessConfigScreen } from './screens/DrawGuessConfigScreen';
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
  ConfigScreen: DrawGuessConfigScreen,
  GuideScreen: DrawGuessRulesScreen,
  isUserSeated: (state, userId) => getDrawGuessUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase.kind === 'lobby',
});
