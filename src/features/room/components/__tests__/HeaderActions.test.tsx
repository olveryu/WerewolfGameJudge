import { fireEvent, render } from '@testing-library/react-native';

import type { RoomHeaderMenuItem } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import { RoomHeaderActions } from '../RoomHeaderActions';
import { createRoomFeatureStyles } from '../styles';

const styles = createRoomFeatureStyles(colors).headerActions;

describe('RoomHeaderActions', () => {
  it('renders a stable placeholder when there are no actions', () => {
    const { queryByTestId } = render(
      <RoomHeaderActions userAction={null} items={[]} styles={styles} />,
    );
    expect(queryByTestId(TESTIDS.roomMenuButton)).toBeNull();
  });

  it('renders user settings directly when it is the only action', () => {
    const onPress = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <RoomHeaderActions
        userAction={{ user: { id: 'user-1', avatarUrl: null }, ticketCount: null, onPress }}
        items={[]}
        styles={styles}
      />,
    );

    expect(queryByTestId(TESTIDS.roomMenuButton)).toBeNull();
    fireEvent.press(getByTestId(TESTIDS.roomUserSettingsButton));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('opens user settings from the shared room menu when utility actions exist', () => {
    const onPress = jest.fn();
    const item: RoomHeaderMenuItem = {
      id: 'share',
      label: '分享房间',
      icon: 'share-outline',
      group: 'utility',
      tone: 'default',
      onPress: jest.fn(),
    };
    const { getByTestId } = render(
      <RoomHeaderActions
        userAction={{ user: null, ticketCount: null, onPress }}
        items={[item]}
        styles={styles}
      />,
    );

    fireEvent.press(getByTestId(TESTIDS.roomMenuButton));
    fireEvent.press(getByTestId(TESTIDS.roomUserSettingsButton));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('groups utility and destructive operations without inventing room settings', () => {
    const items: readonly RoomHeaderMenuItem[] = [
      {
        id: 'share',
        label: '分享房间',
        icon: 'share-outline',
        group: 'utility',
        tone: 'default',
        onPress: jest.fn(),
      },
      {
        id: 'clear',
        label: '清空座位',
        icon: 'exit-outline',
        group: 'operation',
        tone: 'danger',
        onPress: jest.fn(),
      },
    ];
    const { getByTestId, getByText, queryByText } = render(
      <RoomHeaderActions userAction={null} items={items} styles={styles} />,
    );

    fireEvent.press(getByTestId(TESTIDS.roomMenuButton));
    expect(getByText('分享房间')).toBeTruthy();
    expect(getByText('清空座位')).toBeTruthy();
    expect(queryByText('房间设置')).toBeNull();
  });

  it('closes the menu before dispatching an item', () => {
    const onPress = jest.fn();
    const item: RoomHeaderMenuItem = {
      id: 'share',
      label: '分享房间',
      icon: 'share-outline',
      group: 'utility',
      tone: 'default',
      onPress,
    };
    const { getByTestId, getByText, queryByText } = render(
      <RoomHeaderActions userAction={null} items={[item]} styles={styles} />,
    );

    fireEvent.press(getByTestId(TESTIDS.roomMenuButton));
    fireEvent.press(getByText('分享房间'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(queryByText('分享房间')).toBeNull();
  });
});
