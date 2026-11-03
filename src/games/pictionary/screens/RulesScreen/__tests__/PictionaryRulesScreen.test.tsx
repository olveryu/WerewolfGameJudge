/**
 * Pictionary guide copy contract: the supported player range comes from the
 * engine constants that decide it.
 */

import {
  PICTIONARY_MAX_PLAYERS,
  PICTIONARY_MIN_PLAYERS,
} from '@game-judge/game-engine/games/pictionary/public';
import { render } from '@testing-library/react-native';

import { PictionaryRulesScreen } from '../PictionaryRulesScreen';

describe('PictionaryRulesScreen', () => {
  it('renders the player range from the engine constants', () => {
    const view = render(<PictionaryRulesScreen />);
    expect(
      view.getByText(
        `一人一道开场题，最后一起看答案。支持 ${PICTIONARY_MIN_PLAYERS} 至 ${PICTIONARY_MAX_PLAYERS} 人，游戏棒数等于玩家人数。时间到时自动收取已写文字和未完成画稿，全部收齐后继续。`,
      ),
    ).toBeVisible();
  });
});
