/**
 * Story Relay guide copy contract: the supported player range and the entry
 * length cap come from the engine constants that decide them.
 */

import {
  STORY_RELAY_MAX_PLAYERS,
  STORY_RELAY_MIN_PLAYERS,
  STORY_RELAY_TEXT_MAX_LENGTH,
} from '@game-judge/game-engine/games/storyrelay/public';
import { render } from '@testing-library/react-native';

import { StoryRelayRulesScreen } from '../StoryRelayRulesScreen';

describe('StoryRelayRulesScreen', () => {
  it('renders the player range and entry length cap from the engine constants', () => {
    const view = render(<StoryRelayRulesScreen />);
    expect(
      view.getByText(
        `支持 ${STORY_RELAY_MIN_PLAYERS} 至 ${STORY_RELAY_MAX_PLAYERS} 人。第一棒自由开头，每段最多 ${STORY_RELAY_TEXT_MAX_LENGTH} 字符。`,
      ),
    ).toBeVisible();
  });
});
