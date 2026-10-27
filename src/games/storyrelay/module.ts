/** Registers the complete text-only Story Relay client using shared room infrastructure. */

import {
  getStoryRelayUserSeat,
  STORY_RELAY_CONFIG_SCHEMA,
  STORY_RELAY_STATE_CODEC,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';

import { storyRelayHomeContribution } from './home';
import {
  parseStoryRelayConfigRouteParams,
  storyRelayGameNavigation,
} from './navigation/storyRelayGameNavigation';
import { getStoryRelayRoomCommandFailureMessage } from './room/storyRelayRoomCommandFailureMessage';
import { StoryRelayRoomScreen } from './room/StoryRelayRoomScreen';
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
  config: (define) =>
    define({
      schema: STORY_RELAY_CONFIG_SCHEMA,
      parseRouteParams: parseStoryRelayConfigRouteParams,
      readConfig: (state) => (state.phase === 'lobby' ? state.config : null),
      buildUpdateCommand: (config) => ({ type: 'storyrelay.config.update', config }),
      getFailureMessage: getStoryRelayRoomCommandFailureMessage,
      creationLabel: '创建故事接龙房间',
      summary: (config) => `${config.numberOfPlayers} 个故事 · 每人 ${config.numberOfPlayers} 棒`,
    }),
  GuideScreen: StoryRelayRulesScreen,
  isUserSeated: (state, userId) => getStoryRelayUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase === 'lobby',
});
