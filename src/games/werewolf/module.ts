/** Werewolf client module: session, audio, config flow, guide, notepad, overlay, product UI. */

import {
  type GameState,
  GameStatus,
  getWerewolfUserSeat,
  WEREWOLF_STATE_CODEC,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';
import { WerewolfAudioPlayer } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import { WerewolfAccountStatsSection } from '@/games/werewolf/components/WerewolfAccountStatsSection';
import { WerewolfAppOverlay } from '@/games/werewolf/components/WerewolfAppOverlay';
import { werewolfHomeContribution } from '@/games/werewolf/home';
import { createWerewolfConfigFlowScreen } from '@/games/werewolf/navigation/WerewolfConfigFlowScreen';
import { werewolfGameNavigation } from '@/games/werewolf/navigation/werewolfGameNavigation';
import { werewolfProductUi } from '@/games/werewolf/productUi';
import { WerewolfRoomScreen } from '@/games/werewolf/room/WerewolfRoomScreen';
import { EncyclopediaScreen } from '@/games/werewolf/screens/EncyclopediaScreen/EncyclopediaScreen';
import { NotepadScreen } from '@/games/werewolf/screens/NotepadScreen/NotepadScreen';

export const createWerewolfUiModule = defineClientGameModule<
  'werewolf',
  GameState,
  WerewolfPublicCommand,
  WerewolfAudioPlayer
>({
  gameType: 'werewolf',
  stateCodec: WEREWOLF_STATE_CODEC,
  home: werewolfHomeContribution,
  navigation: werewolfGameNavigation,
  RoomScreen: WerewolfRoomScreen,
  // Werewolf's board picker → role config → rules is its own nested flow,
  // not the schema-driven config screen.
  config: () => createWerewolfConfigFlowScreen(),
  GuideScreen: EncyclopediaScreen,
  isUserSeated: (state, userId) => getWerewolfUserSeat(state, userId) !== null,
  canSwitchAccount: (state) =>
    state.status === GameStatus.Unseated || state.status === GameStatus.Seated,
  audio: {
    create: (audioService) => new WerewolfAudioPlayer(audioService),
    preview: (audio) => ({
      label: '试听效果',
      play: () => audio.playBeginning('wolf'),
      stop: audio.stopNarration,
    }),
  },
  extras: {
    productUi: werewolfProductUi,
    accountStatsSection: WerewolfAccountStatsSection,
    appOverlay: WerewolfAppOverlay,
    navigationScreens: { notepad: NotepadScreen },
  },
});
