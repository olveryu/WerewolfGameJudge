/** Pictionary client registration over shared session, navigation, and room infrastructure. */

import {
  getPictionaryUserSeat,
  PICTIONARY_CONFIG_SCHEMA,
  PICTIONARY_STATE_CODEC,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import {
  parsePictionaryConfigRouteParams,
  pictionaryGameNavigation,
} from './navigation/pictionaryGameNavigation';
import { pictionaryReview } from './review/pictionaryReview';
import { getPictionaryRoomCommandFailureMessage } from './room/pictionaryRoomCommandFailureMessage';
import { PictionaryRoomScreen } from './room/PictionaryRoomScreen';
import { PictionaryRulesScreen } from './screens/PictionaryRulesScreen';

export const createPictionaryClientModule = defineClientGameModule<
  'pictionary',
  PictionaryState,
  PictionaryPublicCommand
>({
  gameType: 'pictionary',
  displayName: '你画我猜接龙',
  stateCodec: PICTIONARY_STATE_CODEC,
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
  review: pictionaryReview,
  isUserSeated: (state, userId) => getPictionaryUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase === 'lobby',
});
