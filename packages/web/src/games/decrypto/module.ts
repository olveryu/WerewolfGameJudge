/** 解码战 client module, on the shared room infrastructure. */
import {
  DECRYPTO_CONFIG_SCHEMA,
  DECRYPTO_STATE_CODEC,
  type DecryptoCommand,
  type DecryptoState,
  getDecryptoUserSeat,
} from '@game-judge/game-engine/games/decrypto/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import {
  decryptoGameNavigation,
  parseDecryptoConfigRouteParams,
} from './navigation/decryptoGameNavigation';
import { decryptoReview } from './review/decryptoReview';
import { getDecryptoRoomCommandFailureMessage } from './room/decryptoRoomCommandFailureMessage';
import { DecryptoRoomScreen } from './room/DecryptoRoomScreen';
import { DecryptoRulesScreen } from './screens/DecryptoRulesScreen';

export const createDecryptoClientModule = defineClientGameModule<
  'decrypto',
  DecryptoState,
  DecryptoCommand
>({
  gameType: 'decrypto',
  displayName: '解码战',
  stateCodec: DECRYPTO_STATE_CODEC,
  navigation: decryptoGameNavigation,
  RoomScreen: DecryptoRoomScreen,
  config: (define) =>
    define({
      schema: DECRYPTO_CONFIG_SCHEMA,
      parseRouteParams: parseDecryptoConfigRouteParams,
      readConfig: (state) => (state.phase.kind === 'lobby' ? state.config : null),
      buildUpdateCommand: (config) => ({ type: 'decrypto.config.update', config }),
      getFailureMessage: getDecryptoRoomCommandFailureMessage,
      creationLabel: '创建解码战房间',
    }),
  GuideScreen: DecryptoRulesScreen,
  review: decryptoReview,
  isUserSeated: (state, userId) => getDecryptoUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase.kind === 'lobby',
});
