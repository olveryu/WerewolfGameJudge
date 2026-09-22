/** Undercover client plugin over shared navigation, room session, account and shell contracts. */
import {
  UNDERCOVER_STATE_CODEC,
  type UndercoverPublicCommand,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { createElement } from 'react';

import { bindGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { createSessionRoomAccountCapability } from '@/features/room/session/SessionRoomAccountCapability';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';

import { undercoverGameNavigation } from './navigation/undercoverGameNavigation';
import { getUndercoverUserSeat } from './room/undercoverRoomAdapter';
import { UndercoverRoomScreen } from './room/UndercoverRoomScreen';
import { UndercoverConfigScreen } from './screens/UndercoverConfigScreen';
import { UndercoverRulesScreen } from './screens/UndercoverRulesScreen';

const EmptyUndercoverStats = () => null;

export function createUndercoverUiModule({
  sessionFactory,
}: {
  readonly sessionFactory: GameSessionFactory;
}) {
  const session = sessionFactory.create<UndercoverState, UndercoverPublicCommand>({
    stateCodec: UNDERCOVER_STATE_CODEC,
  });
  return {
    gameType: 'undercover',
    home: {
      mode: {
        displayName: '谁是卧底',
        subtitle: '线下指人投票，房主揭晓',
        iconName: 'finger-print-outline',
      },
      spotlight: null,
      announcementTabs: [],
    },
    navigation: bindGameNavigation(undercoverGameNavigation, {
      config: () => createElement(UndercoverConfigScreen, { session }),
      guide: UndercoverRulesScreen,
    }),
    roomScreen: (props: GameRoomScreenProps<'undercover'>) =>
      createElement(UndercoverRoomScreen, { ...props, session }),
    roomAccount: createSessionRoomAccountCapability<'undercover', UndercoverState>({
      gameType: 'undercover',
      session,
      isUserSeated: (state, userId) => getUndercoverUserSeat(state, userId) !== null,
      canSwitchAccount: (state) => state.phase === 'lobby',
    }),
    productUi: { getAvatarDisplayName: () => null, getRevealEffectPresentation: () => null },
    audioPreview: null,
    accountStatsSection: EmptyUndercoverStats,
    appOverlay: null,
  } satisfies ClientGameModule<'undercover'>;
}
