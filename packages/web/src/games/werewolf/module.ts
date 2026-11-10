/** Werewolf client module: session, narration, config flow, guide, notepad, room, review, AI chat. */

import {
  type GameState,
  GameStatus,
  getWerewolfUserSeat,
  WEREWOLF_STATE_CODEC,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { WerewolfAudioPlayer } from './audio/WerewolfAudioPlayer';
import { WerewolfAppOverlay } from './components/WerewolfAppOverlay';
import { WerewolfConfigFlowScreen } from './navigation/WerewolfConfigFlowScreen';
import { werewolfGameNavigation } from './navigation/werewolfGameNavigation';
import { werewolfReview } from './review/werewolfReview';
import { WerewolfRoomScreen } from './room/WerewolfRoomScreen';
import { EncyclopediaScreen } from './screens/EncyclopediaScreen/EncyclopediaScreen';
import { NotepadScreen } from './screens/NotepadScreen/NotepadScreen';

export const createWerewolfClientModule = defineClientGameModule<
  'werewolf',
  GameState,
  WerewolfPublicCommand,
  WerewolfAudioPlayer
>({
  gameType: 'werewolf',
  displayName: '狼人杀',
  stateCodec: WEREWOLF_STATE_CODEC,
  navigation: werewolfGameNavigation,
  RoomScreen: WerewolfRoomScreen,
  // Werewolf's board picker → role config → rules is its own flow, not the schema-driven form.
  config: () => WerewolfConfigFlowScreen,
  GuideScreen: EncyclopediaScreen,
  NotepadScreen,
  AppOverlay: WerewolfAppOverlay,
  review: werewolfReview,
  isUserSeated: (state, userId) => getWerewolfUserSeat(state, userId) !== null,
  canSwitchAccount: (state) =>
    state.status === GameStatus.Unseated || state.status === GameStatus.Seated,
  audio: { create: (audioService) => new WerewolfAudioPlayer(audioService) },
});
