import { render, screen } from '@testing-library/react';

import type { RoomBoardStatusModel } from '@/features/room/model/RoomBoardStatus';
import type { RoomPlayerActionModel } from '@/features/room/model/RoomPlayerActions';
import { TESTIDS } from '@/testids';

import { RoomActionStatus } from '../RoomActionStatus';

const EMPTY_ACTIONS: RoomPlayerActionModel = {
  message: null,
  progress: null,
  actions: [],
  group: null,
};

const SHELL_BOARD = {
  phaseLabel: '第1轮',
  lobbyTitle: null,
  lobbyDetail: null,
  icon: null,
  gameStatus: null,
  notices: [],
};

const GAME_STATUS: RoomBoardStatusModel = {
  context: '任务二 · 投票中',
  message: null,
  progress: '已投 1/5',
  pendingSeats: { seats: [1, 2], label: '未投票', testId: 'pending' },
  icon: null,
  tracks: [
    {
      key: 'quests',
      heading: '任务轨道',
      accessibleLabel: '任务轨道',
      cells: [{ key: '1', state: 'current', title: '任务1', lines: [] }],
    },
  ],
  footnote: '任务一 · 成功',
  testId: 'game-status',
};

it('renders the shell phase status as the one compact status', () => {
  const props = {
    model: { ...EMPTY_ACTIONS, message: '轮到你描述' },
    isAudioPlaying: false,
    hostManagement: null,
    board: SHELL_BOARD,
  };
  const { container, rerender } = render(<RoomActionStatus {...props} />);
  expect(container.querySelectorAll('.room-compact-status')).toHaveLength(1);
  expect(container.querySelector('.room-compact-status')).toHaveTextContent('第1轮');
  expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('轮到你描述');

  // A lobby title takes over the message line, with the seat shortfall as progress.
  rerender(
    <RoomActionStatus
      {...props}
      board={{
        ...SHELL_BOARD,
        phaseLabel: '待开局',
        lobbyTitle: '等待玩家入座',
        lobbyDetail: '还差 2 人',
      }}
    />,
  );
  expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('等待玩家入座');
  expect(screen.getByText('还差 2 人')).toBeInTheDocument();
  expect(screen.queryByText('轮到你描述')).not.toBeInTheDocument();

  rerender(<RoomActionStatus {...props} isAudioPlaying />);
  expect(screen.getByTestId(TESTIDS.audioWaitingMessage)).toHaveTextContent('语音播报中…');
});

it('shows a status message and progress outside the board', () => {
  render(
    <RoomActionStatus
      model={{
        ...EMPTY_ACTIONS,
        message: '等待下一阶段',
        progress: { current: 1, total: 3, label: '夜晚' },
      }}
      isAudioPlaying={false}
      hostManagement={null}
    />,
  );
  expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('等待下一阶段');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
});

it('falls back to the shell phase label and icon when the game status leaves them empty', () => {
  const { container } = render(
    <RoomActionStatus
      model={EMPTY_ACTIONS}
      isAudioPlaying={false}
      hostManagement={null}
      board={{
        ...SHELL_BOARD,
        phaseLabel: '本局结束',
        icon: 'moon-outline',
        gameStatus: { ...GAME_STATUS, context: null, icon: null, message: '卧底获胜' },
      }}
    />,
  );
  expect(container.querySelectorAll('.room-compact-status')).toHaveLength(1);
  expect(screen.getByText('本局结束')).toBeInTheDocument();
  expect(container.querySelector('.room-compact-status-context svg')).not.toBeNull();
  expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('卧底获胜');
});

it('replaces only the game message line during audio and selection, keeping context and tracks', () => {
  const props = {
    model: {
      ...EMPTY_ACTIONS,
      message: '请选择玩家，如不使用请点击「不用技能」',
      progress: { current: 1, total: 3, label: '夜晚' },
    },
    isAudioPlaying: false,
    hostManagement: null,
    board: { ...SHELL_BOARD, gameStatus: GAME_STATUS },
  };
  const { container, rerender } = render(<RoomActionStatus {...props} />);
  expect(container.querySelectorAll('.room-compact-status')).toHaveLength(1);
  expect(screen.getByTestId('game-status')).toHaveTextContent('任务二 · 投票中');
  expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('已投 1/5');
  expect(screen.getByTestId('pending')).toHaveTextContent('未投票：2号 3号');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

  rerender(
    <RoomActionStatus {...props} selectionMode={{ kind: 'player', escapeActionKey: 'cancel' }} />,
  );
  expect(container.querySelectorAll('.room-compact-status')).toHaveLength(1);
  expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent(
    '请选择玩家，如不使用请点击「不用技能」',
  );
  expect(screen.getByText('任务二 · 投票中')).toBeInTheDocument();
  expect(screen.getByText('任务轨道')).toBeInTheDocument();
  expect(screen.getByText('任务一 · 成功')).toBeInTheDocument();
  expect(screen.queryByText('已投 1/5')).not.toBeInTheDocument();
  expect(screen.queryByTestId('pending')).not.toBeInTheDocument();

  rerender(<RoomActionStatus {...props} isAudioPlaying />);
  expect(container.querySelectorAll('.room-compact-status')).toHaveLength(1);
  expect(screen.getByTestId(TESTIDS.audioWaitingMessage)).toHaveTextContent('语音播报中…');
  expect(screen.getByText('任务二 · 投票中')).toBeInTheDocument();
  expect(screen.getByText('任务轨道')).toBeInTheDocument();
});

it('keeps notices inside the one bar with or without a game status, through audio', () => {
  const notices = [{ key: 'mark', text: '猩红之子：7号' }];
  const props = {
    model: { ...EMPTY_ACTIONS, message: '等待发言' },
    isAudioPlaying: false,
    hostManagement: null,
    board: { ...SHELL_BOARD, phaseLabel: '白天', notices },
  };
  const { container, rerender } = render(<RoomActionStatus {...props} />);
  const bars = () => container.querySelectorAll('.room-compact-status');
  expect(bars()).toHaveLength(1);
  expect(bars()[0]).toHaveTextContent('白天');
  expect(bars()[0]).toHaveTextContent('猩红之子：7号');

  rerender(<RoomActionStatus {...props} board={{ ...props.board, gameStatus: GAME_STATUS }} />);
  expect(bars()).toHaveLength(1);
  expect(screen.getByTestId('game-status')).toHaveTextContent('猩红之子：7号');

  rerender(<RoomActionStatus {...props} isAudioPlaying />);
  expect(bars()).toHaveLength(1);
  expect(bars()[0]).toHaveTextContent('语音播报中…');
  expect(screen.getAllByText('猩红之子：7号')).toHaveLength(1);
});
