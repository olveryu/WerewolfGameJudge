import { fireEvent, render } from '@testing-library/react-native';

import type { RoomBottomActionModel } from '@/features/room/model/RoomBottomActions';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import { RoomBottomActionPanel } from '../RoomBottomActionPanel';
import { createRoomFeatureStyles } from '../styles';

const styles = createRoomFeatureStyles(colors).bottomActionPanel;

describe('RoomBottomActionPanel', () => {
  it('renders game-provided message and dispatches an enabled action', () => {
    const onPress = jest.fn();
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: '请选择目标',
      layout: {
        primary: [
          {
            key: 'confirm',
            label: '确认',
            variant: 'primary',
            size: 'lg',
            isEnabled: true,
            onPress,
          },
        ],
        secondary: [],
        ghost: [],
      },
    };
    const { getByText, getByTestId } = render(
      <RoomBottomActionPanel
        model={model}
        hostManagement={null}
        onOpenHostManagement={jest.fn()}
        styles={styles}
        bottomInset={0}
      />,
    );

    expect(getByTestId(TESTIDS.actionMessage)).toBeTruthy();
    fireEvent.press(getByText('确认'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not expose a mutation callback for a disabled display action', () => {
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: null,
      layout: {
        primary: [
          {
            key: 'waiting',
            label: '等待房主开始',
            variant: 'primary',
            size: 'lg',
            isEnabled: false,
            disabledReason: null,
            onDisabledPress: null,
          },
        ],
        secondary: [],
        ghost: [],
      },
    };
    const { getByText } = render(
      <RoomBottomActionPanel
        model={model}
        hostManagement={null}
        onOpenHostManagement={jest.fn()}
        styles={styles}
        bottomInset={0}
      />,
    );
    fireEvent.press(getByText('等待房主开始'));
  });

  it('allows explicit disabled feedback without exposing the enabled action', () => {
    const onDisabledPress = jest.fn();
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: null,
      layout: {
        primary: [
          {
            key: 'waiting',
            label: '等待房主开始',
            variant: 'primary',
            size: 'lg',
            isEnabled: false,
            disabledReason: '等待房主开始',
            onDisabledPress,
          },
        ],
        secondary: [],
        ghost: [],
      },
    };
    const { getByText } = render(
      <RoomBottomActionPanel
        model={model}
        hostManagement={null}
        onOpenHostManagement={jest.fn()}
        styles={styles}
        bottomInset={0}
      />,
    );
    fireEvent.press(getByText('等待房主开始'));
    expect(onDisabledPress).toHaveBeenCalledTimes(1);
  });

  it('does not render an empty model', () => {
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: null,
      layout: { primary: [], secondary: [], ghost: [] },
    };
    const { queryByTestId } = render(
      <RoomBottomActionPanel
        model={model}
        hostManagement={null}
        onOpenHostManagement={jest.fn()}
        styles={styles}
        bottomInset={0}
      />,
    );
    expect(queryByTestId(TESTIDS.bottomActionPanel)).toBeNull();
  });

  it('does not emit an action-message node for an empty message', () => {
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: '',
      layout: {
        primary: [
          {
            key: 'restart',
            label: '重新开始',
            variant: 'primary',
            size: 'lg',
            isEnabled: true,
            onPress: jest.fn(),
          },
        ],
        secondary: [],
        ghost: [],
      },
    };
    const screen = render(
      <RoomBottomActionPanel
        model={model}
        hostManagement={null}
        onOpenHostManagement={jest.fn()}
        styles={styles}
        bottomInset={0}
      />,
    );

    expect(screen.getByText('重新开始')).toBeTruthy();
    expect(screen.queryByTestId(TESTIDS.actionMessage)).toBeNull();
  });

  it('opens Host management from a high-contrast preview entry without executing a command', () => {
    const openHostManagement = jest.fn();
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: null,
      layout: {
        primary: [
          {
            key: 'view-role',
            label: '查看身份',
            variant: 'primary',
            size: 'lg',
            isEnabled: true,
            onPress: jest.fn(),
          },
        ],
        secondary: [],
        ghost: [],
      },
    };
    const screen = render(
      <RoomBottomActionPanel
        model={model}
        hostManagement={{
          preview: '下一步：开始游戏',
          status: '角色确认完成',
          sections: [],
        }}
        onOpenHostManagement={openHostManagement}
        styles={styles}
        bottomInset={0}
      />,
    );

    expect(screen.getByText('下一步：开始游戏')).toBeTruthy();
    expect(screen.getByTestId(TESTIDS.roomHostManagementButton)).toHaveStyle({
      backgroundColor: colors.text,
      borderColor: colors.text,
    });
    expect(screen.getByText('主持管理')).toHaveStyle({ color: colors.textInverse });
    fireEvent.press(screen.getByLabelText('主持管理，下一步：开始游戏'));
    expect(openHostManagement).toHaveBeenCalledTimes(1);
  });

  it('keeps the Host player action when management occupies the dock tool slot', () => {
    const openPlayerAction = jest.fn();
    const openHostManagement = jest.fn();
    const trailingAction = jest.fn();
    const model: RoomBottomActionModel = {
      kind: 'dock',
      message: null,
      leading: null,
      primary: {
        key: 'sheriff-action',
        label: '我要竞选',
        variant: 'primary',
        size: 'lg',
        testID: 'sheriff-player-action',
        isEnabled: true,
        onPress: openPlayerAction,
      },
      trailing: {
        key: 'legacy-host-action',
        label: '推进流程',
        tone: 'default',
        testID: 'legacy-host-action',
        isEnabled: true,
        onPress: trailingAction,
      },
    };
    const screen = render(
      <RoomBottomActionPanel
        model={model}
        hostManagement={{ preview: '待处理：结束报名', status: null, sections: [] }}
        onOpenHostManagement={openHostManagement}
        styles={styles}
        bottomInset={0}
      />,
    );

    fireEvent.press(screen.getByTestId('sheriff-player-action'));
    fireEvent.press(screen.getByTestId(TESTIDS.roomHostManagementButton));
    expect(openPlayerAction).toHaveBeenCalledTimes(1);
    expect(openHostManagement).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('legacy-host-action')).toBeNull();
    expect(trailingAction).not.toHaveBeenCalled();
  });

  it('stacks the primary action above two equally available dock tools', () => {
    const model: RoomBottomActionModel = {
      kind: 'dock',
      message: null,
      leading: {
        key: 'view-role',
        label: '查看身份',
        tone: 'default',
        testID: 'view-role-action',
        isEnabled: true,
        onPress: jest.fn(),
      },
      primary: {
        key: 'sheriff-action',
        label: '选择投票',
        variant: 'primary',
        size: 'lg',
        testID: 'sheriff-player-action',
        isEnabled: true,
        onPress: jest.fn(),
      },
      trailing: {
        key: 'night-review',
        label: '本局复盘',
        tone: 'default',
        testID: 'night-review-action',
        isEnabled: true,
        onPress: jest.fn(),
      },
    };
    const screen = render(
      <RoomBottomActionPanel
        model={model}
        hostManagement={null}
        onOpenHostManagement={jest.fn()}
        styles={styles}
        bottomInset={0}
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveProp('testID', 'sheriff-player-action');
    expect(buttons[1]).toHaveProp('testID', 'view-role-action');
    expect(buttons[2]).toHaveProp('testID', 'night-review-action');
    expect(screen.getByTestId('view-role-action')).toHaveStyle({ alignSelf: 'stretch' });
    expect(screen.getByTestId('night-review-action')).toHaveStyle({ alignSelf: 'stretch' });
  });

  it('keeps the Host review out of the information row and renders management last', () => {
    const screen = render(
      <RoomBottomActionPanel
        model={{
          kind: 'info',
          message: null,
          actions: [
            {
              key: 'view-role',
              label: '查看身份',
              variant: 'secondary',
              size: 'md',
              isEnabled: true,
              onPress: jest.fn(),
            },
          ],
        }}
        hostManagement={{ preview: '可重新开始', status: null, sections: [] }}
        onOpenHostManagement={jest.fn()}
        styles={styles}
        bottomInset={0}
      />,
    );

    expect(screen.getByText('查看身份')).toBeTruthy();
    expect(screen.queryByText('本局复盘')).toBeNull();
    expect(screen.getByTestId(TESTIDS.roomHostManagementButton)).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons.at(-1)?.props.accessibilityLabel).toBe('主持管理，可重新开始');
  });

  it('renders identity and review together for an authorized player', () => {
    const screen = render(
      <RoomBottomActionPanel
        model={{
          kind: 'info',
          message: null,
          actions: [
            {
              key: 'view-role',
              label: '查看身份',
              variant: 'secondary',
              size: 'md',
              isEnabled: true,
              onPress: jest.fn(),
            },
            {
              key: 'night-review',
              label: '本局复盘',
              variant: 'secondary',
              size: 'md',
              isEnabled: true,
              onPress: jest.fn(),
            },
          ],
        }}
        hostManagement={null}
        onOpenHostManagement={jest.fn()}
        styles={styles}
        bottomInset={0}
      />,
    );

    expect(screen.getByText('查看身份')).toBeTruthy();
    expect(screen.getByText('本局复盘')).toBeTruthy();
    expect(screen.queryByTestId(TESTIDS.roomHostManagementButton)).toBeNull();
  });

  it('renders only the review action for a spectator', () => {
    const screen = render(
      <RoomBottomActionPanel
        model={{
          kind: 'info',
          message: null,
          actions: [
            {
              key: 'night-review',
              label: '本局复盘',
              variant: 'secondary',
              size: 'md',
              isEnabled: true,
              onPress: jest.fn(),
            },
          ],
        }}
        hostManagement={null}
        onOpenHostManagement={jest.fn()}
        styles={styles}
        bottomInset={0}
      />,
    );

    expect(screen.getByText('本局复盘')).toBeTruthy();
    expect(screen.queryByText('查看身份')).toBeNull();
    expect(screen.queryByTestId(TESTIDS.roomHostManagementButton)).toBeNull();
  });
});
