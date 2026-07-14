/** Werewolf client runtime registration. */

import {
  WEREWOLF_STATE_CODEC,
  type WerewolfPublicCommand,
} from '@werewolf/game-engine/games/werewolf/public';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { type ComponentType, createElement } from 'react';

import type { GameRoomScreenProps, GameUiModule } from '@/features/room/model/GameUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { WerewolfAccountStatsSection } from '@/games/werewolf/components/WerewolfAccountStatsSection';
import { WerewolfAppOverlay } from '@/games/werewolf/components/WerewolfAppOverlay';
import {
  WEREWOLF_USER_EVENT_CODEC,
  type WerewolfUserEvent,
} from '@/games/werewolf/realtime/werewolfUserEventCodec';
import { WerewolfRoomScreen } from '@/games/werewolf/room/WerewolfRoomScreen';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { WerewolfGameFacade } from '@/games/werewolf/runtime/WerewolfGameFacade';
import { BoardPickerScreen } from '@/games/werewolf/screens/BoardPickerScreen/BoardPickerScreen';
import { ConfigScreen } from '@/games/werewolf/screens/ConfigScreen/ConfigScreen';
import { EncyclopediaScreen } from '@/games/werewolf/screens/EncyclopediaScreen/EncyclopediaScreen';
import { GameRulesScreen } from '@/games/werewolf/screens/GameRulesScreen/GameRulesScreen';
import { NotepadScreen } from '@/games/werewolf/screens/NotepadScreen/NotepadScreen';
import type { AudioService } from '@/services/infra/AudioService';

export interface WerewolfUiModule extends GameUiModule<'werewolf'> {
  readonly client: WerewolfGameClient;
  readonly screens: {
    readonly boardPicker: ComponentType;
    readonly config: ComponentType;
    readonly encyclopedia: ComponentType;
    readonly rules: ComponentType;
    readonly notepad: ComponentType;
  };
}

interface CreateWerewolfUiModuleDeps {
  readonly sessionFactory: GameSessionFactory;
  readonly audioService: AudioService;
}

export function createWerewolfUiModule({
  sessionFactory,
  audioService,
}: CreateWerewolfUiModuleDeps): WerewolfUiModule {
  const roomSession = sessionFactory.create<GameState, WerewolfPublicCommand, WerewolfUserEvent>({
    stateCodec: WEREWOLF_STATE_CODEC,
    userEventCodec: WEREWOLF_USER_EVENT_CODEC,
  });
  const client = new WerewolfGameFacade({ roomSession, audioService });

  function BoundWerewolfRoomScreen(props: GameRoomScreenProps) {
    return createElement(WerewolfRoomScreen, { ...props, client });
  }

  function BoundWerewolfAppOverlay() {
    return createElement(WerewolfAppOverlay, { client });
  }

  function BoundWerewolfConfigScreen() {
    return createElement(ConfigScreen, { client });
  }

  function BoundWerewolfNotepadScreen() {
    return createElement(NotepadScreen, { client });
  }

  return {
    gameType: 'werewolf',
    client,
    roomScreen: BoundWerewolfRoomScreen,
    accountStatsSection: WerewolfAccountStatsSection,
    appOverlay: BoundWerewolfAppOverlay,
    screens: {
      boardPicker: BoardPickerScreen,
      config: BoundWerewolfConfigScreen,
      encyclopedia: EncyclopediaScreen,
      rules: GameRulesScreen,
      notepad: BoundWerewolfNotepadScreen,
    },
  };
}
