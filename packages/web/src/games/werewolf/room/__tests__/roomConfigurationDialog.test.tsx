import { within } from '@testing-library/react';

import { TESTIDS } from '@/testids';

import { actorStep, cancelSeatSelection, click, mountRoomFor, startSeatSelection } from './harness';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

describe('Werewolf room configuration', () => {
  it('opens the read-only board from the action area and keeps it under role details', async () => {
    const view = await mountRoomFor(actorStep('seerCheck', 'seer', 0));
    const bottom = within(view.getByTestId(TESTIDS.bottomActionPanel));
    const entry = bottom.getByRole('button', { name: '本局配置' });
    expect(view.queryByRole('button', { name: '展开配置' })).not.toBeInTheDocument();

    await click(entry);
    const board = within(await view.findByRole('dialog', { name: '本局配置' }));
    await click(board.getByRole('button', { name: '预言家' }));
    const role = within(await view.findByRole('dialog', { name: '预言家' }));
    await click(role.getByRole('button', { name: '知道了' }));

    expect(board.getByRole('button', { name: '预言家' })).toBeVisible();
    expect(board.queryByRole('button', { name: /建议/ })).not.toBeInTheDocument();
    await click(board.getByRole('button', { name: '关闭详情' }));
    expect(view.queryByRole('dialog', { name: '本局配置' })).not.toBeInTheDocument();
  });

  it('keeps the existing selection panel free of the configuration entry', async () => {
    const view = await mountRoomFor(actorStep('seerCheck', 'seer', 0));
    const hand = within(view.getByRole('group', { name: '行动手牌' }));
    expect(hand.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '选择查验目标',
      '不用技能',
      '查看身份',
      '本局配置',
    ]);
    await startSeatSelection(view);
    expect(view.queryByRole('group', { name: '行动手牌' })).not.toBeInTheDocument();
    expect(view.queryByRole('button', { name: '本局配置' })).not.toBeInTheDocument();
    await cancelSeatSelection(view);
    expect(view.getByRole('button', { name: '本局配置' })).toBeVisible();
  });
});
