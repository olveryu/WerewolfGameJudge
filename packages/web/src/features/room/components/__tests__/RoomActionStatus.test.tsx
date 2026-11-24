import { render, screen } from '@testing-library/react';

import type { RoomPlayerActionModel } from '@/features/room/model/RoomPlayerActions';
import { TESTIDS } from '@/testids';

import { RoomActionStatus } from '../RoomActionStatus';

const EMPTY_ACTIONS: RoomPlayerActionModel = {
  message: null,
  progress: null,
  actions: [],
  group: null,
};

it('renders every board status as the compact status, the summary below it', () => {
  const props = {
    model: { ...EMPTY_ACTIONS, message: '轮到你描述' },
    summary: <p>卧底获胜</p>,
    isAudioPlaying: false,
    hostManagement: null,
    boardStatus: { phaseLabel: '第1轮', title: null, detail: null },
  };
  const { container, rerender } = render(<RoomActionStatus {...props} />);
  const status = container.querySelector('.room-compact-status');
  expect(status).toHaveTextContent('第1轮');
  expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('轮到你描述');
  expect(container.querySelector('.room-board-status-card')).toBeNull();
  expect(container.querySelector('.room-board-status-summary')).toHaveTextContent('卧底获胜');

  // A lobby title takes over the message line, with the seat shortfall as progress.
  rerender(
    <RoomActionStatus
      {...props}
      summary={null}
      boardStatus={{ phaseLabel: '待开局', title: '等待玩家入座', detail: '还差 2 人' }}
    />,
  );
  expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('等待玩家入座');
  expect(screen.getByText('还差 2 人')).toBeInTheDocument();
  expect(screen.queryByText('轮到你描述')).not.toBeInTheDocument();

  rerender(<RoomActionStatus {...props} isAudioPlaying />);
  expect(screen.getByTestId(TESTIDS.audioWaitingMessage)).toHaveTextContent('语音播报中…');
});

it('shows a status message and progress when the summary is not the status', () => {
  render(
    <RoomActionStatus
      model={{
        ...EMPTY_ACTIONS,
        message: '等待下一阶段',
        progress: { current: 1, total: 3, label: '夜晚' },
      }}
      summary={null}
      isAudioPlaying={false}
      hostManagement={null}
    />,
  );
  expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('等待下一阶段');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
});

it('gives audio and selection messages priority over compact game content', () => {
  const props = {
    model: {
      ...EMPTY_ACTIONS,
      message: '请选择玩家，如不使用请点击「不用技能」',
      progress: { current: 1, total: 3, label: '夜晚' },
    },
    summary: null,
    isAudioPlaying: false,
    hostManagement: null,
    boardStatus: {
      phaseLabel: '夜晚',
      title: null,
      detail: null,
      compactContent: <p>游戏状态</p>,
    },
  };
  const { rerender } = render(<RoomActionStatus {...props} />);
  expect(screen.getByText('游戏状态')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

  rerender(
    <RoomActionStatus {...props} selectionMode={{ kind: 'player', escapeActionKey: 'cancel' }} />,
  );
  expect(screen.queryByText('游戏状态')).not.toBeInTheDocument();
  expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent(
    '请选择玩家，如不使用请点击「不用技能」',
  );

  rerender(<RoomActionStatus {...props} isAudioPlaying />);
  expect(screen.queryByText('游戏状态')).not.toBeInTheDocument();
  expect(screen.getByTestId(TESTIDS.audioWaitingMessage)).toHaveTextContent('语音播报中…');
});
