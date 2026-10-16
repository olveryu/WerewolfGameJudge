import { fireEvent, render } from '@testing-library/react-native';

import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';

import { RoomHostManagementPanel } from '../RoomHostManagementPanel';

describe('RoomHostManagementPanel', () => {
  it('closes before executing an enabled action', () => {
    const calls: string[] = [];
    const advance = jest.fn(() => calls.push('action'));
    const restart = jest.fn();
    const close = jest.fn(() => calls.push('close'));
    const model: RoomHostManagementModel = {
      hasPendingAction: true,
      sections: [
        {
          key: 'current-flow',
          title: '当前流程',
          actions: [
            {
              key: 'advance',
              label: '结束报名',
              icon: 'arrow-forward-outline',
              variant: 'primary',
              isEnabled: true,
              onPress: advance,
            },
          ],
        },
        {
          key: 'danger',
          title: '危险操作',
          actions: [
            {
              key: 'restart',
              label: '重新开始',
              icon: 'refresh-outline',
              variant: 'danger',
              isEnabled: true,
              onPress: restart,
            },
          ],
        },
      ],
    };

    const screen = render(
      <RoomHostManagementPanel model={model} isVisible presentation="inspector" onClose={close} />,
    );

    const advanceButton = screen.getByLabelText('结束报名');
    fireEvent.press(advanceButton);
    expect(calls).toEqual(['close', 'action']);
    expect(advance).toHaveBeenCalledTimes(1);
    expect(restart).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps the panel open and fires nothing when a disabled action is pressed', () => {
    const close = jest.fn();
    const model: RoomHostManagementModel = {
      sections: [
        {
          key: 'current-flow',
          title: '当前流程',
          actions: [
            {
              key: 'start-round',
              label: '开始本轮',
              icon: 'play-outline',
              variant: 'primary',
              isEnabled: false,
              disabledReason: '请先坐满所有座位',
            },
          ],
        },
      ],
    };

    const screen = render(
      <RoomHostManagementPanel model={model} isVisible presentation="inspector" onClose={close} />,
    );

    fireEvent.press(screen.getByText('开始本轮'));
    expect(close).not.toHaveBeenCalled();
  });

  it('shows the disabled reason as a caption under a disabled non-primary action', () => {
    const model: RoomHostManagementModel = {
      sections: [
        {
          key: 'current-flow',
          title: '当前流程',
          actions: [
            {
              key: 'start-round',
              label: '开始本轮',
              icon: 'play-outline',
              variant: 'primary',
              isEnabled: false,
              disabledReason: '请先坐满所有座位',
            },
            {
              key: 'configure',
              label: '房间设置',
              icon: 'settings-outline',
              variant: 'secondary',
              isEnabled: true,
              onPress: jest.fn(),
            },
          ],
        },
      ],
    };

    const screen = render(
      <RoomHostManagementPanel
        model={model}
        isVisible
        presentation="inspector"
        onClose={jest.fn()}
      />,
    );

    // Button label plus its reason caption: the reason text appears once,
    // attached to the disabled action only.
    expect(screen.getAllByText('请先坐满所有座位')).toHaveLength(1);
    expect(screen.getByText('房间设置')).toBeTruthy();
  });

  it('renders no caption for the primary action: its reason lives on the console only', () => {
    const model: RoomHostManagementModel = {
      sections: [
        {
          key: 'current-flow',
          title: '当前流程',
          actions: [
            {
              key: 'start-round',
              label: '开始本轮',
              icon: 'play-outline',
              variant: 'primary',
              isEnabled: false,
              disabledReason: '座位尚未坐满（还差 2 人）',
              isPrimary: true,
            },
          ],
        },
      ],
    };

    const screen = render(
      <RoomHostManagementPanel
        model={model}
        isVisible
        presentation="inspector"
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByText('座位尚未坐满（还差 2 人）')).toBeNull();
    expect(screen.getByText('开始本轮')).toBeTruthy();
  });

  it('does not render while closed', () => {
    const model: RoomHostManagementModel = {
      sections: [],
    };

    const screen = render(
      <RoomHostManagementPanel
        model={model}
        isVisible={false}
        presentation="sheet"
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByText('主持管理')).toBeNull();
  });
});
