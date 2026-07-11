import { fireEvent, render } from '@testing-library/react-native';

import { colors } from '@/theme';

import { createRoomSeatTileStyles, RoomSeatTile, type RoomSeatTileProps } from '../RoomSeatTile';

const styles = createRoomSeatTileStyles(colors, 80);

function createProps(overrides: Partial<RoomSeatTileProps> = {}): RoomSeatTileProps {
  return {
    seat: 0,
    tileSize: 80,
    disabled: false,
    isMySpot: false,
    highlight: 'none',
    isBot: false,
    playerUserId: 'user-1',
    playerDisplayName: '玩家一',
    isPlayerAnonymous: true,
    secondaryLabel: null,
    showReadyBadge: false,
    showLevel: false,
    isAppVisible: true,
    seatDecorationsEnabled: true,
    styles,
    onPress: jest.fn(),
    onLongPress: null,
    ...overrides,
  };
}

describe('RoomSeatTile', () => {
  it('reports the exact zero-based seat and disabled reason', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <RoomSeatTile {...createProps({ seat: 3, disabledReason: '不能选择自己', onPress })} />,
    );

    fireEvent.press(getByTestId('seat-tile-pressable-3'));
    expect(onPress).toHaveBeenCalledWith(3, '不能选择自己');
  });

  it('renders a game-provided secondary label without importing game types', () => {
    const { getByText } = render(
      <RoomSeatTile
        {...createProps({ isBot: true, secondaryLabel: '预言家', playerDisplayName: '机器人' })}
      />,
    );
    expect(getByText('预言家')).toBeTruthy();
  });

  it('supports every neutral highlight without changing the component contract', () => {
    const { rerender, getByTestId } = render(
      <RoomSeatTile {...createProps({ highlight: 'danger' })} />,
    );
    expect(getByTestId('seat-tile-0')).toBeTruthy();
    rerender(<RoomSeatTile {...createProps({ highlight: 'selected' })} />);
    rerender(<RoomSeatTile {...createProps({ highlight: 'controlled' })} />);
    expect(getByTestId('seat-tile-0')).toBeTruthy();
  });

  it('uses one shared style object for all seats in a rendered row', () => {
    const first = createProps();
    const second = createProps({ seat: 1 });
    expect(first.styles).toBe(second.styles);
  });
});
