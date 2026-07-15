/** Werewolf client runtime registration. */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import {
  WEREWOLF_STATE_CODEC,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { createElement } from 'react';

import { bindGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { WerewolfAudioPlayer } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import { WerewolfAccountStatsSection } from '@/games/werewolf/components/WerewolfAccountStatsSection';
import { WerewolfAppOverlay } from '@/games/werewolf/components/WerewolfAppOverlay';
import { werewolfHomeContribution } from '@/games/werewolf/home';
import { WerewolfConfigFlowScreen } from '@/games/werewolf/navigation/WerewolfConfigFlowScreen';
import { werewolfGameNavigation } from '@/games/werewolf/navigation/werewolfGameNavigation';
import { werewolfProductUi } from '@/games/werewolf/productUi';
import { WerewolfRoomAccountCapability } from '@/games/werewolf/profile/WerewolfRoomAccountCapability';
import {
  WEREWOLF_USER_EVENT_CODEC,
  type WerewolfUserEvent,
} from '@/games/werewolf/realtime/werewolfUserEventCodec';
import { WerewolfRoomScreen } from '@/games/werewolf/room/WerewolfRoomScreen';
import { WerewolfGameFacade } from '@/games/werewolf/runtime/WerewolfGameFacade';
import { EncyclopediaScreen } from '@/games/werewolf/screens/EncyclopediaScreen/EncyclopediaScreen';
import { NotepadScreen } from '@/games/werewolf/screens/NotepadScreen/NotepadScreen';
import type { AudioService } from '@/services/infra/AudioService';

interface CreateWerewolfUiModuleDeps {
  readonly sessionFactory: GameSessionFactory;
  readonly audioService: AudioService;
}

export function createWerewolfUiModule({
  sessionFactory,
  audioService,
}: CreateWerewolfUiModuleDeps) {
  const roomSession = sessionFactory.create<GameState, WerewolfPublicCommand, WerewolfUserEvent>({
    stateCodec: WEREWOLF_STATE_CODEC,
    userEventCodec: WEREWOLF_USER_EVENT_CODEC,
  });
  const audio = new WerewolfAudioPlayer(audioService);
  const client = new WerewolfGameFacade({ roomSession, audio });
  const roomAccount = new WerewolfRoomAccountCapability(client);

  function BoundWerewolfRoomScreen(props: GameRoomScreenProps) {
    return createElement(WerewolfRoomScreen, { ...props, client });
  }

  function BoundWerewolfAppOverlay() {
    return createElement(WerewolfAppOverlay, { client });
  }

  function BoundWerewolfConfigFlowScreen() {
    return createElement(WerewolfConfigFlowScreen, { client });
  }

  function BoundWerewolfNotepadScreen() {
    return createElement(NotepadScreen, { client });
  }

  return {
    gameType: 'werewolf' as const,
    client,
    home: werewolfHomeContribution,
    navigation: bindGameNavigation(werewolfGameNavigation, {
      config: BoundWerewolfConfigFlowScreen,
      guide: EncyclopediaScreen,
      notepad: BoundWerewolfNotepadScreen,
    }),
    roomScreen: BoundWerewolfRoomScreen,
    roomAccount,
    productUi: werewolfProductUi,
    audioPreview: {
      label: '试听效果',
      play: () => audio.playBeginning('wolf'),
      stop: audio.stopNarration,
    },
    accountStatsSection: WerewolfAccountStatsSection,
    appOverlay: BoundWerewolfAppOverlay,
  };
}
