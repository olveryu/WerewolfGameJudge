/** AvalonGuideScreen（共享图鉴绑定）: 玩法/角色两段切换、角色详情与 roleId 深链直达。 */
import { fireEvent, render } from '@testing-library/react-native';

import { AvalonGuideScreen } from '../AvalonGuideScreen';

const mockRouteParams: { current: unknown } = { current: { gameType: 'avalon' } };

jest.mock('@react-navigation/native', () => {
  const actual: Record<string, unknown> = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      canGoBack: () => false,
      navigate: jest.fn(),
      goBack: jest.fn(),
    }),
    useRoute: () => ({ params: mockRouteParams.current }),
  };
});

describe('AvalonGuideScreen', () => {
  beforeEach(() => {
    mockRouteParams.current = { gameType: 'avalon' };
  });

  it('默认停在玩法段，玩法内容来自迁入的规则说明', () => {
    const screen = render(<AvalonGuideScreen />);
    expect(screen.getByText('阿瓦隆玩法')).toBeTruthy();
    expect(screen.getByText('玩法')).toBeTruthy();
    expect(screen.getByText('角色 · 8')).toBeTruthy();
    expect(screen.getByText('一轮怎么玩')).toBeTruthy();
    expect(screen.queryByTestId('encyclopedia-role-merlin')).toBeNull();
  });

  it('角色段按阵营分组列出 8 个角色，无能力筛选（阿瓦隆无 tags）', () => {
    const screen = render(<AvalonGuideScreen />);
    fireEvent.press(screen.getByText('角色 · 8'));
    // 阵营 tab 与分组标题都显示「阵营 · 人数」，各出现一份以上。
    expect(screen.getAllByText('好人 · 3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('坏人 · 5').length).toBeGreaterThan(0);
    expect(screen.getByTestId('encyclopedia-role-merlin')).toBeTruthy();
    expect(screen.getByTestId('encyclopedia-role-percival')).toBeTruthy();
    expect(screen.getByTestId('encyclopedia-role-loyalServant')).toBeTruthy();
    expect(screen.getByTestId('encyclopedia-role-morgana')).toBeTruthy();
    expect(screen.getByTestId('encyclopedia-role-assassin')).toBeTruthy();
    expect(screen.getByTestId('encyclopedia-role-mordred')).toBeTruthy();
    expect(screen.getByTestId('encyclopedia-role-oberon')).toBeTruthy();
    expect(screen.getByTestId('encyclopedia-role-minion')).toBeTruthy();
    expect(screen.queryByLabelText('能力筛选')).toBeNull();
  });

  it('点角色打开详情，结构化介绍字段来自 avalonRoleMeta，知道了关闭', () => {
    const screen = render(<AvalonGuideScreen />);
    fireEvent.press(screen.getByText('角色 · 8'));
    fireEvent.press(screen.getByTestId('encyclopedia-role-merlin'));
    expect(screen.getByText('晚上能看到所有坏人（莫德雷德除外）。')).toBeTruthy();
    expect(screen.getByText('胜利条件')).toBeTruthy();
    fireEvent.press(screen.getByText('知道了'));
    expect(screen.queryByText('胜利条件')).toBeNull();
  });

  it('搜索按展示名与介绍全文过滤', () => {
    const screen = render(<AvalonGuideScreen />);
    fireEvent.press(screen.getByText('角色 · 8'));
    fireEvent.press(screen.getByLabelText('搜索'));
    fireEvent.changeText(screen.getByPlaceholderText('搜索角色名/技能'), '爪牙');
    expect(screen.getByTestId('encyclopedia-role-minion')).toBeTruthy();
    expect(screen.queryByTestId('encyclopedia-role-merlin')).toBeNull();
  });

  it('roleId 深链直达角色段并打开该角色详情', () => {
    mockRouteParams.current = { gameType: 'avalon', roleId: 'morgana' };
    const screen = render(<AvalonGuideScreen />);
    expect(screen.getByTestId('encyclopedia-role-morgana')).toBeTruthy();
    expect(screen.getByText('在派西维尔眼中伪装成梅林。')).toBeTruthy();
    expect(screen.getByText('知道了')).toBeTruthy();
  });
});
