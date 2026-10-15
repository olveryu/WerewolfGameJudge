/**
 * 注册完整的Demo客户端：使用共享房间基础设施。
 */

import {
  DEMO_STATE_CODEC,
  type DemoCommand,
  type DemoState,
  getDemoUserSeat,
} from '@game-judge/game-engine/games/demo/public';
import { createElement } from 'react';

import { bindGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { createSessionRoomAccountCapability } from '@/features/room/session/SessionRoomAccountCapability';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';

import { demoHomeContribution } from './home';
import { demoGameNavigation } from './navigation/demoGameNavigation';
import { DemoRoomScreen } from './room/DemoRoomScreen';
import { DemoConfigScreen } from './screens/DemoConfigScreen';
import { DemoRulesScreen } from './screens/DemoRulesScreen';

const EmptyDemoAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;

/** 创建一个 session，把配置、房间 UI 与账号归属绑定到它上面。 */
export function createDemoUiModule({
  sessionFactory,
}: {
  readonly sessionFactory: GameSessionFactory;
}) {
  const session = sessionFactory.create<DemoState, DemoCommand>({
    stateCodec: DEMO_STATE_CODEC,
  });
  const roomAccount = createSessionRoomAccountCapability<'demo', DemoState>({
    gameType: 'demo',
    session,
    isUserSeated: (state, userId) => getDemoUserSeat(state, userId) !== null,
    canSwitchAccount: (state) => state.phase.kind === 'lobby',
  });
  function BoundDemoRoomScreen(props: GameRoomScreenProps<'demo'>) {
    return createElement(DemoRoomScreen, { ...props, session });
  }
  function BoundDemoConfigScreen() {
    return createElement(DemoConfigScreen, { session });
  }
  return {
    gameType: 'demo',
    home: demoHomeContribution,
    navigation: bindGameNavigation(demoGameNavigation, {
      config: BoundDemoConfigScreen,
      guide: DemoRulesScreen,
    }),
    roomScreen: BoundDemoRoomScreen,
    roomAccount,
    productUi: { getAvatarDisplayName: () => null, getRevealEffectPresentation: () => null },
    audioPreview: null,
    accountStatsSection: EmptyDemoAccountStatsSection,
    appOverlay: null,
  } satisfies ClientGameModule<'demo'>;
}
