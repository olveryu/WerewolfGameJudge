import { fireEvent, render } from '@testing-library/react-native';

import { TESTIDS } from '@/testids';
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
    playerAvatarSeed: 'user-1',
    isPlayerOffline: false,
    playerDisplayName: '玩家一',
    isPlayerAnonymous: true,
    secondaryLabel: null,
    showReadyBadge: false,
    statusBadge: null,
    indicators: null,
    isStatusEmphasized: false,
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
  it('keeps identities, selection and progress independent of bot control', () => {
    const onPress = jest.fn();
    const props = createProps({
      highlight: 'controlled',
      onPress,
      indicators: {
        selection: { kind: 'selected', label: '队员' },
        markers: [
          {
            key: 'leader',
            label: '组队者',
            tone: 'warning',
          },
          { key: 'lady', label: '湖仙', tone: 'info' },
        ],
        progressLabel: '已投票',
      },
    });
    const screen = render(<RoomSeatTile {...props} />);
    expect(screen.queryByTestId('seat-selection-0')).toBeNull();
    expect(screen.getByTestId('seat-tile-pressable-0')).toHaveStyle(styles.controlledRing);
    expect(screen.getByTestId('seat-tile-pressable-0')).toHaveProp('accessibilityState', {
      selected: true,
    });
    expect(screen.getByTestId('seat-progress-0')).toHaveTextContent(/已投票/);
    expect(screen.getByTestId('seat-progress-0')).toHaveTextContent(/队员/);
    expect(screen.getByTestId('seat-progress-0')).toHaveStyle({ flexDirection: 'row' });
    expect(styles.progressRows).not.toHaveProperty('height');
    expect(screen.queryByTestId('seat-status-badge-0')).toBeNull();
    expect(screen.getByText('组队者')).toBeTruthy();
    expect(screen.getByText('湖仙')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('seat-tile-pressable-0')).toContainElement(
      screen.getByTestId('seat-marker-0-lady'),
    );
    fireEvent.press(screen.getByTestId('seat-tile-pressable-0'));
    expect(onPress).toHaveBeenCalledWith(0, undefined);

    screen.rerender(
      <RoomSeatTile
        {...props}
        indicators={{
          selection: { kind: 'preselected', label: '预选' },
          markers: [],
          progressLabel: null,
        }}
      />,
    );
    expect(screen.queryByTestId('seat-selection-0')).toBeNull();
    expect(screen.getByText('预选')).toBeTruthy();
    expect(screen.getByTestId('seat-tile-pressable-0')).toHaveProp('accessibilityState', {
      selected: false,
    });
  });

  it('does not reserve metadata space when there are no indicators to display', () => {
    const screen = render(
      <RoomSeatTile
        {...createProps({ indicators: { markers: [], selection: null, progressLabel: null } })}
      />,
    );
    expect(screen.queryByTestId('seat-progress-0')).toBeNull();
  });

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

  it('renders a semantic status badge without replacing the seat highlight', () => {
    const screen = render(
      <RoomSeatTile
        {...createProps({
          highlight: 'danger',
          statusBadge: { label: '发言', tone: 'info' },
          isStatusEmphasized: true,
        })}
      />,
    );

    expect(screen.getByTestId('seat-status-badge-0')).toHaveTextContent('发言');
    expect(screen.getByTestId('seat-tile-pressable-0')).toHaveStyle(styles.dangerRing);
  });

  it('marks a human seat whose user has no open room socket as offline', () => {
    const offline = render(<RoomSeatTile {...createProps({ isPlayerOffline: true })} />);
    expect(offline.getByTestId(TESTIDS.seatOfflineIndicator(0))).toBeTruthy();
    expect(offline.getByText(/玩家一/)).toHaveStyle(styles.playerNameOffline);

    const online = render(<RoomSeatTile {...createProps({ isPlayerOffline: false })} />);
    expect(online.queryByTestId(TESTIDS.seatOfflineIndicator(0))).toBeNull();
    expect(online.getByText('玩家一')).toHaveStyle(styles.playerName);

    const empty = render(
      <RoomSeatTile {...createProps({ playerAvatarSeed: null, isPlayerOffline: true })} />,
    );
    expect(empty.queryByTestId(TESTIDS.seatOfflineIndicator(0))).toBeNull();
  });
});
