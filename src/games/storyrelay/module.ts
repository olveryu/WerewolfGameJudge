/** Registers the complete text-only Story Relay client using shared room infrastructure. */

import {
  getStoryRelayUserSeat,
  STORY_RELAY_STATE_CODEC,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { storyRelayHomeContribution } from './home';
import { storyRelayGameNavigation } from './navigation/storyRelayGameNavigation';
import { StoryRelayRoomScreen } from './room/StoryRelayRoomScreen';
import { StoryRelayConfigScreen } from './screens/StoryRelayConfigScreen';
import { StoryRelayRulesScreen } from './screens/StoryRelayRulesScreen';

export const createStoryRelayUiModule = defineClientGameModule<
  'storyrelay',
  StoryRelayState,
  StoryRelayCommand
>({
  gameType: 'storyrelay',
  stateCodec: STORY_RELAY_STATE_CODEC,
  home: storyRelayHomeContribution,
  navigation: storyRelayGameNavigation,
  RoomScreen: StoryRelayRoomScreen,
  ConfigScreen: StoryRelayConfigScreen,
  GuideScreen: StoryRelayRulesScreen,
  isUserSeated: (state, userId) => getStoryRelayUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase === 'lobby',
});
