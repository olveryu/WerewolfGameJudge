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

it('suppresses only a redundant message while keeping selection and audio instructions', () => {
  const props = {
    model: { ...EMPTY_ACTIONS, message: '报名进行中' },
    summary: <button type="button">警长竞选详情</button>,
    isAudioPlaying: false,
    hostManagement: null,
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

  rerender(
    <RoomActionStatus {...props} selectionMode={{ kind: 'player', escapeActionKey: 'cancel' }} />,
  );
  expect(screen.getByText('报名进行中')).toBeInTheDocument();
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
