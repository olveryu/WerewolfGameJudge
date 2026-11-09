/** Avalon client module: config, guide, room, review and first-night narration on the shared contracts. */

import {
  AVALON_CONFIG_SCHEMA,
  AVALON_STATE_CODEC,
  type AvalonPublicCommand,
  type AvalonState,
  getAvalonUserSeat,
} from '@game-judge/game-engine/games/avalon/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { AvalonAudioPlayer } from './audio/AvalonAudioPlayer';
import {
  avalonGameNavigation,
  parseAvalonConfigRouteParams,
} from './navigation/avalonGameNavigation';
import { avalonReview } from './review/avalonReview';
import { getAvalonRoomCommandFailureMessage } from './room/avalonRoomCommandFailureMessage';
import { AvalonRoomScreen } from './room/AvalonRoomScreen';
import { AvalonBoardPreview } from './screens/AvalonBoardPreview';
import { AvalonGuideScreen } from './screens/AvalonGuideScreen';

export const createAvalonClientModule = defineClientGameModule<
  'avalon',
  AvalonState,
  AvalonPublicCommand,
  AvalonAudioPlayer
>({
  gameType: 'avalon',
  displayName: '阿瓦隆',
  stateCodec: AVALON_STATE_CODEC,
  navigation: avalonGameNavigation,
  RoomScreen: AvalonRoomScreen,
  config: (define) =>
    define({
      schema: AVALON_CONFIG_SCHEMA,
      parseRouteParams: parseAvalonConfigRouteParams,
      readConfig: (state) => (state.phase.kind === 'lobby' ? state.config : null),
      buildUpdateCommand: (config) => ({ type: 'avalon.config.update', config }),
      getFailureMessage: getAvalonRoomCommandFailureMessage,
      creationLabel: '创建阿瓦隆房间',
      Extra: AvalonBoardPreview,
    }),
  GuideScreen: AvalonGuideScreen,
  review: avalonReview,
  isUserSeated: (state, userId) => getAvalonUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase.kind === 'lobby',
  audio: { create: (audioService) => new AvalonAudioPlayer(audioService) },
});
