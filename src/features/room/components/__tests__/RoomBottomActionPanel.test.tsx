import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { RoomBottomActionModel } from '@/features/room/model/RoomBottomActions';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import { RoomBottomActionPanel } from '../RoomBottomActionPanel';
import { createRoomFeatureStyles } from '../styles';

const featureStyles = createRoomFeatureStyles(colors);
const styles = featureStyles.bottomActionPanel;
const progressStyles = featureStyles.progressIndicator;

function renderPanel(
  model: RoomBottomActionModel,
  hostManagement: RoomHostManagementModel | null = null,
  onOpenHostManagement: () => void = jest.fn(),
) {
  return render(
    <RoomBottomActionPanel
      model={model}
      hostManagement={hostManagement}
      onOpenHostManagement={onOpenHostManagement}
      styles={styles}
      progressStyles={progressStyles}
      bottomInset={0}
    />,
  );
}

function hostModelWith(actions: RoomHostManagementAction[]): RoomHostManagementModel {
  return { sections: [{ key: 'game', title: '游戏', actions }] };
}

const emptyStackedModel: RoomBottomActionModel = {
  kind: 'stacked',
  message: null,
  progress: null,
  layout: { primary: [], secondary: [], ghost: [] },
};

describe('RoomBottomActionPanel', () => {
  it('renders game-provided message and dispatches an enabled action', () => {
    const onPress = jest.fn();
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: '请选择目标',
      progress: null,
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
    const { getByText, getByTestId } = renderPanel(model);

    expect(getByTestId(TESTIDS.actionMessage)).toBeTruthy();
    fireEvent.press(getByText('确认'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the step progress row for stepped phases', () => {
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: null,
      progress: { current: 2, total: 5, label: '狼人请行动' },
      layout: { primary: [], secondary: [], ghost: [] },
    };
    const { getByTestId, getByText } = renderPanel(model);

    expect(getByTestId(TESTIDS.roomProgressIndicator)).toBeTruthy();
    expect(getByText('第2步 / 共5步')).toBeTruthy();
    expect(getByText('狼人请行动')).toBeTruthy();
  });

  it('keeps progress and message rendered in compact-height mode', () => {
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: '等待其他玩家',
      progress: { current: 2, total: 5, label: '狼人请行动' },
      layout: { primary: [], secondary: [], ghost: [] },
    };
    const { getByTestId, getByText } = render(
      <RoomBottomActionPanel
        model={model}
        hostManagement={null}
        onOpenHostManagement={jest.fn()}
        styles={styles}
        progressStyles={progressStyles}
        bottomInset={0}
        isCompactHeight
      />,
    );

    expect(getByTestId(TESTIDS.roomProgressIndicator)).toBeTruthy();
    expect(getByTestId(TESTIDS.actionMessage)).toBeTruthy();
    expect(getByText('等待其他玩家')).toBeTruthy();
  });

  it('does not expose a mutation callback for a disabled display action', () => {
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: null,
      progress: null,
      layout: {
        primary: [
          {
            key: 'waiting',
            label: '等待房主开始',
            variant: 'primary',
            size: 'lg',
            isEnabled: false,
            disabledReason: null,
          },
        ],
        secondary: [],
        ghost: [],
      },
    };
    const { getByText } = renderPanel(model);
    fireEvent.press(getByText('等待房主开始'));
  });

  it('renders the disabled reason as a caption under the button and nothing on press', () => {
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: null,
      progress: null,
      layout: {
        primary: [
          {
            key: 'waiting',
            label: '等待房主开始',
            variant: 'primary',
            size: 'lg',
            isEnabled: false,
            disabledReason: '等待房主开始',
          },
        ],
        secondary: [],
        ghost: [],
      },
    };
    const { getAllByText } = renderPanel(model);
    // The disabled reason renders again as the caption under the button.
    const matches = getAllByText('等待房主开始');
    expect(matches).toHaveLength(2);
    const buttonLabel = matches[0];
    if (buttonLabel === undefined) throw new Error('expected the disabled button label');
    fireEvent.press(buttonLabel);
  });

  it('does not render an empty model', () => {
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: null,
      progress: null,
      layout: { primary: [], secondary: [], ghost: [] },
    };
    const { queryByTestId } = renderPanel(model);
    expect(queryByTestId(TESTIDS.bottomActionPanel)).toBeNull();
  });

  it('renders a spectator waiting message without an inert action button', () => {
    const screen = renderPanel({
      kind: 'dock',
      message: '等待投票完成',
      progress: null,
      leading: null,
      primary: null,
      trailing: null,
    });

    expect(screen.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('等待投票完成');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('does not emit an action-message node for an empty message', () => {
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: '',
      progress: null,
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
    const screen = renderPanel(model);

    expect(screen.getByText('重新开始')).toBeTruthy();
    expect(screen.queryByTestId(TESTIDS.actionMessage)).toBeNull();
  });

  it('opens Host management from a neutral entry without executing a command', () => {
    const openHostManagement = jest.fn();
    const model: RoomBottomActionModel = {
      kind: 'stacked',
      message: null,
      progress: null,
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
    const screen = renderPanel(model, { sections: [] }, openHostManagement);

    expect(screen.getByText('全部操作')).toBeTruthy();
    expect(screen.getByTestId(TESTIDS.roomHostManagementButton)).toHaveStyle({
      backgroundColor: colors.surfaceHover,
      borderColor: colors.border,
    });
    expect(screen.getByText('主持管理')).toHaveStyle({ color: colors.textSecondary });
    fireEvent.press(screen.getByLabelText('主持管理'));
    expect(openHostManagement).toHaveBeenCalledTimes(1);
  });

  it('marks the entry as pending when the model carries a pending action', () => {
    const screen = renderPanel(emptyStackedModel, { hasPendingAction: true, sections: [] });

    expect(screen.getByText('待处理')).toBeTruthy();
  });

  it('keeps the Host player action when management occupies the dock tool slot', () => {
    const openPlayerAction = jest.fn();
    const openHostManagement = jest.fn();
    const trailingAction = jest.fn();
    const model: RoomBottomActionModel = {
      kind: 'dock',
      message: null,
      progress: null,
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
    const screen = renderPanel(model, { hasPendingAction: true, sections: [] }, openHostManagement);

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
      progress: null,
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
    const screen = renderPanel(model);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveProp('testID', 'sheriff-player-action');
    expect(buttons[1]).toHaveProp('testID', 'view-role-action');
    expect(buttons[2]).toHaveProp('testID', 'night-review-action');
    expect(screen.getByTestId('view-role-action')).toHaveStyle({ alignSelf: 'stretch' });
    expect(screen.getByTestId('night-review-action')).toHaveStyle({ alignSelf: 'stretch' });
  });

  it('renders the disabled reason as a caption under a disabled dock tool', () => {
    const model: RoomBottomActionModel = {
      kind: 'dock',
      message: null,
      progress: null,
      leading: {
        key: 'view-role',
        label: '查看身份',
        tone: 'default',
        testID: 'view-role-action',
        isEnabled: false,
        disabledReason: '夜晚阶段不可查看',
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
      trailing: null,
    };
    const screen = renderPanel(model);

    expect(screen.getByText('夜晚阶段不可查看')).toBeTruthy();
  });

  it('keeps the Host review out of the ghost row and renders management last', () => {
    const screen = renderPanel(
      {
        kind: 'stacked',
        message: null,
        progress: null,
        layout: {
          primary: [],
          secondary: [],
          ghost: [
            {
              key: 'view-role',
              label: '查看身份',
              variant: 'ghost',
              size: 'md',
              isEnabled: true,
              onPress: jest.fn(),
            },
          ],
        },
      },
      { sections: [] },
    );

    expect(screen.getByText('查看身份')).toBeTruthy();
    expect(screen.queryByText('本局复盘')).toBeNull();
    expect(screen.getByTestId(TESTIDS.roomHostManagementButton)).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons.at(-1)?.props.accessibilityLabel).toBe('主持管理');
  });

  it('renders identity and review together for an authorized player', () => {
    const screen = renderPanel({
      kind: 'stacked',
      message: null,
      progress: null,
      layout: {
        primary: [],
        secondary: [
          {
            key: 'night-review',
            label: '本局复盘',
            variant: 'secondary',
            size: 'md',
            isEnabled: true,
            onPress: jest.fn(),
          },
        ],
        ghost: [
          {
            key: 'view-role',
            label: '查看身份',
            variant: 'ghost',
            size: 'md',
            isEnabled: true,
            onPress: jest.fn(),
          },
        ],
      },
    });

    expect(screen.getByText('查看身份')).toBeTruthy();
    expect(screen.getByText('本局复盘')).toBeTruthy();
    expect(screen.queryByTestId(TESTIDS.roomHostManagementButton)).toBeNull();
  });

  it('renders only the review action for a spectator', () => {
    const screen = renderPanel({
      kind: 'stacked',
      message: null,
      progress: null,
      layout: {
        primary: [],
        secondary: [
          {
            key: 'night-review',
            label: '本局复盘',
            variant: 'secondary',
            size: 'md',
            isEnabled: true,
            onPress: jest.fn(),
          },
        ],
        ghost: [],
      },
    });

    expect(screen.getByText('本局复盘')).toBeTruthy();
    expect(screen.queryByText('查看身份')).toBeNull();
    expect(screen.queryByTestId(TESTIDS.roomHostManagementButton)).toBeNull();
  });

  describe('host console primary', () => {
    it('keeps the player command prominent and host advancement available', () => {
      const onPlayerPress = jest.fn();
      const onHostPress = jest.fn();
      const screen = renderPanel(
        {
          ...emptyStackedModel,
          layout: {
            primary: [
              {
                key: 'submit',
                label: '提交答案',
                variant: 'primary',
                size: 'md',
                isEnabled: true,
                onPress: onPlayerPress,
              },
            ],
            secondary: [],
            ghost: [],
          },
        },
        hostModelWith([
          {
            key: 'advance',
            label: '结束作答',
            icon: 'arrow-forward',
            variant: 'primary',
            isPrimary: true,
            isEnabled: true,
            onPress: onHostPress,
          },
        ]),
      );

      expect(screen.getByTestId(TESTIDS.roomNextStepButton)).toHaveStyle({
        backgroundColor: colors.surfaceHover,
      });
      fireEvent.press(screen.getByLabelText('提交答案'));
      fireEvent.press(screen.getByLabelText('结束作答'));
      expect(onPlayerPress).toHaveBeenCalledTimes(1);
      expect(onHostPress).toHaveBeenCalledTimes(1);
    });

    it('runs the ready primary through the action’s own onPress', () => {
      const onPress = jest.fn();
      const screen = renderPanel(
        emptyStackedModel,
        hostModelWith([
          {
            key: 'start-game',
            label: '开始游戏',
            icon: 'play-outline',
            variant: 'primary',
            isEnabled: true,
            onPress,
            isPrimary: true,
          },
        ]),
      );
      const strip = screen.getByTestId(TESTIDS.roomNextStepButton);
      expect(strip.props.accessibilityLabel).toBe('开始游戏');
      fireEvent.press(strip);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('shows the blocked reason on the console and runs the remedy from its button', () => {
      const onRemedy = jest.fn();
      const screen = renderPanel(
        emptyStackedModel,
        hostModelWith([
          {
            key: 'start-game',
            label: '分配角色',
            icon: 'play-outline',
            variant: 'primary',
            isEnabled: false,
            disabledReason: '座位尚未坐满（还差 2 人）',
            isPrimary: true,
            remedy: { label: '分享房间', onPress: onRemedy },
          },
        ]),
      );
      expect(screen.getByText('分配角色')).toBeTruthy();
      expect(screen.getByText('座位尚未坐满（还差 2 人）')).toBeTruthy();
      fireEvent.press(screen.getByTestId(TESTIDS.roomNextStepRemedyButton));
      expect(onRemedy).toHaveBeenCalledTimes(1);
    });

    it('renders the console blocked while the primary stays enabled behind a console-only reason', () => {
      const screen = renderPanel(
        emptyStackedModel,
        hostModelWith([
          {
            key: 'prepare-to-flip',
            label: '翻牌分配身份',
            icon: 'play-outline',
            variant: 'primary',
            isEnabled: true,
            onPress: jest.fn(),
            isPrimary: true,
            consoleBlockedReason: '还有 2 个空位等待入座',
            remedy: { label: '分享房间', onPress: jest.fn() },
          },
        ]),
      );
      expect(screen.queryByTestId(TESTIDS.roomNextStepButton)).toBeNull();
      expect(screen.getByText('还有 2 个空位等待入座')).toBeTruthy();
      expect(screen.getByTestId(TESTIDS.roomNextStepRemedyButton)).toBeTruthy();
    });

    it('renders no console row when the model carries no primary', () => {
      const screen = renderPanel(emptyStackedModel, { sections: [] });
      expect(screen.queryByTestId(TESTIDS.roomNextStepButton)).toBeNull();
      expect(screen.queryByTestId(TESTIDS.roomNextStepRemedyButton)).toBeNull();
    });

    it('renders no console row for a primary locked by a transient submission', () => {
      const screen = renderPanel(
        emptyStackedModel,
        hostModelWith([
          {
            key: 'start-game',
            label: '开始游戏',
            icon: 'play-outline',
            variant: 'primary',
            isEnabled: false,
            disabledReason: null,
            isPrimary: true,
          },
        ]),
      );
      expect(screen.queryByTestId(TESTIDS.roomNextStepButton)).toBeNull();
      expect(screen.queryByTestId(TESTIDS.roomNextStepRemedyButton)).toBeNull();
    });
  });

  describe('guided step flow', () => {
    const dangerButton = (key: string, label: string, testID: string) => ({
      key,
      label,
      variant: 'danger' as const,
      size: 'md' as const,
      isEnabled: true as const,
      onPress: jest.fn(),
      testID,
    });

    it('renders secondary actions side by side, each flexing to equal width', () => {
      const model: RoomBottomActionModel = {
        kind: 'stacked',
        message: null,
        progress: null,
        layout: {
          primary: [],
          secondary: [
            dangerButton('nextRound', '再来一局', TESTIDS.nextRoundBottomButton),
            dangerButton('returnToLobby', '返回大厅', TESTIDS.returnLobbyBottomButton),
          ],
          ghost: [],
        },
      };
      const { getByTestId } = renderPanel(model);

      for (const testID of [TESTIDS.nextRoundBottomButton, TESTIDS.returnLobbyBottomButton]) {
        const element = getByTestId(testID);
        expect(element).toBeTruthy();
        expect(StyleSheet.flatten(element.props.style)).toMatchObject({ flex: 1 });
      }
    });

    it('renders the step bar in place of the message and wires complete/current presses', () => {
      const onRevisit = jest.fn();
      const onCurrent = jest.fn();
      const model: RoomBottomActionModel = {
        kind: 'stacked',
        message: '不应出现的消息',
        progress: null,
        steps: [
          { key: 'lastNightInfo', label: '昨夜信息', state: 'complete', onPress: onRevisit },
          { key: 'nightReview', label: '本局复盘', state: 'current', onPress: onCurrent },
          { key: 'closing', label: '收尾', state: 'upcoming' },
        ],
        layout: { primary: [], secondary: [], ghost: [] },
      };
      const { getByText, queryByText, queryByTestId } = renderPanel(model);

      expect(queryByTestId(TESTIDS.actionMessage)).toBeNull();
      expect(queryByText('不应出现的消息')).toBeNull();
      expect(getByText('昨夜信息')).toBeTruthy();
      expect(getByText('本局复盘')).toBeTruthy();
      expect(getByText('收尾')).toBeTruthy();

      fireEvent.press(getByText('昨夜信息'));
      expect(onRevisit).toHaveBeenCalledTimes(1);
      fireEvent.press(getByText('本局复盘'));
      expect(onCurrent).toHaveBeenCalledTimes(1);
    });

    it('renders the hint line above the buttons', () => {
      const model: RoomBottomActionModel = {
        kind: 'stacked',
        message: null,
        progress: null,
        steps: [
          { key: 'lastNightInfo', label: '昨夜信息', state: 'complete' },
          { key: 'nightReview', label: '本局复盘', state: 'current' },
          { key: 'closing', label: '收尾', state: 'upcoming' },
        ],
        hint: '记得把复盘分享给第一天出局的玩家',
        layout: { primary: [], secondary: [], ghost: [] },
      };
      const { getByText } = renderPanel(model);
      expect(getByText('记得把复盘分享给第一天出局的玩家')).toBeTruthy();
    });
  });
});
