import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BoardInfoContent } from '../BoardInfoContent';
import { RoomGameSummary } from '../RoomGameSummary';

describe('RoomGameSummary', () => {
  it('places public settings after the role composition', () => {
    const { container } = render(
      <RoomGameSummary
        title="测试游戏"
        playerCount={6}
        guide={{ onPress: vi.fn(), label: '查看测试游戏玩法' }}
        settings={[
          { label: '投票方式', value: '公投' },
          { label: '否决上限', value: '5 次' },
        ]}
      >
        <BoardInfoContent
          sections={[
            {
              title: '角色',
              tone: 'god',
              items: [{ roleId: 'seer', displayName: '预言家', count: 1 }],
            },
          ]}
          onRolePress={vi.fn()}
          footer={null}
        />
      </RoomGameSummary>,
    );

    const content = container.querySelector('.room-game-summary-content');
    const roles = screen.getByRole('button', { name: '预言家' });
    const settings = screen.getByText('投票方式').closest('dl');
    expect(content?.firstElementChild).toContainElement(roles);
    expect(content?.lastElementChild).toBe(settings);
    expect(screen.getByText('否决上限')).toBeInTheDocument();
  });

  it('places the collapse control after the independent actions and toggles from either control', async () => {
    const onStrategyPress = vi.fn();
    const onNotepadPress = vi.fn();
    const onGuidePress = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <RoomGameSummary
        title="测试游戏"
        playerCount={9}
        guide={{ onPress: onGuidePress, label: '查看测试游戏玩法' }}
        collapsed={false}
        onStrategyPress={onStrategyPress}
        onNotepadPress={onNotepadPress}
      >
        <BoardInfoContent
          sections={[
            {
              title: '神职',
              tone: 'god',
              items: [{ roleId: 'seer', displayName: '预言家', count: 1 }],
            },
          ]}
          onRolePress={vi.fn()}
          footer={null}
        />
      </RoomGameSummary>,
    );

    const header = container.querySelector<HTMLElement>('.room-game-summary-row');
    expect(header).not.toBeNull();
    if (!header) throw new Error('Missing board header');
    expect(
      within(header)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['测试游戏（9人）', '玩法', '攻略', '笔记', '']);

    expect(screen.getByRole('button', { name: '预言家' })).toBeInTheDocument();
    expect(screen.getByText('›')).toBeInTheDocument();
    expect(container.querySelector('.board-info-footer')).toBeNull();

    await user.click(screen.getByRole('button', { name: '查看测试游戏玩法' }));
    await user.click(screen.getByRole('button', { name: '攻略' }));
    await user.click(screen.getByRole('button', { name: '笔记' }));
    expect(onStrategyPress).toHaveBeenCalledOnce();
    expect(onNotepadPress).toHaveBeenCalledOnce();
    expect(onGuidePress).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '预言家' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '收起配置' }));
    expect(screen.queryByRole('button', { name: '预言家' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '测试游戏（9人）' }));
    expect(screen.getByRole('button', { name: '收起配置' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: '预言家' })).toBeInTheDocument();
  });

  it('gives games without roles the same card and preserves manual collapse across phase defaults', async () => {
    const user = userEvent.setup();
    const guide = { onPress: vi.fn(), label: '查看测试游戏玩法' };
    const { rerender } = render(
      <RoomGameSummary
        title="测试游戏"
        playerCount={6}
        guide={guide}
        settings={[{ label: '每轮时限', value: '60 秒' }]}
        status="4/6 人就座"
      />,
    );
    expect(screen.getByRole('term')).toHaveTextContent('每轮时限');
    expect(screen.getByRole('definition')).toHaveTextContent('60 秒');
    const title = screen.getByRole('button', { name: '测试游戏（6人）' });
    const panelId = title.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '收起配置' }));
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('4/6 人就座');
    rerender(
      <RoomGameSummary
        title="测试游戏"
        playerCount={6}
        guide={guide}
        settings={[{ label: '每轮时限', value: '60 秒' }]}
        status="4/6 人就座"
        collapsed
      />,
    );
    expect(screen.getByRole('button', { name: '展开配置' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await user.tab();
    await user.click(title);
    expect(screen.getByRole('definition')).toHaveTextContent('60 秒');
    expect(screen.getByRole('button', { name: '收起配置' })).toHaveAttribute(
      'aria-controls',
      panelId,
    );
  });

  it('does not offer an empty disclosure when a game has no public settings or roles', () => {
    render(
      <RoomGameSummary
        title="测试游戏"
        playerCount={6}
        guide={{ onPress: vi.fn(), label: '查看测试游戏玩法' }}
      />,
    );
    expect(screen.getByRole('heading', { name: '测试游戏（6人）' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /配置/ })).not.toBeInTheDocument();
  });
});
