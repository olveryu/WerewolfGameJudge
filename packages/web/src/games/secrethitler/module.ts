/** 秘密希特勒 client module, on the shared room infrastructure. */
import {
  getSecrethitlerUserSeat,
  SECRETHITLER_CONFIG_SCHEMA,
  SECRETHITLER_STATE_CODEC,
  type SecrethitlerCommand,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';

import type { GameConfigDefiner } from '@/features/room/config/createGameConfigScreen';
import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { SecrethitlerAudioPlayer } from './audio/secrethitlerAudioRuntime';
import {
  parseSecrethitlerConfigRouteParams,
  secrethitlerGameNavigation,
} from './navigation/secrethitlerGameNavigation';
import { secrethitlerReview } from './review/secrethitlerReview';
import { getSecrethitlerRoomCommandFailureMessage } from './room/secrethitlerRoomCommandFailureMessage';
import { SecrethitlerRoomScreen } from './room/SecrethitlerRoomScreen';
import { SecrethitlerRulesScreen } from './screens/SecrethitlerRulesScreen';

/** Declares the shared configuration page for this game's room session. */
export const defineSecrethitlerConfig = (
  define: GameConfigDefiner<'secrethitler', SecrethitlerState, SecrethitlerCommand>,
) =>
  define({
    schema: SECRETHITLER_CONFIG_SCHEMA,
    parseRouteParams: parseSecrethitlerConfigRouteParams,
    readConfig: (state) => (state.phase.kind === 'lobby' ? state.config : null),
    buildUpdateCommand: (config) => ({ type: 'secrethitler.config.update', config }),
    getFailureMessage: getSecrethitlerRoomCommandFailureMessage,
    creationLabel: '创建秘密希特勒房间',
  });

export const createSecrethitlerClientModule = defineClientGameModule<
  'secrethitler',
  SecrethitlerState,
  SecrethitlerCommand,
  SecrethitlerAudioPlayer
>({
  gameType: 'secrethitler',
  displayName: '秘密希特勒',
  stateCodec: SECRETHITLER_STATE_CODEC,
  navigation: secrethitlerGameNavigation,
  RoomScreen: SecrethitlerRoomScreen,
  config: defineSecrethitlerConfig,
  GuideScreen: SecrethitlerRulesScreen,
  review: secrethitlerReview,
  isUserSeated: (state, userId) => getSecrethitlerUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase.kind === 'lobby',
  audio: { create: (audioService) => new SecrethitlerAudioPlayer(audioService) },
});
