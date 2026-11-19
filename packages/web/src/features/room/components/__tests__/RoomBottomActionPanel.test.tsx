import { fireEvent, render, screen } from '@testing-library/react';

import { TESTIDS } from '@/testids';

import { RoomActionHand } from '../RoomActionHand';
import { RoomBottomActionPanel } from '../RoomBottomActionPanel';

const EMPTY_STACK = {
  kind: 'stacked',
  message: null,
  progress: null,
  layout: { primary: [], secondary: [], ghost: [] },
} as const;

it('preserves the focused card when an earlier card disappears', () => {
  const { rerender } = render(
    <RoomActionHand label="操作">
      <button key="first">先前操作</button>
      <button key="second">当前操作</button>
    </RoomActionHand>,
  );
  const focusedCard = screen.getByRole('button', { name: '当前操作' });
  focusedCard.focus();

  rerender(
    <RoomActionHand label="操作">
      <button key="second">当前操作</button>
    </RoomActionHand>,
  );

  expect(screen.getByRole('button', { name: '当前操作' })).toBe(focusedCard);
  expect(focusedCard).toHaveFocus();
});

it('keeps a game summary inside the bottom panel when it has no other content', () => {
  render(
    <RoomBottomActionPanel
      model={EMPTY_STACK}
      summary={<button type="button">对局记录</button>}
      isAudioPlaying={false}
      hostManagement={null}
      onOpenMoreActions={() => undefined}
    />,
  );

  const panel = screen.getByTestId(TESTIDS.bottomActionPanel);
  const summary = screen.getByRole('button', { name: '对局记录' });

  expect(panel).toContainElement(summary);
  expect(summary.parentElement).toHaveClass('bottom-action-summary');
});

it('places the summary before existing progress messages and actions', () => {
  render(
    <RoomBottomActionPanel
      model={{
        kind: 'stacked',
        message: '等待下一阶段',
        progress: null,
        layout: { primary: [], secondary: [], ghost: [] },
      }}
      summary={<button type="button">对局记录</button>}
      isAudioPlaying={false}
      hostManagement={null}
      onOpenMoreActions={() => undefined}
    />,
  );

  const panel = screen.getByTestId(TESTIDS.bottomActionPanel);
  const summaryWrapper = panel.firstElementChild;
  const message = screen.getByText('等待下一阶段');

  expect(summaryWrapper).toHaveClass('bottom-action-summary');
  expect(summaryWrapper?.nextElementSibling).toBe(message);
});

it('keeps one personal primary action in the card and opens the action panel for secondary actions', () => {
  const onOpenMoreActions = vi.fn();
  render(
    <RoomBottomActionPanel
      model={{
        kind: 'stacked',
        message: null,
        progress: null,
        layout: {
          primary: [
            {
              key: 'vote',
              label: '去投票',
              audience: 'participant',
              variant: 'primary',
              size: 'lg',
              testID: 'vote-action',
              isEnabled: true,
              onPress: vi.fn(),
            },
          ],
          secondary: [
            {
              key: 'identity',
              label: '查看身份',
              audience: 'participant',
              variant: 'secondary',
              size: 'md',
              testID: 'identity-action',
              isEnabled: true,
              onPress: vi.fn(),
            },
            {
              key: 'unavailable',
              label: '暂不可用',
              audience: 'participant',
              variant: 'secondary',
              size: 'md',
              testID: 'unavailable-action',
              isEnabled: false,
              disabledReason: '等待下一阶段',
            },
          ],
          ghost: [],
        },
      }}
      summary={null}
      isAudioPlaying={false}
      hostManagement={null}
      onOpenMoreActions={onOpenMoreActions}
    />,
  );

  expect(screen.getByTestId('vote-action')).toBeInTheDocument();
  expect(screen.queryByTestId('identity-action')).not.toBeInTheDocument();
  expect(screen.getByTestId(TESTIDS.roomMoreActionsButton)).toHaveAttribute(
    'data-player-action-ids',
    'identity-action',
  );
  fireEvent.click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
  expect(onOpenMoreActions).toHaveBeenCalledOnce();
});

