import { fireEvent, render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import type { ClientGameModeOption } from '@/games/home';
import type { GamePickerPurpose } from '@/navigation/types';
import { GamePickerScreen } from '@/screens/GamePickerScreen/GamePickerScreen';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';
import { lighten } from '@/theme/colorUtils';

const mainOption: ClientGameModeOption = {
  gameType: 'werewolf',
  displayName: '狼人杀',
  subtitle: '经典身份推理',
  iconName: 'moon-outline',
  tier: 'main',
  gradient: [colors.primaryLight, colors.primary],
};

const miniOption: ClientGameModeOption = {
  gameType: 'fibking',
  displayName: '瞎掰王',
  subtitle: '看词描述，真假难辨',
  iconName: 'bulb-outline',
  tier: 'mini',
  gradient: [lighten(colors.warning, 0.55), colors.warning],
};

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const navigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown as ComponentProps<typeof GamePickerScreen>['navigation'];

const mockClientGameHome: {
  modeOptions: readonly ClientGameModeOption[];
  guideOptions: readonly ClientGameModeOption[];
} = {
  modeOptions: [mainOption, miniOption],
  guideOptions: [mainOption, miniOption],
};

jest.mock('@/games/ClientGameCatalogContext', () => ({
  useClientGameHome: () => ({
    modeOptions: mockClientGameHome.modeOptions,
    guideOptions: mockClientGameHome.guideOptions,
    spotlights: [],
    announcementTabs: [],
  }),
}));

function renderScreen(purpose: GamePickerPurpose) {
  return render(
    <GamePickerScreen
      navigation={navigation}
      route={{ key: 'game-picker', name: 'GamePicker', params: { purpose } }}
    />,
  );
}

describe('GamePickerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientGameHome.modeOptions = [mainOption, miniOption];
    mockClientGameHome.guideOptions = [mainOption, miniOption];
  });

  it('renders the main-tier game as hero and mini-tier games under the 小游戏 section', () => {
    const { getByTestId, getByText } = renderScreen('create');

    expect(getByText('创建游戏')).toBeTruthy();
    expect(getByText('选择本局要创建的游戏')).toBeTruthy();
    expect(getByTestId(TESTIDS.gameModePickerOption('werewolf'))).toBeTruthy();
    expect(getByTestId(TESTIDS.gameModePickerMiniSection)).toBeTruthy();
    expect(getByText('小游戏')).toBeTruthy();
    expect(getByTestId(TESTIDS.gameModePickerOption('fibking'))).toBeTruthy();
  });

  it('navigates to the config host for the pressed option in create purpose', () => {
    const { getByTestId } = renderScreen('create');

    fireEvent.press(getByTestId(TESTIDS.gameModePickerOption('fibking')));

    expect(mockNavigate).toHaveBeenCalledWith('GameConfig', {
      gameType: 'fibking',
      mode: 'create',
    });
  });

  it('navigates to the guide host for the pressed option in guide purpose', () => {
    const { getByTestId, getByText } = renderScreen('guide');

    expect(getByText('选择游戏图鉴')).toBeTruthy();
    expect(getByText('选择要查看的游戏')).toBeTruthy();
    fireEvent.press(getByTestId(TESTIDS.gameModePickerOption('werewolf')));

    expect(mockNavigate).toHaveBeenCalledWith('GameGuide', { gameType: 'werewolf' });
  });

  it('fails fast when no options are provided', () => {
    mockClientGameHome.modeOptions = [];

    expect(() => renderScreen('create')).toThrow(
      '[FAIL-FAST] GamePickerScreen requires at least one option',
    );
  });

  it('fails fast when no main-tier option is provided', () => {
    mockClientGameHome.modeOptions = [miniOption];

    expect(() => renderScreen('create')).toThrow(
      '[FAIL-FAST] GamePickerScreen requires at least one main-tier option',
    );
  });
});
