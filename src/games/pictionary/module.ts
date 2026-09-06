/** Pictionary client registration over shared session, navigation, and room infrastructure. */

import {
  PICTIONARY_STATE_CODEC,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { createElement } from 'react';

import { bindGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { NO_ROOM_USER_EVENT_CODEC } from '@/features/room/session/noRoomUserEventCodec';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';
import { pictionaryHomeContribution } from '@/games/pictionary/home';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { pictionaryGameNavigation } from '@/games/pictionary/navigation/pictionaryGameNavigation';
import { pictionaryProductUi } from '@/games/pictionary/productUi';
import { createPictionaryRoomAccountCapability } from '@/games/pictionary/profile/createPictionaryRoomAccountCapability';
import { PictionaryRoomScreen } from '@/games/pictionary/room/PictionaryRoomScreen';
import { PictionaryConfigScreen } from '@/games/pictionary/screens/ConfigScreen/PictionaryConfigScreen';
import { PictionaryRulesScreen } from '@/games/pictionary/screens/RulesScreen/PictionaryRulesScreen';

interface CreatePictionaryUiModuleDeps {
  readonly sessionFactory: GameSessionFactory;
}

const EmptyPictionaryAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;

export function createPictionaryUiModule({ sessionFactory }: CreatePictionaryUiModuleDeps) {
  const roomSession: PictionaryRoomSession = sessionFactory.create<
    PictionaryState,
    PictionaryPublicCommand,
    never
  >({ stateCodec: PICTIONARY_STATE_CODEC, userEventCodec: NO_ROOM_USER_EVENT_CODEC });
  const roomAccount = createPictionaryRoomAccountCapability(roomSession);
  function BoundPictionaryRoomScreen(props: GameRoomScreenProps<'pictionary'>) {
    return createElement(PictionaryRoomScreen, { ...props, session: roomSession });
  }
  function BoundPictionaryConfigScreen() {
    return createElement(PictionaryConfigScreen, { session: roomSession });
  }
  return {
    gameType: 'pictionary',
    home: pictionaryHomeContribution,
    navigation: bindGameNavigation(pictionaryGameNavigation, {
      config: BoundPictionaryConfigScreen,
      guide: PictionaryRulesScreen,
    }),
    roomScreen: BoundPictionaryRoomScreen,
    roomAccount,
    productUi: pictionaryProductUi,
    audioPreview: null,
    accountStatsSection: EmptyPictionaryAccountStatsSection,
    appOverlay: null,
  } satisfies ClientGameModule<'pictionary'>;
}
