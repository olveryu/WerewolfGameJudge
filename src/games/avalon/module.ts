/**
 * 注册完整的阿瓦隆客户端：使用共享房间基础设施。
 */

import {
  AVALON_CONFIG_SCHEMA,
  AVALON_STATE_CODEC,
  type AvalonPublicCommand,
  type AvalonState,
  getAvalonUserSeat,
} from '@game-judge/game-engine/games/avalon/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { AvalonAudioPlayer } from './audio/AvalonAudioPlayer';
import { avalonHomeContribution } from './home';
import {
  avalonGameNavigation,
  parseAvalonConfigRouteParams,
} from './navigation/avalonGameNavigation';
import { getAvalonRoomCommandFailureMessage } from './room/avalonRoomCommandFailureMessage';
import { AvalonRoomScreen } from './room/AvalonRoomScreen';
import { AvalonBoardPreview } from './screens/AvalonBoardPreview';
import { AvalonGuideScreen } from './screens/AvalonGuideScreen';

export const createAvalonUiModule = defineClientGameModule<
  'avalon',
  AvalonState,
  AvalonPublicCommand,
  AvalonAudioPlayer
>({
  gameType: 'avalon',
  stateCodec: AVALON_STATE_CODEC,
  home: avalonHomeContribution,
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
  isUserSeated: (state, userId) => getAvalonUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase.kind === 'lobby',
  audio: {
    create: (audioService) => new AvalonAudioPlayer(audioService),
    preview: (audio) => ({
      label: '试听效果',
      play: () => audio.playEffect('night'),
      stop: audio.stopNarration,
    }),
  },
});
