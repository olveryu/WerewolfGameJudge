/**
 * 注册完整的阿瓦隆客户端：使用共享房间基础设施。
 */

import {
  AVALON_STATE_CODEC,
  type AvalonPublicCommand,
  type AvalonState,
  getAvalonUserSeat,
} from '@game-judge/game-engine/games/avalon/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { AvalonAudioPlayer } from './audio/AvalonAudioPlayer';
import { avalonHomeContribution } from './home';
import { avalonGameNavigation } from './navigation/avalonGameNavigation';
import { AvalonRoomScreen } from './room/AvalonRoomScreen';
import { AvalonConfigScreen } from './screens/AvalonConfigScreen';
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
  ConfigScreen: AvalonConfigScreen,
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
