/** FibKing client module over the shared session, navigation, and room shell. */

import {
  FIB_CONFIG_SCHEMA,
  FIB_STATE_CODEC,
  type FibPublicCommand,
  type FibState,
  getFibUserSeat,
} from '@game-judge/game-engine/games/fibking/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { fibGameNavigation, parseFibConfigRouteParams } from './navigation/fibGameNavigation';
import { fibReview } from './review/fibReview';
import { getFibRoomCommandFailureMessage } from './room/fibRoomCommandFailureMessage';
import { FibRoomScreen } from './room/FibRoomScreen';
import { FibRulesScreen } from './screens/FibRulesScreen';

export const createFibClientModule = defineClientGameModule<'fibking', FibState, FibPublicCommand>({
  gameType: 'fibking',
  displayName: '瞎掰王',
  stateCodec: FIB_STATE_CODEC,
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
  review: fibReview,
  isUserSeated: (state, userId) => getFibUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase === 'lobby',
});
