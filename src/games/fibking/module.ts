/** FibKing client registration over the shared session, navigation, and room shell. */

import {
  FIB_CONFIG_SCHEMA,
  FIB_STATE_CODEC,
  type FibPublicCommand,
  type FibState,
  getFibUserSeat,
} from '@game-judge/game-engine/games/fibking/public';

import { fibHomeContribution } from '@/games/fibking/home';
import {
  fibGameNavigation,
  parseFibConfigRouteParams,
} from '@/games/fibking/navigation/fibGameNavigation';
import { getFibRoomCommandFailureMessage } from '@/games/fibking/room/fibRoomCommandFailureMessage';
import { FibRoomScreen } from '@/games/fibking/room/FibRoomScreen';
import { FibRulesScreen } from '@/games/fibking/screens/RulesScreen/FibRulesScreen';
import { defineClientGameModule } from '@/games/model/defineClientGameModule';

export const createFibUiModule = defineClientGameModule<'fibking', FibState, FibPublicCommand>({
  gameType: 'fibking',
  stateCodec: FIB_STATE_CODEC,
  home: fibHomeContribution,
  navigation: fibGameNavigation,
  RoomScreen: FibRoomScreen,
  config: (define) =>
    define({
      schema: FIB_CONFIG_SCHEMA,
      parseRouteParams: parseFibConfigRouteParams,
      // FibKing state carries the player count directly instead of a config object.
      readConfig: (state) =>
        state.phase === 'lobby' ? { numberOfPlayers: state.numberOfPlayers } : null,
      buildUpdateCommand: (config) => ({
        type: 'fibking.config.update',
        numberOfPlayers: config.numberOfPlayers,
      }),
      getFailureMessage: getFibRoomCommandFailureMessage,
      creationLabel: '创建瞎掰王房间',
    }),
  GuideScreen: FibRulesScreen,
  isUserSeated: (state, userId) => getFibUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase === 'lobby',
});
