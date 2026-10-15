/** FibKing client registration over the shared session, navigation, and room shell. */

import {
  FIB_STATE_CODEC,
  type FibPublicCommand,
  type FibState,
  getFibUserSeat,
} from '@game-judge/game-engine/games/fibking/public';

import { fibHomeContribution } from '@/games/fibking/home';
import { fibGameNavigation } from '@/games/fibking/navigation/fibGameNavigation';
import { FibRoomScreen } from '@/games/fibking/room/FibRoomScreen';
import { FibConfigScreen } from '@/games/fibking/screens/ConfigScreen/FibConfigScreen';
import { FibRulesScreen } from '@/games/fibking/screens/RulesScreen/FibRulesScreen';
import { defineClientGameModule } from '@/games/model/defineClientGameModule';

export const createFibUiModule = defineClientGameModule<'fibking', FibState, FibPublicCommand>({
  gameType: 'fibking',
  stateCodec: FIB_STATE_CODEC,
  home: fibHomeContribution,
  navigation: fibGameNavigation,
  RoomScreen: FibRoomScreen,
  ConfigScreen: FibConfigScreen,
  GuideScreen: FibRulesScreen,
  isUserSeated: (state, userId) => getFibUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase === 'lobby',
});
