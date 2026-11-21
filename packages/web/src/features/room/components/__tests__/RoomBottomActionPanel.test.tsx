import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { TESTIDS } from '@/testids';

import { RoomActionHand } from '../RoomActionHand';
import { RoomActionStatus, RoomBottomActionPanel } from '../RoomBottomActionPanel';
import { RoomHandButton } from '../RoomHandButton';

const EMPTY_STACK = {
  kind: 'stacked',
  message: null,
  progress: null,
  layout: { primary: [], secondary: [], ghost: [] },
} as const;

it('announces an explicitly pending player action without inferring it from primary styling', () => {
  render(
    <RoomBottomActionPanel
      model={{
        kind: 'stacked',
        message: null,
        progress: null,
        layout: {
          primary: [
            {
              key: 'identity',
              label: '查看身份',
              audience: 'participant',
              variant: 'primary',
              size: 'md',
              category: 'resource',
              isPending: true,
              isEnabled: true,
              onPress: vi.fn(),
            },
            {
              key: 'optional',
              label: '其他行动',
              audience: 'participant',
              variant: 'primary',
              size: 'md',
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
  const identity = screen.getByRole('button', { name: '查看身份' });
  expect(identity).toHaveAttribute('data-card-category', 'resource');
  expect(identity).toHaveAccessibleDescription('有待处理操作');
  expect(identity.querySelector('.bottom-action-pending')).toHaveTextContent('待行动');
  expect(
    screen.getByRole('button', { name: '其他行动' }).querySelector('.bottom-action-pending'),
  ).toBeNull();
});

it('explains a blocked player card without executing an action', () => {
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
              label: '投票',
              audience: 'participant',
              variant: 'primary',
              size: 'md',
              isEnabled: false,
              disabledReason: '等待下一阶段',
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
  const action = screen.getByRole('button', { name: '投票' });
  expect(action).toHaveAttribute('aria-disabled', 'true');
  expect(action).toHaveAccessibleDescription('等待下一阶段');
  expect(screen.queryByText('投票：等待下一阶段')).not.toBeInTheDocument();
  expect(screen.getByText('等待下一阶段')).toHaveClass('visually-hidden');
  fireEvent.click(action);
  expect(screen.getByRole('status')).toHaveTextContent('等待下一阶段');
});

it('keeps a submitting card disabled with a spinner instead of a lock', () => {
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
              label: '投票',
              audience: 'participant',
              variant: 'primary',
              size: 'md',
              isEnabled: false,
              isLoading: true,
              disabledReason: null,
            },
          ],
          secondary: [],
          ghost: [],
        },
      }}
      summary={null}
      isAudioPlaying={false}
      hostManagement={null}
      onOpenMoreActions={vi.fn()}
    />,
  );
  const action = screen.getByRole('button', { name: /投票/ });
  expect(action).toBeDisabled();
  expect(within(action).getByRole('status', { name: '提交中' })).toBeInTheDocument();
});

it('shows the host selection escape as a card without exposing unrelated actions', () => {
  const cancel = vi.fn();
  render(
    <RoomBottomActionPanel
      model={EMPTY_STACK}
      selectionMode="host-task"
      summary={null}
      isAudioPlaying={false}
      hostManagement={{
        task: { kind: 'message', text: '请选择座位', actionKey: 'cancel-selection' },
        sections: [
          {
            key: 'selection',
            title: '选择',
            actions: [
              {
                key: 'cancel-selection',
                label: '取消选择',
                icon: 'close-circle-outline',
                variant: 'secondary',
                isEnabled: true,
                onPress: cancel,
              },
            ],
          },
        ],
      }}
      mainEntries={[{ label: '用户设置', icon: null, onOpen: vi.fn() }]}
      onOpenMoreActions={vi.fn()}
    />,
  );
  const action = screen.getByRole('button', { name: '取消选择' });
  expect(action.closest('.room-action-hand')).not.toBeNull();
  expect(screen.queryByRole('button', { name: '用户设置' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '主持管理' })).not.toBeInTheDocument();
  fireEvent.click(action);
  expect(cancel).toHaveBeenCalledOnce();
});

it('preserves the focused card when an earlier card disappears', () => {
  const { rerender } = render(
    <RoomActionHand
      label="操作"
      cards={[
        { id: 'first', category: 'player', content: <button>先前操作</button> },
        { id: 'second', category: 'player', content: <button>当前操作</button> },
      ]}
    />,
  );
  const focusedCard = screen.getByRole('button', { name: '当前操作' });
  focusedCard.focus();

  rerender(
    <RoomActionHand
      label="操作"
      cards={[{ id: 'second', category: 'player', content: <button>当前操作</button> }]}
    />,
  );

  expect(screen.getByRole('button', { name: '当前操作' })).toBe(focusedCard);
  expect(focusedCard).toHaveFocus();
});

