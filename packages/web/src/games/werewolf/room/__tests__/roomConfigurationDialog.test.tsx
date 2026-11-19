import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TESTIDS } from '@/testids';

import { actorStep, cancelSeatSelection, click, mountRoomFor, startSeatSelection } from './harness';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

describe('Werewolf room configuration', () => {
  it.each([GameStatus.Day, GameStatus.Ended])(
    'saves notes when the %s dialog closes',
    async (status) => {
      const view = await mountRoomFor({
        ...actorStep('seerCheck', 'seer', 0),
        gameStateOverrides: { status },
      });
      await click(view.getByRole('button', { name: '手册' }));
      await click(view.getByRole('button', { name: '笔记' }));
      const dialog = within(await view.findByRole('dialog', { name: '笔记' }));
      const notes = dialog.getByRole('textbox', { name: '投票记录' });
      const user = userEvent.setup();
      await user.clear(notes);
      await user.type(notes, '2号投给3号');
      await click(dialog.getByRole('button', { name: '关闭详情' }));
      await click(view.getByRole('button', { name: '笔记' }));
      expect(
        within(await view.findByRole('dialog', { name: '笔记' })).getByRole('textbox', {
          name: '投票记录',
        }),
      ).toHaveValue('2号投给3号');
    },
  );

  it('reads the shared encyclopedia in the room and returns to the manual', async () => {
    const view = await mountRoomFor(actorStep('seerCheck', 'seer', 0));
    await click(view.getByRole('button', { name: '手册' }));
    expect(view.queryByRole('button', { name: '笔记' })).not.toBeInTheDocument();
    await click(view.getByTestId(TESTIDS.roomEncyclopediaButton));
    const dialog = within(await view.findByRole('dialog', { name: '狼人杀玩法' }));
    expect(dialog.getByText('胜负目标')).toBeVisible();
    expect(dialog.getByRole('tab', { name: /角色/ })).toBeVisible();
    await click(dialog.getByRole('button', { name: '关闭详情' }));
    expect(view.getByRole('group', { name: '手册' })).toBeVisible();
    expect(view.getByTestId(TESTIDS.roomScreenRoot)).toBeVisible();
  });

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
      '手册',
    ]);
    await startSeatSelection(view);
    expect(view.queryByRole('group', { name: '行动手牌' })).not.toBeInTheDocument();
    expect(view.queryByRole('button', { name: '本局配置' })).not.toBeInTheDocument();
    await cancelSeatSelection(view);
    expect(view.getByRole('button', { name: '本局配置' })).toBeVisible();
  });

  it('switches the host and player hands in the same bottom panel', async () => {
    const view = await mountRoomFor({ ...actorStep('seerCheck', 'seer', 0), isHost: true });
    const bottom = within(view.getByTestId(TESTIDS.bottomActionPanel));
    await click(bottom.getByTestId(TESTIDS.roomMoreActionsButton));

    expect(bottom.getByRole('region', { name: '主持管理' })).toBeVisible();
    expect(bottom.queryByRole('button', { name: '本局配置' })).not.toBeInTheDocument();
    const back = bottom.getByRole('button', { name: '返回' });
    expect(back).toHaveFocus();
    await click(back);

    expect(bottom.queryByRole('region', { name: '主持管理' })).not.toBeInTheDocument();
    expect(bottom.getByRole('button', { name: '本局配置' })).toBeVisible();
    expect(bottom.getByTestId(TESTIDS.roomMoreActionsButton)).toHaveFocus();
  });
});
