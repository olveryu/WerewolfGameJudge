import { fireEvent, render } from '@testing-library/react-native';

import type { ClientGameModeOption } from '@/games/home';
import { GameModePickerModal } from '@/screens/HomeScreen/components/GameModePickerModal';
import { TESTIDS } from '@/testids';

const mainOption: ClientGameModeOption = {
  gameType: 'werewolf',
  displayName: '狼人杀',
  subtitle: '经典身份推理',
  iconName: 'moon-outline',
  tier: 'main',
};

const miniOption: ClientGameModeOption = {
  gameType: 'fibking',
  displayName: '瞎掰王',
  subtitle: '看词描述，真假难辨',
  iconName: 'bulb-outline',
  tier: 'mini',
};

function renderModal(options: readonly ClientGameModeOption[] = [mainOption, miniOption]) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <GameModePickerModal
      visible
      title="创建游戏"
      subtitle="选择本局要创建的游戏"
      options={options}
      onClose={onClose}
      onSelect={onSelect}
    />,
  );
  return { ...utils, onSelect, onClose };
}

describe('GameModePickerModal', () => {
  it('renders the main-tier game as hero and mini-tier games under the 小游戏 section', () => {
    const { getByTestId, getByText } = renderModal();

    expect(getByTestId(TESTIDS.gameModePickerOption('werewolf'))).toBeTruthy();
    expect(getByTestId(TESTIDS.gameModePickerMiniSection)).toBeTruthy();
    expect(getByText('小游戏')).toBeTruthy();
    expect(getByTestId(TESTIDS.gameModePickerOption('fibking'))).toBeTruthy();
  });

  it('calls onSelect with the pressed option', () => {
    const { getByTestId, onSelect } = renderModal();

    fireEvent.press(getByTestId(TESTIDS.gameModePickerOption('fibking')));

    expect(onSelect).toHaveBeenCalledWith(miniOption);
  });

  it('fails fast when no options are provided', () => {
    expect(() => renderModal([])).toThrow(
      '[FAIL-FAST] GameModePickerModal requires at least one option',
    );
  });

  it('fails fast when no main-tier option is provided', () => {
    expect(() => renderModal([miniOption])).toThrow(
      '[FAIL-FAST] GameModePickerModal requires at least one main-tier option',
    );
  });
});
