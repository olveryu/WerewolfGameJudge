import { act, renderHook } from '@testing-library/react-native';

import { useSeatPicking, type UseSeatPickingParams } from '../useSeatPicking';

const toggleParams: UseSeatPickingParams = {
  active: true,
  mode: 'toggle',
  eligibleSeats: [0, 1, 2],
  maxSize: 2,
  storage: { kind: 'local' },
};

describe('useSeatPicking', () => {
  it('falls through while inactive and consumes taps while active', () => {
    const { result, rerender } = renderHook(
      (props: UseSeatPickingParams) => useSeatPicking(props),
      {
        initialProps: { ...toggleParams, active: false },
      },
    );
    expect(result.current.handleSeatTap(1)).toBe(false);
    expect(result.current.selection).toEqual([]);
    rerender({ ...toggleParams, active: true });
    let consumed = false;
    act(() => {
      consumed = result.current.handleSeatTap(1);
    });
    expect(consumed).toBe(true);
    expect(result.current.selection).toEqual([1]);
  });

  it('toggles locally and silently caps at maxSize', () => {
    const { result } = renderHook(() => useSeatPicking(toggleParams));
    act(() => {
      result.current.handleSeatTap(0);
      result.current.handleSeatTap(1);
    });
    expect(result.current.selection).toEqual([0, 1]);
    let consumed = false;
    act(() => {
      consumed = result.current.handleSeatTap(2);
    });
    expect(consumed).toBe(true);
    expect(result.current.selection).toEqual([0, 1]);
    act(() => {
      result.current.handleSeatTap(1);
    });
    expect(result.current.selection).toEqual([0]);
  });

  it('resets the local selection when the anchor changes and on reset()', () => {
    const { result, rerender } = renderHook(
      (props: UseSeatPickingParams) => useSeatPicking(props),
      { initialProps: { ...toggleParams, anchorKey: 'round-1' } },
    );
    act(() => {
      result.current.handleSeatTap(2);
    });
    expect(result.current.selection).toEqual([2]);
    rerender({ ...toggleParams, anchorKey: 'round-2' });
    expect(result.current.selection).toEqual([]);
    act(() => {
      result.current.handleSeatTap(0);
      result.current.reset();
    });
    expect(result.current.selection).toEqual([]);
  });

  it('delegates room storage: reads the projected selection, reports the next one', () => {
    const onSelectionChange = jest.fn();
    const { result } = renderHook(() =>
      useSeatPicking({
        active: true,
        mode: 'toggle',
        eligibleSeats: [0, 1, 2],
        maxSize: 2,
        storage: { kind: 'room', selection: [2], onSelectionChange },
      }),
    );
    expect(result.current.selection).toEqual([2]);
    act(() => {
      result.current.handleSeatTap(2);
    });
    expect(onSelectionChange).toHaveBeenCalledWith([]);
    // The tap lands on the optimistic mirror at once: the exposed
    // selection is the reported next set, not the stale projection.
    expect(result.current.selection).toEqual([]);
  });

  it('trigger mode reports the pick through onPick and stores nothing', () => {
    const onPick = jest.fn();
    const { result } = renderHook(() =>
      useSeatPicking({
        active: true,
        mode: 'trigger',
        eligibleSeats: [1, 3],
        storage: { kind: 'local' },
        onPick,
      }),
    );
    let consumed = false;
    act(() => {
      consumed = result.current.handleSeatTap(3);
    });
    expect(consumed).toBe(true);
    expect(onPick).toHaveBeenCalledWith(3);
    expect(result.current.selection).toEqual([]);
    expect(result.current.handleSeatTap(2)).toBe(false);
  });
});

interface RoomPickingProps {
  readonly projection: readonly number[];
  readonly onSelectionChange?: (nextSelection: readonly number[]) => void | Promise<boolean>;
  readonly onMirrorChange?: (mirror: readonly number[] | null) => void;
  readonly active?: boolean;
  readonly anchorKey?: string | null;
}

function renderRoomPicking(initialProps: RoomPickingProps) {
  return renderHook(
    (props: RoomPickingProps) =>
      useSeatPicking({
        active: props.active ?? true,
        mode: 'toggle',
        eligibleSeats: [0, 1, 2],
        maxSize: 3,
        anchorKey: props.anchorKey ?? null,
        storage: {
          kind: 'room',
          selection: props.projection,
          onSelectionChange: props.onSelectionChange ?? (() => undefined),
          onMirrorChange: props.onMirrorChange,
        },
      }),
    { initialProps },
  );
}

