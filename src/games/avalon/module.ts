/**
 * 注册完整的阿瓦隆客户端：使用共享房间基础设施。
 */

import {
  AVALON_STATE_CODEC,
  type AvalonCommand,
  type AvalonState,
  getAvalonUserSeat,
} from '@game-judge/game-engine/games/avalon/public';
import { createElement } from 'react';

import { bindGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { createSessionRoomAccountCapability } from '@/features/room/session/SessionRoomAccountCapability';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';
import type { AudioService } from '@/services/infra/AudioService';

import { AvalonAudioPlayer } from './audio/AvalonAudioPlayer';
import { AvalonLockGate } from './components/AvalonLockGate';
import { avalonHomeContribution } from './home';
import { avalonGameNavigation } from './navigation/avalonGameNavigation';
import { AvalonRoomScreen } from './room/AvalonRoomScreen';
import { AvalonConfigScreen } from './screens/AvalonConfigScreen';
import { AvalonRulesScreen } from './screens/AvalonRulesScreen';

const EmptyAvalonAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;

/** 创建一个 session，把配置、房间 UI 与账号归属绑定到它上面。 */
export function createAvalonUiModule({
  sessionFactory,
  audioService,
}: {
  readonly sessionFactory: GameSessionFactory;
  readonly audioService: AudioService;
}) {
  const session = sessionFactory.create<AvalonState, AvalonCommand>({
    stateCodec: AVALON_STATE_CODEC,
  });
  const audio = new AvalonAudioPlayer(audioService);
  const roomAccount = createSessionRoomAccountCapability<'avalon', AvalonState>({
    gameType: 'avalon',
    session,
    isUserSeated: (state, userId) => getAvalonUserSeat(state, userId) !== null,
    canSwitchAccount: (state) => state.phase.kind === 'lobby',
  });
  function BoundAvalonRoomScreen(props: GameRoomScreenProps<'avalon'>) {
    return createElement(
      AvalonLockGate,
      null,
      createElement(AvalonRoomScreen, { ...props, session, audio }),
    );
  }
  function BoundAvalonConfigScreen() {
    return createElement(AvalonLockGate, null, createElement(AvalonConfigScreen, { session }));
  }
  return {
    gameType: 'avalon',
    home: avalonHomeContribution,
    navigation: bindGameNavigation(avalonGameNavigation, {
      config: BoundAvalonConfigScreen,
      guide: AvalonRulesScreen,
    }),
    roomScreen: BoundAvalonRoomScreen,
    roomAccount,
    productUi: { getAvatarDisplayName: () => null, getRevealEffectPresentation: () => null },
    audioPreview: {
      label: '试听效果',
      play: () => audio.playEffect('night'),
      stop: audio.stopNarration,
    },
    accountStatsSection: EmptyAvalonAccountStatsSection,
    appOverlay: null,
  } satisfies ClientGameModule<'avalon'>;
}
