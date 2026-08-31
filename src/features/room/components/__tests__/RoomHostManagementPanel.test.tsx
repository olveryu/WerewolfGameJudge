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
      preview: '待处理：结束报名',
      status: '警长竞选 · 报名中',
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

    expect(screen.getByText('待处理：结束报名')).toBeTruthy();
    expect(screen.getByText('警长竞选 · 报名中')).toBeTruthy();
    fireEvent.press(screen.getByText('结束报名'));
    expect(calls).toEqual(['close', 'action']);
    expect(advance).toHaveBeenCalledTimes(1);
    expect(restart).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps the panel open when routing disabled action feedback', () => {
    const onDisabledPress = jest.fn();
    const close = jest.fn();
    const model: RoomHostManagementModel = {
      preview: '下一步：开始本轮',
      status: '等待开始',
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
              onDisabledPress,
            },
          ],
        },
      ],
    };

    const screen = render(
      <RoomHostManagementPanel model={model} isVisible presentation="inspector" onClose={close} />,
    );

    fireEvent.press(screen.getByText('开始本轮'));
    expect(onDisabledPress).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('does not render while closed', () => {
    const model: RoomHostManagementModel = {
      preview: '房间配置等 3 项',
      status: null,
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