describe('useSeatPicking room mirror', () => {
  it('shows the pick on the mirror immediately, before any echo', () => {
    const onSelectionChange = jest.fn();
    const { result } = renderRoomPicking({ projection: [], onSelectionChange });
    act(() => {
      result.current.handleSeatTap(1);
    });
    expect(onSelectionChange).toHaveBeenCalledWith([1]);
    expect(result.current.selection).toEqual([1]);
  });

  it('compounds rapid taps on the mirror instead of overwriting each other', () => {
    const { result } = renderRoomPicking({ projection: [] });
    act(() => {
      result.current.handleSeatTap(0);
    });
    // No echo yet: the second tap must build on the mirrored [0],
    // not on the stale projection (which would drop the first pick).
    act(() => {
      result.current.handleSeatTap(2);
    });
    expect(result.current.selection).toEqual([0, 2]);
    act(() => {
      result.current.handleSeatTap(0);
    });
    expect(result.current.selection).toEqual([2]);
  });

  it('retires the mirror when the echo catches up, then follows the projection', () => {
    const { result, rerender } = renderRoomPicking({ projection: [] });
    act(() => {
      result.current.handleSeatTap(1);
    });
    rerender({ projection: [1] });
    expect(result.current.selection).toEqual([1]);
    // Mirror retired: the next projection change is followed directly
    // instead of being measured against a lingering mirror.
    rerender({ projection: [1, 2] });
    expect(result.current.selection).toEqual([1, 2]);
  });

  it('ignores a stale echo of an earlier sent set while a newer mirror stands', () => {
    const { result, rerender } = renderRoomPicking({ projection: [] });
    act(() => {
      result.current.handleSeatTap(0);
    });
    act(() => {
      result.current.handleSeatTap(1);
    });
    expect(result.current.selection).toEqual([0, 1]);
    // The echo of the first send arrives late; the mirror must stand.
    rerender({ projection: [0] });
    expect(result.current.selection).toEqual([0, 1]);
    // The echo of the latest send retires the mirror.
    rerender({ projection: [0, 1] });
    expect(result.current.selection).toEqual([0, 1]);
    rerender({ projection: [] });
    expect(result.current.selection).toEqual([]);
  });

  it('rolls back to the projection on an external change that matches nothing sent', () => {
    const { result, rerender } = renderRoomPicking({ projection: [] });
    act(() => {
      result.current.handleSeatTap(0);
    });
    expect(result.current.selection).toEqual([0]);
    rerender({ projection: [2] });
    expect(result.current.selection).toEqual([2]);
  });

  it('rolls back when the dispatch reports rejection (resolves false)', async () => {
    const { result } = renderRoomPicking({
      projection: [2],
      onSelectionChange: () => Promise.resolve(false),
    });
    await act(async () => {
      result.current.handleSeatTap(0);
    });
    expect(result.current.selection).toEqual([2]);
  });

  it('rolls back when the dispatch promise rejects', async () => {
    const { result } = renderRoomPicking({
      projection: [2],
      onSelectionChange: () => Promise.reject(new Error('submission already in progress')),
    });
    await act(async () => {
      result.current.handleSeatTap(0);
    });
    expect(result.current.selection).toEqual([2]);
  });

  it('drops the mirror when picking goes inactive and when the anchor changes', () => {
    const { result, rerender } = renderRoomPicking({ projection: [], anchorKey: 'round-1' });
    act(() => {
      result.current.handleSeatTap(1);
    });
    expect(result.current.selection).toEqual([1]);
    rerender({ projection: [], anchorKey: 'round-1', active: false });
    expect(result.current.selection).toEqual([]);
    rerender({ projection: [], anchorKey: 'round-1', active: true });
    act(() => {
      result.current.handleSeatTap(2);
    });
    expect(result.current.selection).toEqual([2]);
    rerender({ projection: [], anchorKey: 'round-2', active: true });
    expect(result.current.selection).toEqual([]);
  });

  it('notifies the mirror observer when the mirror is set and when it clears', () => {
    const onMirrorChange = jest.fn();
    const { result, rerender } = renderRoomPicking({ projection: [], onMirrorChange });
    act(() => {
      result.current.handleSeatTap(1);
    });
    expect(onMirrorChange).toHaveBeenCalledWith([1]);
    rerender({ projection: [1], onMirrorChange });
    expect(onMirrorChange).toHaveBeenLastCalledWith(null);
  });
});
