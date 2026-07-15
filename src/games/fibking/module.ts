/** FibKing client registration over the shared session, navigation, and room shell. */

import {
  FIB_STATE_CODEC,
  type FibPublicCommand,
  type FibState,
} from '@werewolf/game-engine/games/fibking/public';
import { createElement } from 'react';

import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { NO_ROOM_USER_EVENT_CODEC } from '@/features/room/session/noRoomUserEventCodec';
import { fibHomeContribution } from '@/games/fibking/home';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';
import { fibProductUi } from '@/games/fibking/productUi';
import { createFibRoomAccountCapability } from '@/games/fibking/profile/createFibRoomAccountCapability';
import { FibRoomScreen } from '@/games/fibking/room/FibRoomScreen';
import { FibConfigScreen } from '@/games/fibking/screens/ConfigScreen/FibConfigScreen';
import { FibRulesScreen } from '@/games/fibking/screens/RulesScreen/FibRulesScreen';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';

interface CreateFibUiModuleDeps {
  readonly sessionFactory: GameSessionFactory;
}

const EmptyFibAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;

export function createFibUiModule({ sessionFactory }: CreateFibUiModuleDeps) {
  const roomSession: FibRoomSession = sessionFactory.create<FibState, FibPublicCommand, never>({
    stateCodec: FIB_STATE_CODEC,
    userEventCodec: NO_ROOM_USER_EVENT_CODEC,
  });
  const roomAccount = createFibRoomAccountCapability(roomSession);

  function BoundFibRoomScreen(props: GameRoomScreenProps) {
    return createElement(FibRoomScreen, { ...props, session: roomSession });
  }

  function BoundFibConfigScreen() {
    return createElement(FibConfigScreen, { session: roomSession });
  }

  return {
    gameType: 'fibking',
    home: fibHomeContribution,
    navigation: {
      configScreen: BoundFibConfigScreen,
      guideScreen: FibRulesScreen,
      notepadScreen: null,
    },
    roomScreen: BoundFibRoomScreen,
    roomAccount,
    productUi: fibProductUi,
    audioPreview: null,
    accountStatsSection: EmptyFibAccountStatsSection,
    appOverlay: null,
  } satisfies ClientGameModule<'fibking'>;
}