it('groups cards by semantic color without moving disabled cards out of their group', () => {
  const cards = [
    { id: 'resource', category: 'resource' as const, content: <button>查询</button> },
    {
      id: 'host-disabled',
      category: 'host' as const,
      unavailable: true,
      content: <button disabled>授权</button>,
    },
    { id: 'danger', category: 'danger' as const, content: <button>重开</button> },
    { id: 'player', category: 'player' as const, content: <button>行动</button> },
    { id: 'host', category: 'host' as const, content: <button>昨夜信息</button> },
    { id: 'back', category: 'back' as const, content: <button>返回</button> },
  ];
  const { rerender } = render(<RoomActionHand label="操作" cards={cards} />);
  const labels = () => screen.getAllByRole('button').map((button) => button.textContent);
  expect(labels()).toEqual(['返回', '行动', '查询', '昨夜信息', '授权', '重开']);
  const authorization = screen.getByRole('button', { name: '授权' });
  rerender(
    <RoomActionHand
      label="操作"
      cards={cards.map((card) =>
        card.id === 'host-disabled'
          ? { ...card, unavailable: false, content: <button>授权</button> }
          : card,
      )}
    />,
  );
  expect(labels()).toEqual(['返回', '行动', '查询', '授权', '昨夜信息', '重开']);
  expect(screen.getByRole('button', { name: '授权' })).toBe(authorization);
});

