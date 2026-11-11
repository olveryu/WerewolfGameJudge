import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BoardInfoCard } from '../BoardInfoCard';

describe('BoardInfoCard', () => {
  it('places the collapse control after the independent actions and toggles from either control', async () => {
    const onStrategyPress = vi.fn();
    const onNotepadPress = vi.fn();
    const user = userEvent.setup();
    render(
      <BoardInfoCard
        playerCount={9}
        sections={[]}
        collapsed={false}
        onRolePress={vi.fn()}
        onStrategyPress={onStrategyPress}
        onNotepadPress={onNotepadPress}
        footer={null}
      />,
    );

    const header = screen.getByRole('button', { name: '配置（9人）' }).parentElement;
    expect(header).not.toBeNull();
    if (!header) throw new Error('Missing board header');
    expect(
      within(header)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['配置（9人）', '攻略', '笔记', '']);

    await user.click(screen.getByRole('button', { name: '攻略' }));
    await user.click(screen.getByRole('button', { name: '笔记' }));
    expect(onStrategyPress).toHaveBeenCalledOnce();
    expect(onNotepadPress).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: '收起配置' }));
    expect(screen.queryByText('点击角色名查看说明')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '配置（9人）' }));
    expect(screen.getByRole('button', { name: '收起配置' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
