import { fireEvent, render } from '@testing-library/react-native';

import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import { HeaderActions } from '../HeaderActions';
import { createRoomScreenComponentStyles } from '../styles';

const styles = createRoomScreenComponentStyles(colors).headerActions;

function createProps() {
  return {
    visible: true,
    user: { id: 'user-1', avatarUrl: null },
    showUserSettings: false,
    showShareRoom: false,
    showMusicSettings: false,
    showFillWithBots: false,
    showMarkAllBotsViewed: false,
    showMarkAllBotsGroupConfirmed: false,
    showClearAllSeats: false,
    onFillWithBots: jest.fn(),
    onMarkAllBotsViewed: jest.fn(),
    onMarkAllBotsGroupConfirmed: jest.fn(),
    onClearAllSeats: jest.fn(),
    onMusicSettings: jest.fn(),
    onUserSettings: jest.fn(),
    onShareRoom: jest.fn(),
    styles,
  };
}

describe('HeaderActions', () => {
  it('renders no interactive action when hidden', () => {
    const props = createProps();
    const { queryByTestId, queryByLabelText } = render(
      <HeaderActions {...props} visible={false} showUserSettings />,
    );

    expect(queryByTestId(TESTIDS.roomMenuButton)).toBeNull();
    expect(queryByLabelText('设置')).toBeNull();
  });

  it('renders user settings as a direct avatar when it is the only action', () => {
    const props = createProps();
    const { getByLabelText, queryByTestId } = render(<HeaderActions {...props} showUserSettings />);

    expect(queryByTestId(TESTIDS.roomMenuButton)).toBeNull();
    fireEvent.press(getByLabelText('设置'));
    expect(props.onUserSettings).toHaveBeenCalledTimes(1);
  });

  it('renders the shared actions in a menu without a room-settings item', () => {
    const props = createProps();
    const { getByTestId, getByText, queryByText } = render(
      <HeaderActions {...props} showUserSettings showShareRoom showClearAllSeats />,
    );

    fireEvent.press(getByTestId(TESTIDS.roomMenuButton));

    expect(getByText('分享房间')).toBeTruthy();
    expect(getByText('用户设置')).toBeTruthy();
    expect(getByText('清空座位')).toBeTruthy();
    expect(queryByText('房间设置')).toBeNull();
  });

  it('closes the menu before dispatching its selected action', () => {
    const props = createProps();
    const { getByTestId, getByText, queryByText } = render(
      <HeaderActions {...props} showUserSettings showShareRoom />,
    );

    fireEvent.press(getByTestId(TESTIDS.roomMenuButton));
    fireEvent.press(getByText('分享房间'));

    expect(props.onShareRoom).toHaveBeenCalledTimes(1);
    expect(queryByText('分享房间')).toBeNull();
  });
});
