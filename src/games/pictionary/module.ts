/** Pictionary client registration over shared session, navigation, and room infrastructure. */

import {
  getPictionaryUserSeat,
  PICTIONARY_STATE_CODEC,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';
import { pictionaryHomeContribution } from '@/games/pictionary/home';
import { pictionaryGameNavigation } from '@/games/pictionary/navigation/pictionaryGameNavigation';
import { PictionaryRoomScreen } from '@/games/pictionary/room/PictionaryRoomScreen';
import { PictionaryConfigScreen } from '@/games/pictionary/screens/ConfigScreen/PictionaryConfigScreen';
import { PictionaryRulesScreen } from '@/games/pictionary/screens/RulesScreen/PictionaryRulesScreen';

export const createPictionaryUiModule = defineClientGameModule<
  'pictionary',
  PictionaryState,
  PictionaryPublicCommand
>({
  gameType: 'pictionary',
  stateCodec: PICTIONARY_STATE_CODEC,
  home: pictionaryHomeContribution,
  navigation: pictionaryGameNavigation,
  RoomScreen: PictionaryRoomScreen,
  ConfigScreen: PictionaryConfigScreen,
  GuideScreen: PictionaryRulesScreen,
  isUserSeated: (state, userId) => getPictionaryUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase === 'lobby',
});
