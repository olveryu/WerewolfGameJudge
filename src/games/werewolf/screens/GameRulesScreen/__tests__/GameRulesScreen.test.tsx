/** Verifies Werewolf rule controls preserve explicit values through navigation. */

import { fireEvent, render } from '@testing-library/react-native';

import { GameRulesScreen } from '@/games/werewolf/screens/GameRulesScreen/GameRulesScreen';
import { TESTIDS } from '@/testids';

const mockGoBack = jest.fn();
const mockPopTo = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    popTo: mockPopTo,
  }),
  useRoute: () => ({
    params: {
      rules: { isSheriffElectionEnabled: false },
    },
  }),
}));

describe('GameRulesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('only shows mode and role controls while preserving the sheriff election setting', () => {
    const screen = render(<GameRulesScreen />);
    expect(screen.queryByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled'))).toBeNull();
    expect(screen.getByTestId(TESTIDS.gameRuleSwitch('isPlagueMode')).props.value).toBe(false);
    fireEvent(screen.getByTestId(TESTIDS.gameRuleSwitch('witchCanSelfHeal')), 'valueChange', true);

    fireEvent.press(screen.getByText('完成'));
    expect(mockPopTo).toHaveBeenCalledWith('Config', {
      updatedRules: { isSheriffElectionEnabled: false, witchCanSelfHeal: true },
    });
  });
});
