/** Board role previews use the real cards and preserve each entry's expanded board. */
import { PRESET_TEMPLATES, TemplateCategory } from '@game-judge/game-engine/games/werewolf/public';
import { fireEvent, render, within } from '@testing-library/react-native';

import { askAIAboutRole } from '@/games/werewolf/services/aiChatBridge';
import { isAIChatReady } from '@/games/werewolf/services/AIChatService';

import { BoardPickerScreen } from '../BoardPickerScreen/BoardPickerScreen';
import { BoardsGuideContent } from '../EncyclopediaScreen/BoardsGuideContent';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({}),
  useRoute: () => ({ params: {} }),
}));
jest.mock('@/games/werewolf/services/AIChatService', () => ({
  isAIChatReady: jest.fn(() => false),
}));
jest.mock('@/games/werewolf/services/aiChatBridge', () => ({
  askAIAboutRole: jest.fn(),
}));
jest.mock('@/games/werewolf/components/BoardStrategy', () => ({
  BoardStrategyModal: () => null,
  BOARD_STRATEGY: jest.requireActual<
    typeof import('@/games/werewolf/components/BoardStrategy/boardStrategyData')
  >('@/games/werewolf/components/BoardStrategy/boardStrategyData').BOARD_STRATEGY,
}));

describe.each([
  {
    name: 'board picker',
    renderScreen: () => render(<BoardPickerScreen onExitFlow={jest.fn()} />),
  },
  {
    name: 'boards guide',
    renderScreen: () =>
      render(
        <BoardsGuideContent
          searchVisible={false}
          searchQuery=""
          setSearchQuery={jest.fn()}
          tagFilter={null}
          setTagFilter={jest.fn()}
          tagFilterDropdownVisible={false}
          setTagFilterDropdownVisible={jest.fn()}
        />,
      ),
  },
])('$name role preview', ({ renderScreen }) => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isAIChatReady).mockReturnValue(false);
  });

  it('opens the selected role and preserves the expanded board after closing', () => {
    const template = PRESET_TEMPLATES.find(
      (template) => template.category === TemplateCategory.Classic,
    )!;
    const view = renderScreen();

    fireEvent.press(view.getByText(template.name));
    fireEvent.press(view.getAllByText('预言家')[0]!);

    expect(within(view.getByTestId('role-card-modal')).getByText('预言家')).toBeVisible();
    expect(view.getByText('技能介绍')).toBeVisible();
    expect(view.queryByLabelText('AI 攻略')).toBeNull();
    fireEvent.press(view.getByText('知道了'));

    expect(view.queryByTestId('role-card-modal')).toBeNull();
    expect(view.getByText(/点击角色名查看能力说明/)).toBeVisible();
    fireEvent.press(view.getAllByText('女巫')[0]!);
    expect(within(view.getByTestId('role-card-modal')).getByText('女巫')).toBeVisible();
  });

  it('offers AI guidance for the previewed role when AI is ready', () => {
    jest.mocked(isAIChatReady).mockReturnValue(true);
    const template = PRESET_TEMPLATES.find(
      (template) => template.category === TemplateCategory.Classic,
    )!;
    const view = renderScreen();

    fireEvent.press(view.getByText(template.name));
    fireEvent.press(view.getAllByText('预言家')[0]!);
    fireEvent.press(view.getByLabelText('AI 攻略'));

    expect(askAIAboutRole).toHaveBeenCalledWith('seer', expect.any(Function));
  });
});
