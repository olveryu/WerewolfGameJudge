import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TESTIDS } from '@/testids';

import {
  actorStep,
  cancelSeatSelection,
  click,
  createReactiveWerewolfRoomMock,
  mountRoomFor,
  mountWerewolfRoom,
  recordAlerts,
  RoomScreenTestHarness,
  startSeatSelection,
} from './harness';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

describe('Werewolf room configuration', () => {
  it.each([
    [GameStatus.Unseated, true],
    [GameStatus.Seated, true],
    [GameStatus.Assigned, true],
    [GameStatus.Ready, true],
    [GameStatus.Ongoing, false],
    [GameStatus.Day, false],
    [GameStatus.Ended, false],
  ] as const)('shows the configuration area only before play in %s', async (status, isPreGame) => {
    const view = await mountRoomFor({
      ...actorStep('seerCheck', 'seer', 0),
      gameStateOverrides: { status },
    });
    expect(view.queryByTestId(TESTIDS.roomGameSummaryTitle) !== null).toBe(isPreGame);
    expect(view.queryByRole('button', { name: '本局配置' }) !== null).toBe(!isPreGame);
    expect(view.queryByTestId(TESTIDS.roomShareButton) !== null).toBe(isPreGame);
  });

  it.each([true, false])(
    'only shows a deferred night result if it is still pending: %s',
    async (stillPending) => {
      const harness = new RoomScreenTestHarness();
      const detach = recordAlerts(harness);
      try {
        const step = actorStep('seerCheck', 'seer', 0);
        const reactive = createReactiveWerewolfRoomMock(step);
        const view = await mountWerewolfRoom(reactive.mock);
        await click(view.getByRole('button', { name: '本局配置' }));
        const board = within(await view.findByRole('dialog', { name: '本局配置' }));
        const pending = {
          seerReveal: { targetSeat: 1, result: '好人' as const },
          gameStateOverrides: {
            pendingRevealAcks: ['seerCheck' as const],
            actions: [
              { schemaId: 'seerCheck' as const, actorSeat: 0, targetSeat: 1, timestamp: 1 },
            ],
          },
        };
        act(() => reactive.simulateStateUpdate(pending));
        expect(harness.hasSeen('seerReveal')).toBe(false);
        if (!stillPending) {
          act(() =>
            reactive.simulateStateUpdate({
              seerReveal: null,
              gameStateOverrides: { status: GameStatus.Day },
            }),
          );
        }
        await click(board.getByRole('button', { name: '关闭详情' }));
        expect(harness.eventsOfType('seerReveal')).toHaveLength(stillPending ? 1 : 0);
        expect(reactive.mock.dispatch).not.toHaveBeenCalled();
      } finally {
        detach();
      }
    },
  );
  it('keeps an edited suggestion draft open and blocks submission after dealing', async () => {
    const reactive = createReactiveWerewolfRoomMock({
      ...actorStep('seerCheck', 'seer', 0),
      gameStateOverrides: { status: GameStatus.Unseated },
    });
    const view = await mountWerewolfRoom(reactive.mock);
    await click(view.getByRole('button', { name: '我来建议' }));
    const editor = within(await view.findByRole('dialog', { name: '我来建议' }));
    await click(editor.getByRole('button', { name: /选择板子/ }));
    const picker = within(await view.findByRole('dialog', { name: '选择板子' }));
    expect(picker.getByRole('button', { name: '搜索' })).toBeVisible();
    await click(picker.getByRole('button', { name: '关闭详情' }));
    await click(editor.getByRole('button', { name: '重置配置' }));
    expect(editor.getByText('已选 0 人')).toBeVisible();
    act(() =>
      reactive.simulateStateUpdate({ gameStateOverrides: { status: GameStatus.Assigned } }),
    );
    expect(editor.getByText('已选 0 人')).toBeVisible();
    expect(editor.getByRole('status')).toHaveTextContent('本局建议已结束');
    expect(editor.getByRole('button', { name: '提交建议' })).toBeDisabled();
    expect(reactive.mock.dispatch).not.toHaveBeenCalled();
  });

  it('keeps an open suggestion list visible but not editable when roles are dealt', async () => {
    const boardNominations = {
      sender: { userId: 'sender', displayName: '测试玩家', roles: ['seer' as const], upvoters: [] },
    };
    const reactive = createReactiveWerewolfRoomMock({
      ...actorStep('seerCheck', 'seer', 0),
      gameStateOverrides: { status: GameStatus.Unseated, boardNominations },
    });
    const view = await mountWerewolfRoom(reactive.mock);
    await click(view.getByRole('button', { name: /查看建议/ }));
    const list = within(await view.findByRole('dialog', { name: /板子建议/ }));
    expect(list.getByRole('button', { name: '点赞' })).toBeEnabled();
    act(() =>
      reactive.simulateStateUpdate({
        gameStateOverrides: { status: GameStatus.Assigned, boardNominations },
      }),
    );
    expect(list.getByRole('status')).toHaveTextContent('本局建议已结束');
    expect(list.getByRole('button', { name: '点赞' })).toBeDisabled();
    await click(list.getByRole('button', { name: '关闭' }));
    expect(view.queryByRole('button', { name: /查看建议/ })).not.toBeInTheDocument();
  });
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
      await click(view.getByRole('button', { name: '手册' }));
      await click(view.getByRole('button', { name: '笔记' }));
      expect(
        within(await view.findByRole('dialog', { name: '笔记' })).getByRole('textbox', {
          name: '投票记录',
        }),
      ).toHaveValue('2号投给3号');
    },
  );

  it('reads the shared encyclopedia in the room and returns to the main hand', async () => {
    const view = await mountRoomFor(actorStep('seerCheck', 'seer', 0));
    await click(view.getByRole('button', { name: '手册' }));
    expect(view.queryByRole('button', { name: '笔记' })).not.toBeInTheDocument();
    await click(view.getByTestId(TESTIDS.roomEncyclopediaButton));
    const dialog = within(await view.findByRole('dialog', { name: '狼人杀玩法' }));
    expect(dialog.getByText('胜负目标')).toBeVisible();
    expect(dialog.getByRole('tab', { name: /角色/ })).toBeVisible();
    await click(dialog.getByRole('button', { name: '关闭详情' }));
    expect(view.getByRole('group', { name: '行动手牌' })).toBeVisible();
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
    expect(hand.getByRole('button', { name: '预言家行动' })).toHaveAccessibleDescription(
      '有待处理操作',
    );
    expect(hand.getByRole('button', { name: '本局配置' })).toBeVisible();
    await startSeatSelection(view);
    const selectionHand = within(view.getByRole('group', { name: '行动手牌' }));
    expect(selectionHand.queryByRole('button', { name: '确认选择' })).not.toBeInTheDocument();
    expect(selectionHand.getByRole('button', { name: '取消选座' })).toBeVisible();
    expect(selectionHand.queryByRole('button', { name: '查看身份' })).not.toBeInTheDocument();
    expect(view.queryByRole('button', { name: '本局配置' })).not.toBeInTheDocument();
    await cancelSeatSelection(view);
    expect(view.getByRole('button', { name: '本局配置' })).toBeVisible();
  });

  it('switches the host and player hands in the same bottom panel', async () => {
    const view = await mountRoomFor({ ...actorStep('seerCheck', 'seer', 0), isHost: true });
    await click(view.getByRole('button', { name: '继续游戏' }));
    const bottom = within(view.getByTestId(TESTIDS.bottomActionPanel));
    await click(bottom.getByTestId(TESTIDS.roomMoreActionsButton));

    expect(bottom.getByRole('group', { name: '主持管理' })).toBeVisible();
    expect(bottom.queryByRole('button', { name: '本局配置' })).not.toBeInTheDocument();
    const back = bottom.getByRole('button', { name: '返回' });
    expect(back).toHaveFocus();
    await click(back);

    expect(bottom.queryByRole('group', { name: '主持管理' })).not.toBeInTheDocument();
    expect(bottom.getByRole('button', { name: '本局配置' })).toBeVisible();
    expect(bottom.getByTestId(TESTIDS.roomMoreActionsButton)).toHaveFocus();
  });
});
