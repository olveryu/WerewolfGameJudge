/** Pictionary client registration over shared session, navigation, and room infrastructure. */

import {
  getPictionaryUserSeat,
  PICTIONARY_CONFIG_SCHEMA,
  PICTIONARY_STATE_CODEC,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';
import { pictionaryHomeContribution } from '@/games/pictionary/home';
import {
  parsePictionaryConfigRouteParams,
  pictionaryGameNavigation,
} from '@/games/pictionary/navigation/pictionaryGameNavigation';
import { getPictionaryRoomCommandFailureMessage } from '@/games/pictionary/room/pictionaryRoomCommandFailureMessage';
import { PictionaryRoomScreen } from '@/games/pictionary/room/PictionaryRoomScreen';
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
  config: (define) =>
    define({
      schema: PICTIONARY_CONFIG_SCHEMA,
      parseRouteParams: parsePictionaryConfigRouteParams,
      readConfig: (state) => (state.phase === 'lobby' ? state.config : null),
      buildUpdateCommand: (config) => ({ type: 'pictionary.config.update', config }),
      getFailureMessage: getPictionaryRoomCommandFailureMessage,
      creationLabel: '创建你画我猜接龙房间',
    }),
  GuideScreen: PictionaryRulesScreen,
  isUserSeated: (state, userId) => getPictionaryUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase === 'lobby',
});
