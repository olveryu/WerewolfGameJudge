/**
 * Undercover guide copy contract: the spy tiers, the blank minimum, and the
 * blank solo-win survivor count come from the engine rules that decide them.
 */

import {
  UNDERCOVER_BLANK_MIN_PLAYERS,
  UNDERCOVER_BLANK_WIN_TOTAL_SURVIVORS,
  UNDERCOVER_MIN_PLAYERS,
  UNDERCOVER_TIERS,
} from '@game-judge/game-engine/games/undercover/public';
import { render } from '@testing-library/react-native';

import { UndercoverRulesScreen } from '../UndercoverRulesScreen';

describe('UndercoverRulesScreen', () => {
  it('renders the tier table and blank rules from the engine rules', () => {
    const view = render(<UndercoverRulesScreen />);
    let low = UNDERCOVER_MIN_PLAYERS;
    const tierParts: string[] = [];
    for (const tier of UNDERCOVER_TIERS) {
      tierParts.push(`${low} 至 ${tier.maxPlayers} 人配置 ${tier.undercover} 名卧底`);
      low = tier.maxPlayers + 1;
    }
    expect(
      view.getByText(
        `${tierParts.join('，')}。启用白板至少需要 ${UNDERCOVER_BLANK_MIN_PLAYERS} 人，白板替换一名平民。`,
      ),
    ).toBeVisible();
    expect(
      view.getByText(
        `白板存活且场上只剩 ${UNDERCOVER_BLANK_WIN_TOTAL_SURVIVORS} 人时，白板独赢。白板仍在且超过 ${UNDERCOVER_BLANK_WIN_TOTAL_SURVIVORS} 人时，继续游戏。`,
      ),
    ).toBeVisible();
  });
});
