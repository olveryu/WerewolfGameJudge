import { fireEvent, render } from '@testing-library/react-native';
import { Dimensions, PixelRatio, StyleSheet, View } from 'react-native';

import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';
import { spacing } from '@/theme';

import { RoomSeatBoard } from '../RoomSeatBoard';
import { getGridColumns } from '../RoomSeatTile';

jest.mock('@/components/Avatar', () => ({ Avatar: () => null }));

function emptySeat(seat: number, disabledReason?: string): RoomSeatViewModel {
  return {
    seat,
    player: null,
    isSelf: false,
    highlight: 'none',
    secondaryLabel: null,
    disabledReason,
    showReadyBadge: false,
    badgeText: null,
    showLevel: false,
    decorationsEnabled: false,
  };
}

function createModel(
  source: RoomSeatDataSource,
  onSeatPress: RoomSeatBoardModel['onSeatPress'] = jest.fn(),
  visuallyDisabled = false,
): RoomSeatBoardModel {
  return {
    source,
    visuallyDisabled,
    onSeatPress,
    onBotSeatLongPress: null,
  };
}

describe('RoomSeatBoard', () => {
  it('keeps the Werewolf tile geometry after measuring padded content', async () => {
    const source: RoomSeatDataSource = {
      count: 4,
      revision: 1,
      getSeat: (index) => emptySeat(index),
    };
    const view = render(
      <RoomSeatBoard
        model={createModel(source)}
        header={<View />}
        footer={null}
        contentContainerStyle={styles.content}
      />,
    );
    const contentWidth = Dimensions.get('window').width - spacing.medium * 2;
    const columns = getGridColumns(Dimensions.get('window').width);
    const gap = spacing.small + spacing.tight;
    const pixelRatio = PixelRatio.get();
    const tileSize =
      Math.floor(((contentWidth - gap * (columns - 1)) / columns) * pixelRatio) / pixelRatio;
    const expectedPlayerTileWidth = tileSize - spacing.tight;

    expect(await view.findByTestId(TESTIDS.seatTilePressable(0))).toHaveStyle({
      width: expectedPlayerTileWidth,
    });

    fireEvent(view.getByTestId(TESTIDS.roomSeatContentWidthProbe), 'layout', {
      nativeEvent: { layout: { width: contentWidth, height: 0, x: 0, y: 0 } },
    });

    expect(view.getByTestId(TESTIDS.seatTilePressable(0))).toHaveStyle({
      width: expectedPlayerTileWidth,
    });
  });

  it('reports seat taps even when the tile is visually disabled', async () => {
    const onSeatPress = jest.fn();
    const source: RoomSeatDataSource = {
      count: 1,
      revision: 1,
      getSeat: (index) => emptySeat(index),
    };
    const { findByTestId } = render(
      <RoomSeatBoard
        model={createModel(source, onSeatPress, true)}
        header={<View />}
        footer={null}
        contentContainerStyle={styles.content}
      />,
    );

    fireEvent.press(await findByTestId(TESTIDS.seatTilePressable(0)));
    expect(onSeatPress).toHaveBeenCalledWith(0, undefined);
  });

  it('passes a game-derived disabled reason to the interaction policy', async () => {
    const onSeatPress = jest.fn();
    const source: RoomSeatDataSource = {
      count: 1,
      revision: 1,
      getSeat: (index) => emptySeat(index, '不能选择自己'),
    };
    const { findByTestId } = render(
      <RoomSeatBoard
        model={createModel(source, onSeatPress)}
        header={<View />}
        footer={null}
        contentContainerStyle={styles.content}
      />,
    );

    fireEvent.press(await findByTestId(TESTIDS.seatTilePressable(0)));
    expect(onSeatPress).toHaveBeenCalledWith(0, '不能选择自己');
  });

  it('wires bot takeover only to bot seats', () => {
    const onBotSeatLongPress = jest.fn();
    const source: RoomSeatDataSource = {
      count: 2,
      revision: 1,
      getSeat: (seat) => ({
        ...emptySeat(seat),
        player: {
          kind: seat === 0 ? 'human' : 'bot',
          userId: `user-${seat}`,
          displayName: `玩家${seat + 1}`,
          isAnonymous: true,
        },
      }),
    };
    const view = render(
      <RoomSeatBoard
        model={{ ...createModel(source), onBotSeatLongPress }}
        header={<View />}
        footer={null}
        contentContainerStyle={styles.content}
      />,
    );

    fireEvent(view.getByTestId(TESTIDS.seatTilePressable(0)), 'longPress');
    expect(onBotSeatLongPress).not.toHaveBeenCalled();
    fireEvent(view.getByTestId(TESTIDS.seatTilePressable(1)), 'longPress');
    expect(onBotSeatLongPress).toHaveBeenCalledWith(1);
  });

  it('reads only the rendered window from a large indexed source', async () => {
    const getSeat = jest.fn((index: number) => emptySeat(index));
    const source: RoomSeatDataSource = { count: 10_000, revision: 1, getSeat };
    const { findByTestId } = render(
      <RoomSeatBoard
        model={createModel(source)}
        header={<View />}
        footer={null}
        contentContainerStyle={styles.content}
      />,
    );

    expect(await findByTestId(TESTIDS.seatTilePressable(0))).toBeTruthy();
    expect(getSeat.mock.calls.length).toBeLessThan(source.count);
  });

  it('pages a large source without creating an unbounded scroll surface', async () => {
    const source: RoomSeatDataSource = {
      count: Number.MAX_SAFE_INTEGER,
      revision: 1,
      getSeat: (index) => emptySeat(index),
    };
    const view = render(
      <RoomSeatBoard
        model={createModel(source)}
        header={<View />}
        footer={null}
        contentContainerStyle={styles.content}
      />,
    );

    expect(await view.findByTestId(TESTIDS.roomSeatPagination)).toBeTruthy();
    fireEvent.press(view.getByTestId(TESTIDS.roomSeatNextPage));
    const secondPageFirstSeat = getGridColumns(Dimensions.get('window').width) * 12;
    expect(await view.findByTestId(TESTIDS.seatTilePressable(secondPageFirstSeat))).toBeTruthy();
    expect(view.queryByTestId(TESTIDS.seatTilePressable(0))).toBeNull();
  });

  it('keeps pagination absent for ordinary room sizes', () => {
    const source: RoomSeatDataSource = {
      count: 8,
      revision: 1,
      getSeat: (index) => emptySeat(index),
    };
    const view = render(
      <RoomSeatBoard
        model={createModel(source)}
        header={<View />}
        footer={null}
        contentContainerStyle={styles.content}
      />,
    );

    expect(view.queryByTestId(TESTIDS.roomSeatPagination)).toBeNull();
  });

  it('dispatches through the latest callback without rebuilding rendered seats', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const source: RoomSeatDataSource = {
      count: 1,
      revision: 1,
      getSeat: (index) => emptySeat(index),
    };
    const { findByTestId, rerender } = render(
      <RoomSeatBoard
        model={createModel(source, first)}
        header={<View />}
        footer={null}
        contentContainerStyle={styles.content}
      />,
    );
    rerender(
      <RoomSeatBoard
        model={createModel(source, second)}
        header={<View />}
        footer={null}
        contentContainerStyle={styles.content}
      />,
    );

    fireEvent.press(await findByTestId(TESTIDS.seatTilePressable(0)));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

const styles = StyleSheet.create({ content: { flexGrow: 1 } });
