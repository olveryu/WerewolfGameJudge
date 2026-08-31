import { fireEvent, render } from '@testing-library/react-native';

import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import { RoomHeaderActions } from '../RoomHeaderActions';
import { createRoomFeatureStyles } from '../styles';

const styles = createRoomFeatureStyles(colors).headerActions;

describe('RoomHeaderActions', () => {
  it('renders a stable placeholder when there are no actions', () => {
    const { queryByTestId } = render(<RoomHeaderActions userAction={null} styles={styles} />);
    expect(queryByTestId(TESTIDS.roomUserSettingsButton)).toBeNull();
  });

  it('renders user settings directly when it is the only action', () => {
    const onPress = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <RoomHeaderActions
        userAction={{ user: { id: 'user-1', avatarUrl: null }, ticketCount: null, onPress }}
        styles={styles}
      />,
    );

    expect(queryByTestId(TESTIDS.roomUserSettingsButton)).not.toBeNull();
    fireEvent.press(getByTestId(TESTIDS.roomUserSettingsButton));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
