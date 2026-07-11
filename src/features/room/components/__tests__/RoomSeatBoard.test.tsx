import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';

import { RoomSeatBoard } from '../RoomSeatBoard';

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
    onSeatLongPress: null,
  };
}

describe('RoomSeatBoard', () => {
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
