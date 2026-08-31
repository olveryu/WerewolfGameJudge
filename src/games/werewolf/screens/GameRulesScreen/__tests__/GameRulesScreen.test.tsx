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
      rules: { isSheriffElectionEnabled: true },
    },
  }),
}));

describe('GameRulesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the default-enabled sheriff election and returns an explicit false override', () => {
    const screen = render(<GameRulesScreen />);
    const sheriffSwitch = screen.getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled'));

    expect(sheriffSwitch.props.value).toBe(true);
    fireEvent(sheriffSwitch, 'valueChange', false);
    expect(screen.getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled')).props.value).toBe(
      false,
    );

    fireEvent.press(screen.getByText('完成'));
    expect(mockPopTo).toHaveBeenCalledWith('Config', {
      updatedRules: { isSheriffElectionEnabled: false },
    });
  });
});