it('orders actual player, host, query and dangerous cards by their displayed categories', () => {
  render(
    <RoomBottomActionPanel
      model={{
        kind: 'stacked',
        message: null,
        progress: null,
        layout: {
          primary: [
            {
              key: 'query',
              label: '查看身份',
              audience: 'participant',
              variant: 'secondary',
              size: 'md',
              category: 'resource',
              isEnabled: true,
              onPress: vi.fn(),
            },
            {
              key: 'act',
              label: '行动',
              audience: 'participant',
              variant: 'primary',
              size: 'md',
              isEnabled: true,
              onPress: vi.fn(),
            },
            {
              key: 'danger',
              label: '结束',
              audience: 'participant',
              variant: 'danger',
              size: 'md',
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
      hostManagement={{ task: null, sections: [] }}
      configurationEntry={{ onOpen: vi.fn() }}
      mainEntries={[{ label: '查看建议', icon: null, onOpen: vi.fn() }]}
      onOpenMoreActions={vi.fn()}
    />,
  );
  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
    '行动',
    '查看身份',
    '本局配置',
    '查看建议',
    '主持管理',
    '结束',
  ]);
  expect(screen.getByRole('button', { name: '查看建议' })).toHaveAttribute(
    'data-card-category',
    'resource',
  );
});

it('reopens the unavailable reason for five seconds without performing the action', () => {
  vi.useFakeTimers();
  try {
    const onPress = vi.fn();
    render(
      <RoomActionHand
        label="操作"
        cards={[
          {
            id: 'action',
            category: 'player',
            unavailable: true,
            content: (
              <RoomHandButton
                model={{
                  label: '行动',
                  category: 'player',
                  variant: 'primary',
                  isEnabled: false,
                  disabledReason: '等待其他玩家',
                  onPress,
                }}
              />
            ),
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '行动' }));
    expect(screen.getByRole('status')).toHaveTextContent('等待其他玩家');
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByRole('status')).toHaveTextContent('等待其他玩家');
    fireEvent.click(screen.getByRole('button', { name: '行动' }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(onPress).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it('suppresses only a redundant message while keeping selection and audio instructions', () => {
  const model = { ...EMPTY_STACK, message: '报名进行中' };
  const props = {
    model,
    summary: <button>警长竞选详情</button>,
    isAudioPlaying: false,
    hostManagement: null,
    selectionMode: undefined,
    boardStatus: {
      phaseLabel: '白天',
      title: null,
      detail: null,
      summaryPresentation: 'replaces-message' as const,
    },
  };
  const { rerender } = render(<RoomActionStatus {...props} />);
  expect(screen.queryByText('报名进行中')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '警长竞选详情' })).toBeInTheDocument();

  rerender(<RoomActionStatus {...props} selectionMode="player" />);
  expect(screen.getByText('报名进行中')).toBeInTheDocument();
  rerender(<RoomActionStatus {...props} isAudioPlaying />);
  expect(screen.getByText('语音播报中…')).toBeInTheDocument();
  rerender(
    <RoomActionStatus
      {...props}
      boardStatus={{ ...props.boardStatus, summaryPresentation: undefined }}
    />,
  );
  expect(screen.getByText('报名进行中')).toBeInTheDocument();
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

it('renders every player action as an independent hand card', () => {
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
  expect(screen.getByTestId('identity-action')).toBeInTheDocument();
  expect(screen.getByTestId('unavailable-action')).toHaveAttribute('aria-disabled', 'true');
  expect(screen.queryByTestId(TESTIDS.roomMoreActionsButton)).not.toBeInTheDocument();
  expect(onOpenMoreActions).not.toHaveBeenCalled();
});

it('keeps equally ranked primary actions independently available', () => {
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

  expect(screen.getByTestId('approve-action')).toBeInTheDocument();
  expect(screen.getByTestId('reject-action')).toBeInTheDocument();
  expect(screen.queryByTestId(TESTIDS.roomMoreActionsButton)).not.toBeInTheDocument();
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

it('shows the host-management entry when the host declares a task', () => {
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

  expect(screen.getByRole('button', { name: '主持管理' })).toBeInTheDocument();
});

it('marks a host hand only when the game declares a pending task', () => {
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
    pendingActionKeys: readonly string[] = [],
  ) => (
    <RoomBottomActionPanel
      model={EMPTY_STACK}
      summary={null}
      isAudioPlaying={false}
      hostManagement={{
        task: { kind: 'action', actionKey: 'start-game' },
        pendingActionKeys,
        sections: [{ key: 'lobby', title: '房间', actions: [taskAction] }],
      }}
      onOpenMoreActions={() => undefined}
    />
  );
  const { rerender } = render(panel(action));
  const hostEntry = screen.getByTestId(TESTIDS.roomMoreActionsButton);
  expect(hostEntry).toHaveAccessibleName('主持管理');
  expect(hostEntry.querySelector('.bottom-action-pending')).not.toBeInTheDocument();

  rerender(panel(action, ['start-game']));
  expect(hostEntry).toHaveAccessibleName('主持管理，有待处理操作');
  expect(hostEntry.querySelector('.bottom-action-pending')).toBeInTheDocument();

  rerender(panel({ ...action, isEnabled: false, disabledReason: '座位尚未坐满' }, ['start-game']));
  expect(hostEntry).toHaveAccessibleName('主持管理，有待处理操作');
  expect(hostEntry.querySelector('.bottom-action-pending')).toBeInTheDocument();

  const loadingAction = { ...action, isLoading: true };
  rerender(panel(loadingAction, ['start-game']));
  expect(hostEntry).toHaveAccessibleName('主持管理，有待处理操作');
  expect(hostEntry.querySelector('.bottom-action-pending')).toBeInTheDocument();
});

it('keeps the host entry available and marked when a declared task is blocked', () => {
  const open = vi.fn();
  render(
    <RoomBottomActionPanel
      model={EMPTY_STACK}
      summary={null}
      isAudioPlaying={false}
      hostManagement={{
        task: { kind: 'action', actionKey: 'start-game' },
        pendingActionKeys: ['start-game'],
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
                isEnabled: false,
                disabledReason: '座位尚未坐满',
              },
            ],
          },
        ],
      }}
      onOpenMoreActions={open}
    />,
  );
  const entry = screen.getByRole('button', { name: '主持管理，有待处理操作' });
  expect(entry.querySelector('.bottom-action-pending')).toBeInTheDocument();
  fireEvent.click(entry);
  expect(open).toHaveBeenCalledOnce();
});

it('marks a required decision without marking individual alternatives', () => {
  const action = {
    key: 'retry',
    label: '重新准备',
    icon: 'play-outline',
    variant: 'primary',
    isEnabled: true,
    onPress: vi.fn(),
  } as const;
  render(
    <RoomBottomActionPanel
      model={EMPTY_STACK}
      summary={null}
      isAudioPlaying={false}
      hostManagement={{
        task: { kind: 'action', actionKey: 'retry' },
        pendingActionKeys: [],
        hasPendingDecision: true,
        sections: [{ key: 'room', title: '房间', actions: [action] }],
      }}
      onOpenMoreActions={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: '主持管理，有待处理操作' })).toBeEnabled();
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
