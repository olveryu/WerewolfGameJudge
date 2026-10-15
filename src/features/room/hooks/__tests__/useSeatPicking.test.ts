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
    // No optimistic local copy: the exposed selection is still the projection.
    expect(result.current.selection).toEqual([2]);
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
