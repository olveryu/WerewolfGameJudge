import { act, renderHook } from '@testing-library/react-native';

import { useRoomBotControl } from '../useRoomBotControl';

describe('useRoomBotControl', () => {
  it('toggles a valid bot seat and updates effectiveSeat', () => {
    const { result } = renderHook(() =>
      useRoomBotControl({
        enabled: true,
        mySeat: 0,
        isBotSeat: (seat) => seat === 2,
      }),
    );

    act(() => {
      expect(result.current.toggleControlledSeat(2)).toEqual({ kind: 'controlled', seat: 2 });
    });
    expect(result.current.activeControlledSeat).toBe(2);
    expect(result.current.effectiveSeat).toBe(2);

    act(() => {
      expect(result.current.toggleControlledSeat(2)).toEqual({ kind: 'released', seat: 2 });
    });
    expect(result.current.activeControlledSeat).toBeNull();
    expect(result.current.effectiveSeat).toBe(0);
  });

  it('rejects non-bot seats', () => {
    const { result } = renderHook(() =>
      useRoomBotControl({
        enabled: true,
        mySeat: 0,
        isBotSeat: (seat) => seat === 2,
      }),
    );

    act(() => {
      expect(result.current.toggleControlledSeat(1)).toEqual({ kind: 'invalid_target' });
    });
    expect(result.current.activeControlledSeat).toBeNull();
  });

  it('clears control when bot control becomes disabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useRoomBotControl({
          enabled,
          mySeat: 0,
          isBotSeat: (seat) => seat === 2,
        }),
      { initialProps: { enabled: true } },
    );

    act(() => {
      result.current.toggleControlledSeat(2);
    });
    expect(result.current.activeControlledSeat).toBe(2);

    rerender({ enabled: false });

    expect(result.current.activeControlledSeat).toBeNull();
    expect(result.current.effectiveSeat).toBe(0);
  });
});