it('does not choose between multiple equally ranked primary actions', () => {
  render(
    <RoomBottomActionPanel
      model={{
        kind: 'stacked',
        message: null,
        progress: null,
        layout: {
          primary: [
            {
              key: 'approve',
              label: '赞成',
              audience: 'participant',
              variant: 'primary',
              size: 'md',
              testID: 'approve-action',
              isEnabled: true,
              onPress: vi.fn(),
            },
            {
              key: 'reject',
              label: '反对',
              audience: 'participant',
              variant: 'primary',
              size: 'md',
              testID: 'reject-action',
              isEnabled: true,
              onPress: vi.fn(),
            },
          ],
          secondary: [],
          ghost: [],
        },
      }}
      summary={null}
      isAudioPlaying={false}
      hostManagement={null}
      onOpenMoreActions={() => undefined}
    />,
  );

  expect(screen.getByRole('button', { name: '选择操作' })).toBeInTheDocument();
  expect(screen.queryByTestId('approve-action')).not.toBeInTheDocument();
  expect(screen.queryByTestId('reject-action')).not.toBeInTheDocument();
  expect(screen.getByTestId(TESTIDS.roomMoreActionsButton)).toHaveAttribute(
    'data-player-action-ids',
    'approve-action reject-action',
  );
});

it('announces audio playback instead of a lower-priority action message', () => {
  render(
    <RoomBottomActionPanel
      model={{ ...EMPTY_STACK, message: '等待玩家确认' }}
      summary={null}
      isAudioPlaying
      hostManagement={null}
      onOpenMoreActions={() => undefined}
    />,
  );

  expect(screen.getByTestId(TESTIDS.audioWaitingMessage)).toHaveTextContent('语音播报中…');
  expect(screen.queryByTestId(TESTIDS.actionMessage)).not.toBeInTheDocument();
  expect(screen.queryByText('等待玩家确认')).not.toBeInTheDocument();
});

it('uses the declared host task label as the management hint', () => {
  render(
    <RoomBottomActionPanel
      model={EMPTY_STACK}
      summary={null}
      isAudioPlaying={false}
      hostManagement={{
        task: { kind: 'action', actionKey: 'start-game' },
        sections: [
          {
            key: 'lobby',
            title: '房间',
            actions: [
              {
                key: 'start-game',
                label: '开始游戏',
                icon: 'play-outline',
                variant: 'primary',
                isEnabled: true,
                onPress: vi.fn(),
              },
            ],
          },
        ],
      }}
      onOpenMoreActions={() => undefined}
    />,
  );

  expect(screen.getByText('当前待办 · 开始游戏')).toBeInTheDocument();
});

it('marks a host hand with a bell only while its task can be executed', () => {
  const action = {
    key: 'start-game',
    label: '开始游戏',
    icon: 'play-outline',
    variant: 'primary',
    isEnabled: true,
    onPress: vi.fn(),
  } as const;
  const panel = (
    taskAction:
      | typeof action
      | (Omit<typeof action, 'isEnabled'> & {
          readonly isEnabled: false;
          readonly disabledReason: string;
        }),
  ) => (
    <RoomBottomActionPanel
      model={EMPTY_STACK}
      summary={null}
      isAudioPlaying={false}
      hostManagement={{
        task: { kind: 'action', actionKey: 'start-game' },
        sections: [{ key: 'lobby', title: '房间', actions: [taskAction] }],
      }}
      onOpenMoreActions={() => undefined}
      showPlayerHand
    />
  );
  const { rerender } = render(panel(action));
  const hostEntry = screen.getByTestId(TESTIDS.roomMoreActionsButton);
  expect(hostEntry).toHaveAccessibleName('主持管理，有待处理操作');
  expect(hostEntry.querySelector('.bottom-action-pending')).toBeInTheDocument();

  rerender(panel({ ...action, isEnabled: false, disabledReason: '座位尚未坐满' }));
  expect(hostEntry).toHaveAccessibleName('主持管理');
  expect(hostEntry.querySelector('.bottom-action-pending')).not.toBeInTheDocument();

  const loadingAction = { ...action, isLoading: true };
  rerender(panel(loadingAction));
  expect(hostEntry).toHaveAccessibleName('主持管理');
  expect(hostEntry.querySelector('.bottom-action-pending')).not.toBeInTheDocument();
});

it('replaces the action hand with manual cards and restores focus on return', () => {
  const openRules = vi.fn();
  render(
    <RoomBottomActionPanel
      model={EMPTY_STACK}
      summary={null}
      isAudioPlaying={false}
      hostManagement={null}
      onOpenMoreActions={() => undefined}
      showPlayerHand
      manualEntries={[{ label: '玩法', onOpen: openRules }]}
    />,
  );

  const manual = screen.getByTestId(TESTIDS.roomManualButton);
  fireEvent.click(manual);
  const hand = screen.getByRole('group', { name: '手册' });
  expect(hand.querySelectorAll('.room-action-card-cell')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '玩法' }));
  expect(openRules).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByTestId(TESTIDS.roomManualBackButton));
  expect(screen.getByTestId(TESTIDS.roomManualButton)).toHaveFocus();
});
