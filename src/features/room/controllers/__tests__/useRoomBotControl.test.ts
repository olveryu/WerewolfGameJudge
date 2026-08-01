import { act, renderHook } from '@testing-library/react-native';

import { useRoomBotControl } from '@/features/room/controllers/useRoomBotControl';

describe('useRoomBotControl', () => {
  it('takes over, switches, and releases bot seats', () => {
    const { result } = renderHook(() => useRoomBotControl());

    act(() => result.current.takeOver(2));
    expect(result.current.controlledSeat).toBe(2);
    act(() => result.current.takeOver(5));
    expect(result.current.controlledSeat).toBe(5);
    act(() => result.current.release());
    expect(result.current.controlledSeat).toBeNull();
  });

  it('fails fast for invalid takeover and release transitions', () => {
    const { result } = renderHook(() => useRoomBotControl());

    expect(() => result.current.takeOver(-1)).toThrow('non-negative safe integer');
    expect(() => result.current.release()).toThrow('no bot seat is controlled');
  });
});
