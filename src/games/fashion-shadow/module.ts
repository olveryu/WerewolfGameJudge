// Fashion Shadow client registration over the shared room platform.

import {
  FASHION_PUBLIC_STATE_CODEC,
  type FashionPublicCommand,
  type FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import { createElement } from 'react';

import { bindGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { NO_ROOM_USER_EVENT_CODEC } from '@/features/room/session/noRoomUserEventCodec';
import { fashionHomeContribution } from '@/games/fashion-shadow/home';
import type { FashionRoomSession } from '@/games/fashion-shadow/model/FashionRoomSession';
import { fashionGameNavigation } from '@/games/fashion-shadow/navigation/fashionGameNavigation';
import { fashionProductUi } from '@/games/fashion-shadow/productUi';
import { createFashionRoomAccountCapability } from '@/games/fashion-shadow/profile/createFashionRoomAccountCapability';
import { FashionRoomScreen } from '@/games/fashion-shadow/room/FashionRoomScreen';
import { FashionConfigScreen } from '@/games/fashion-shadow/screens/ConfigScreen/FashionConfigScreen';
import { FashionRulesScreen } from '@/games/fashion-shadow/screens/RulesScreen/FashionRulesScreen';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';

interface CreateFashionUiModuleDeps {
  readonly sessionFactory: GameSessionFactory;
}

const EmptyFashionAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;

export function createFashionUiModule({ sessionFactory }: CreateFashionUiModuleDeps) {
  const roomSession: FashionRoomSession = sessionFactory.create<
    FashionPublicState,
    FashionPublicCommand,
    never
  >({
    stateCodec: FASHION_PUBLIC_STATE_CODEC,
    userEventCodec: NO_ROOM_USER_EVENT_CODEC,
  });
  const roomAccount = createFashionRoomAccountCapability(roomSession);

  function BoundFashionRoomScreen(props: GameRoomScreenProps<'fashion-shadow'>) {
    return createElement(FashionRoomScreen, { ...props, session: roomSession });
  }

  return {
    gameType: 'fashion-shadow',
    home: fashionHomeContribution,
    navigation: bindGameNavigation(fashionGameNavigation, {
      config: FashionConfigScreen,
      guide: FashionRulesScreen,
    }),
    roomScreen: BoundFashionRoomScreen,
    roomAccount,
    productUi: fashionProductUi,
    audioPreview: null,
    accountStatsSection: EmptyFashionAccountStatsSection,
    appOverlay: null,
  } satisfies ClientGameModule<'fashion-shadow'>;
}
