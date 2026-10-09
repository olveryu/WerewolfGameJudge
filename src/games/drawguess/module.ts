/**
 * 注册完整的你画我猜客户端：使用共享房间基础设施。
 */

import {
  DRAWGUESS_STATE_CODEC,
  type DrawGuessCommand,
  type DrawGuessState,
  getDrawGuessUserSeat,
} from '@game-judge/game-engine/games/drawguess/public';
import { createElement } from 'react';

import { bindGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { createSessionRoomAccountCapability } from '@/features/room/session/SessionRoomAccountCapability';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';

import { drawGuessHomeContribution } from './home';
import { drawGuessGameNavigation } from './navigation/drawGuessGameNavigation';
import { DrawGuessRoomScreen } from './room/DrawGuessRoomScreen';
import { DrawGuessConfigScreen } from './screens/DrawGuessConfigScreen';
import { DrawGuessRulesScreen } from './screens/DrawGuessRulesScreen';

const EmptyDrawGuessAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;

/** 创建一个 session，把配置、房间 UI 与账号归属绑定到它上面。 */
export function createDrawGuessUiModule({
  sessionFactory,
}: {
  readonly sessionFactory: GameSessionFactory;
}) {
  const session = sessionFactory.create<DrawGuessState, DrawGuessCommand>({
    stateCodec: DRAWGUESS_STATE_CODEC,
  });
  const roomAccount = createSessionRoomAccountCapability<'drawguess', DrawGuessState>({
    gameType: 'drawguess',
    session,
    isUserSeated: (state, userId) => getDrawGuessUserSeat(state, userId) !== null,
    canSwitchAccount: (state) => state.phase.kind === 'lobby',
  });
  function BoundDrawGuessRoomScreen(props: GameRoomScreenProps<'drawguess'>) {
    return createElement(DrawGuessRoomScreen, { ...props, session });
  }
  function BoundDrawGuessConfigScreen() {
    return createElement(DrawGuessConfigScreen, { session });
  }
  return {
    gameType: 'drawguess',
    home: drawGuessHomeContribution,
    navigation: bindGameNavigation(drawGuessGameNavigation, {
      config: BoundDrawGuessConfigScreen,
      guide: DrawGuessRulesScreen,
    }),
    roomScreen: BoundDrawGuessRoomScreen,
    roomAccount,
    productUi: { getAvatarDisplayName: () => null, getRevealEffectPresentation: () => null },
    audioPreview: null,
    accountStatsSection: EmptyDrawGuessAccountStatsSection,
    appOverlay: null,
  } satisfies ClientGameModule<'drawguess'>;
}
