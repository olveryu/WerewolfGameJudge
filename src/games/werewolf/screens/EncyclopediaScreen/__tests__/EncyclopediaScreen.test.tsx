/** Guide navigation and live public configuration; hidden modes remain host-only. */
import { fireEvent, render } from '@testing-library/react-native';

import type { WerewolfGuideRouteParams } from '@/games/werewolf/navigation/types';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';

import { EncyclopediaScreen } from '../EncyclopediaScreen';

let mockRouteParams: WerewolfGuideRouteParams;
const mockSnapshot = jest.fn<unknown, []>();
const mockGoBack = jest.fn();
const mockClient = { roomSession: {} } as WerewolfGameClient;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('@/features/room/controllers/useRoomSessionSnapshot', () => ({
  useRoomSessionSnapshot: () => mockSnapshot(),
}));
jest.mock('../RolesGuideContent', () => ({ RolesGuideContent: () => null }));
jest.mock('../BoardsGuideContent', () => ({ BoardsGuideContent: () => null }));

describe('EncyclopediaScreen gameplay guide', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { gameType: 'werewolf' };
    mockSnapshot.mockReturnValue({ phase: 'idle' });
  });

  it('opens gameplay by default without catalog tools and preserves tab navigation', () => {
    const view = render(<EncyclopediaScreen client={mockClient} />);
    expect(view.getByRole('tab', { name: '玩法' })).toHaveProp('accessibilityState', {
      selected: true,
    });
    expect(view.getByRole('header', { name: '基本流程' })).toBeVisible();
    expect(view.getByText(/不是整局自动裁判/)).toBeVisible();
    expect(view.queryByText('本局规则')).toBeNull();
    expect(view.queryByLabelText('搜索')).toBeNull();
    expect(view.queryByLabelText('搜索板子')).toBeNull();
    fireEvent.press(view.getByRole('tab', { name: /^角色/ }));
    expect(view.getByLabelText('搜索')).toBeVisible();
    fireEvent.press(view.getByRole('tab', { name: /^板子/ }));
    expect(view.getByLabelText('搜索板子')).toBeVisible();
    fireEvent.press(view.getByRole('button', { name: '返回' }));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('keeps role links on the role tab', () => {
    mockRouteParams = { gameType: 'werewolf', roleId: 'seer' };
    const view = render(<EncyclopediaScreen client={mockClient} />);
    expect(view.getByRole('tab', { name: /^角色/ })).toHaveProp('accessibilityState', {
      selected: true,
    });
  });

  it('honors an explicit board tab', () => {
    mockRouteParams = { gameType: 'werewolf', initialTab: 'boards' };
    const view = render(<EncyclopediaScreen client={mockClient} />);
    expect(view.getByRole('tab', { name: /^板子/ })).toHaveProp('accessibilityState', {
      selected: true,
    });
  });

  it('shows live public rules and only reveals plague mode to the host', () => {
    mockRouteParams = { gameType: 'werewolf', roomCode: '1234' };
    mockSnapshot.mockReturnValue({
      phase: 'ready',
      identity: { room: { roomCode: '1234' }, userId: 'player' },
      snapshot: {
        state: {
          hostUserId: 'host',
          templateRoles: ['wolf', 'witch', 'villager'],
          rules: { witchCanSelfHeal: true, isSheriffElectionEnabled: true, isPlagueMode: true },
        },
      },
    });
    const view = render(<EncyclopediaScreen client={mockClient} />);
    expect(view.getByText('本局板子 · 3 人')).toBeVisible();
    expect(view.getByText('已开启：女巫可以对自己使用解药。')).toBeVisible();
    expect(view.getByText('已开启：首夜结束后进行首日警长竞选。')).toBeVisible();
    expect(view.queryByText('黑死病模式（仅房主可见）')).toBeNull();
    mockSnapshot.mockReturnValue({
      phase: 'ready',
      identity: { room: { roomCode: '1234' }, userId: 'host' },
      snapshot: {
        state: {
          hostUserId: 'host',
          templateRoles: ['wolf', 'witch', 'villager'],
          rules: { witchCanSelfHeal: false, isSheriffElectionEnabled: false, isPlagueMode: true },
        },
      },
    });
    view.rerender(<EncyclopediaScreen client={mockClient} />);
    expect(view.getByText('黑死病模式（仅房主可见）')).toBeVisible();
    expect(view.getByText('未开启：女巫不能对自己使用解药。')).toBeVisible();
    expect(view.getByText('未开启：本局不进行首日警长竞选。')).toBeVisible();
  });

  it('does not substitute another room configuration', () => {
    mockRouteParams = { gameType: 'werewolf', roomCode: '1234' };
    mockSnapshot.mockReturnValue({ phase: 'ready', identity: { room: { roomCode: '5678' } } });
    const view = render(<EncyclopediaScreen client={mockClient} />);
    expect(view.getByText('暂未获取本局配置，请返回房间确认连接后重试。')).toBeVisible();
    expect(view.queryByText('女巫自救')).toBeNull();
  });
});
