import { fireEvent, render, screen, within } from '@testing-library/react';

import { TESTIDS } from '@/testids';

import { RoomHostManagementPanel } from '../RoomHostManagementPanel';

it('groups player actions and the host task in one panel without duplicating its command', () => {
  const onHostAction = vi.fn();
  const onClose = vi.fn();
  render(
    <RoomHostManagementPanel
      model={{
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
                testID: TESTIDS.startGameButton,
                isEnabled: true,
                onPress: onHostAction,
              },
              {
                key: 'fill-bots',
                label: '填充机器人',
                icon: 'people-outline',
                variant: 'secondary',
                testID: TESTIDS.roomFillBotsButton,
                isEnabled: true,
                onPress: vi.fn(),
              },
            ],
          },
        ],
      }}
      bottomActions={{
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
              size: 'md',
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
          ],
          ghost: [],
        },
      }}
      presentation="sheet"
      onClose={onClose}
      isAudioPlaying={false}
    />,
  );

  const panel = screen.getByTestId(TESTIDS.roomHostManagementPanel);
  expect(panel).toHaveTextContent('玩家操作');
  expect(panel).toHaveTextContent('主持管理');
  expect(panel).toHaveTextContent('当前待办');
  expect(within(panel).getByTestId('identity-action')).toBeInTheDocument();
  expect(within(panel).getByTestId(TESTIDS.startGameButton)).toHaveAccessibleName('开始游戏');
  expect(within(panel).queryByTestId(TESTIDS.roomNextStepButton)).not.toBeInTheDocument();
  expect(within(panel).getByTestId(TESTIDS.roomFillBotsButton)).toBeInTheDocument();

  fireEvent.click(within(panel).getByTestId(TESTIDS.startGameButton));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onHostAction).toHaveBeenCalledOnce();
});

it('keeps a blocked task command disabled in the inventory and shows its reason once', () => {
  render(
    <RoomHostManagementPanel
      model={{
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
                testID: TESTIDS.startGameButton,
                isEnabled: false,
                disabledReason: '座位尚未坐满',
              },
            ],
          },
        ],
      }}
      bottomActions={null}
      presentation="sheet"
      onClose={() => undefined}
      isAudioPlaying={false}
    />,
  );

  const panel = screen.getByTestId(TESTIDS.roomHostManagementPanel);
  expect(within(panel).getByTestId(TESTIDS.startGameButton)).toBeDisabled();
  expect(within(panel).getByTestId(TESTIDS.roomNextStepBlockedReason)).toHaveTextContent(
    '座位尚未坐满',
  );
  expect(within(panel).getAllByText('座位尚未坐满')).toHaveLength(1);
});

it('shows only player actions when a non-host opens the shared panel', () => {
  render(
    <RoomHostManagementPanel
      model={null}
      bottomActions={{
        kind: 'stacked',
        message: null,
        progress: null,
        layout: {
          primary: [],
          secondary: [
            {
              key: 'review',
              label: '本局复盘',
              audience: 'anyone',
              variant: 'secondary',
              size: 'md',
              testID: 'review-action',
              isEnabled: true,
              onPress: vi.fn(),
            },
          ],
          ghost: [],
        },
      }}
      presentation="sheet"
      onClose={() => undefined}
      isAudioPlaying={false}
    />,
  );

  const panel = screen.getByTestId(TESTIDS.roomHostManagementPanel);
  expect(panel).toHaveTextContent('玩家操作');
  expect(panel).not.toHaveTextContent('主持管理');
  expect(within(panel).getByTestId('review-action')).toBeInTheDocument();
});
