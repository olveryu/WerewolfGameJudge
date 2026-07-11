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
      <RoomBottomActionPanel model={model} styles={styles} bottomInset={0} />,
    );

    expect(getByTestId(TESTIDS.actionMessage)).toBeTruthy();
    fireEvent.press(getByText('确认'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not expose a mutation callback for a disabled display action', () => {
    const model: RoomBottomActionModel = {
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
      <RoomBottomActionPanel model={model} styles={styles} bottomInset={0} />,
    );
    fireEvent.press(getByText('等待房主开始'));
  });

  it('allows explicit disabled feedback without exposing the enabled action', () => {
    const onDisabledPress = jest.fn();
    const model: RoomBottomActionModel = {
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
      <RoomBottomActionPanel model={model} styles={styles} bottomInset={0} />,
    );
    fireEvent.press(getByText('等待房主开始'));
    expect(onDisabledPress).toHaveBeenCalledTimes(1);
  });

  it('does not render an empty model', () => {
    const model: RoomBottomActionModel = {
      message: null,
      layout: { primary: [], secondary: [], ghost: [] },
    };
    const { queryByTestId } = render(
      <RoomBottomActionPanel model={model} styles={styles} bottomInset={0} />,
    );
    expect(queryByTestId(TESTIDS.bottomActionPanel)).toBeNull();
  });
});
