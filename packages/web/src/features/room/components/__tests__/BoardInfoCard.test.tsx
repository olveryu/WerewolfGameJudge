import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BoardInfoCard } from '../BoardInfoCard';

describe('BoardInfoCard', () => {
  it('places the collapse control after the independent actions and toggles from either control', async () => {
    const onStrategyPress = vi.fn();
    const onNotepadPress = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <BoardInfoCard
        playerCount={9}
        sections={[
          {
            title: '神职',
            color: 'var(--color-god)',
            items: [{ roleId: 'seer', displayName: '预言家', count: 1 }],
          },
        ]}
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

    expect(screen.getByRole('button', { name: '预言家' })).toBeInTheDocument();
    expect(screen.getByText('›')).toBeInTheDocument();
    expect(container.querySelector('.board-info-footer')).toBeNull();

    await user.click(screen.getByRole('button', { name: '攻略' }));
    await user.click(screen.getByRole('button', { name: '笔记' }));
    expect(onStrategyPress).toHaveBeenCalledOnce();
    expect(onNotepadPress).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: '收起配置' }));
    expect(screen.queryByRole('button', { name: '预言家' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '配置（9人）' }));
    expect(screen.getByRole('button', { name: '收起配置' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: '预言家' })).toBeInTheDocument();
  });
});
