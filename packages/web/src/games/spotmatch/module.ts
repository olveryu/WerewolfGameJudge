/** 一眼成对 client module, on the shared room infrastructure. */
import {
  getSpotmatchUserSeat,
  SPOTMATCH_CONFIG_SCHEMA,
  SPOTMATCH_STATE_CODEC,
  type SpotmatchCommand,
  type SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import {
  parseSpotmatchConfigRouteParams,
  spotmatchGameNavigation,
} from './navigation/spotmatchGameNavigation';
import { spotmatchReview } from './review/spotmatchReview';
import { getSpotmatchRoomCommandFailureMessage } from './room/spotmatchRoomCommandFailureMessage';
import { SpotmatchRoomScreen } from './room/SpotmatchRoomScreen';
import { SpotmatchRulesScreen } from './screens/SpotmatchRulesScreen';

export const createSpotmatchClientModule = defineClientGameModule<
  'spotmatch',
  SpotmatchState,
  SpotmatchCommand
>({
  gameType: 'spotmatch',
  displayName: '一眼成对',
  stateCodec: SPOTMATCH_STATE_CODEC,
  navigation: spotmatchGameNavigation,
  RoomScreen: SpotmatchRoomScreen,
  config: (define) =>
    define({
      schema: SPOTMATCH_CONFIG_SCHEMA,
      parseRouteParams: parseSpotmatchConfigRouteParams,
      readConfig: (state) => (state.phase.kind === 'lobby' ? state.config : null),
      buildUpdateCommand: (config) => ({ type: 'spotmatch.config.update', config }),
      getFailureMessage: getSpotmatchRoomCommandFailureMessage,
      creationLabel: '创建一眼成对房间',
    }),
  GuideScreen: SpotmatchRulesScreen,
  review: spotmatchReview,
  isUserSeated: (state, userId) => getSpotmatchUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase.kind === 'lobby',
});
