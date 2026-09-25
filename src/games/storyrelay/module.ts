/** Registers the complete text-only Story Relay client using shared room infrastructure. */

import {
  STORY_RELAY_STATE_CODEC,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { createElement } from 'react';

import { bindGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { createSessionRoomAccountCapability } from '@/features/room/session/SessionRoomAccountCapability';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';

import { storyRelayHomeContribution } from './home';
import { getStoryRelayUserSeat } from './model/StoryRelayRoomSession';
import { storyRelayGameNavigation } from './navigation/storyRelayGameNavigation';
import { StoryRelayRoomScreen } from './room/StoryRelayRoomScreen';
import { StoryRelayConfigScreen } from './screens/StoryRelayConfigScreen';
import { StoryRelayRulesScreen } from './screens/StoryRelayRulesScreen';

const EmptyStoryRelayAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;

/** Creates one session and binds configuration, room UI and account membership to it. */
export function createStoryRelayUiModule({
  sessionFactory,
}: {
  readonly sessionFactory: GameSessionFactory;
}) {
  const session = sessionFactory.create<StoryRelayState, StoryRelayCommand>({
    stateCodec: STORY_RELAY_STATE_CODEC,
  });
  const roomAccount = createSessionRoomAccountCapability<'storyrelay', StoryRelayState>({
    gameType: 'storyrelay',
    session,
    isUserSeated: (state, userId) => getStoryRelayUserSeat(state, userId) !== null,
    canSwitchAccount: (state) => state.phase === 'lobby',
  });
  function BoundStoryRelayRoomScreen(props: GameRoomScreenProps<'storyrelay'>) {
    return createElement(StoryRelayRoomScreen, { ...props, session });
  }
  function BoundStoryRelayConfigScreen() {
    return createElement(StoryRelayConfigScreen, { session });
  }
  return {
    gameType: 'storyrelay',
    home: storyRelayHomeContribution,
    navigation: bindGameNavigation(storyRelayGameNavigation, {
      config: BoundStoryRelayConfigScreen,
      guide: StoryRelayRulesScreen,
    }),
    roomScreen: BoundStoryRelayRoomScreen,
    roomAccount,
    productUi: { getAvatarDisplayName: () => null, getRevealEffectPresentation: () => null },
    audioPreview: null,
    accountStatsSection: EmptyStoryRelayAccountStatsSection,
    appOverlay: null,
  } satisfies ClientGameModule<'storyrelay'>;
}
