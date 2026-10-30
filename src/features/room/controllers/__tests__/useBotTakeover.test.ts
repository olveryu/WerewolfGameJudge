/**
 * useBotTakeover: the one bot-takeover assembly. Host-only capability,
 * effective seat widening, long-press toggle, and the lifecycle guard
 * releasing control when the seat stops being a bot or the viewer stops
 * being host.
 */
import { act, renderHook } from '@testing-library/react-native';

import type { RoomViewer } from '@/features/room/model/RoomViewer';

import { useBotTakeover } from '../useBotTakeover';

const host: RoomViewer = { userId: 'host', isHost: true, seat: 0 };
const guest: RoomViewer = { userId: 'guest', isHost: false, seat: 1 };

describe('useBotTakeover', () => {
  it('starts as oneself and widens the effective seat on takeover', () => {
    const { result } = renderHook(() =>
      useBotTakeover({ viewer: host, isBotSeat: (seat) => seat === 2, gameName: 'Test' }),
    );
    expect(result.current.controlledSeat).toBeNull();
    expect(result.current.effectiveSeat).toBe(0);
    expect(result.current.isDelegating).toBe(false);
    expect(result.current.capability.isAllowed).toBe(true);

    act(() => result.current.onBotSeatLongPress(2));
    expect(result.current.controlledSeat).toBe(2);
    expect(result.current.effectiveSeat).toBe(2);
    expect(result.current.isDelegating).toBe(true);

    act(() => result.current.onBotSeatLongPress(2));
    expect(result.current.controlledSeat).toBeNull();
    expect(result.current.effectiveSeat).toBe(0);
  });

  it('denies non-hosts with the shared reason and fails fast on a long-press', () => {
    const { result } = renderHook(() =>
      useBotTakeover({ viewer: guest, isBotSeat: () => true, gameName: 'Test' }),
    );
    expect(result.current.capability).toEqual({
      isAllowed: false,
      reason: '只有房主可以接管机器人',
    });
    expect(() => result.current.onBotSeatLongPress(2)).toThrow(
      '[FAIL-FAST] Test bot takeover not allowed: 只有房主可以接管机器人',
    );
  });

  it('fails fast on a long-press of a non-bot seat', () => {
    const { result } = renderHook(() =>
      useBotTakeover({ viewer: host, isBotSeat: () => false, gameName: 'Test' }),
    );
    expect(() => result.current.onBotSeatLongPress(1)).toThrow(
      '[FAIL-FAST] Test bot takeover received non-bot seat 1',
    );
  });

  it('releases control when the controlled seat stops being a bot', () => {
    let botSeats = new Set([2]);
    const { result, rerender } = renderHook(() =>
      useBotTakeover({ viewer: host, isBotSeat: (seat) => botSeats.has(seat), gameName: 'Test' }),
    );
    act(() => result.current.takeOver(2));
    expect(result.current.controlledSeat).toBe(2);

    botSeats = new Set();
    rerender(undefined);
    expect(result.current.controlledSeat).toBeNull();
  });

  it('releases control when the viewer stops being host', () => {
    let viewer = host;
    const { result, rerender } = renderHook(() =>
      useBotTakeover({ viewer, isBotSeat: () => true, gameName: 'Test' }),
    );
    act(() => result.current.takeOver(2));
    viewer = { ...host, isHost: false };
    rerender(undefined);
    expect(result.current.controlledSeat).toBeNull();
    expect(result.current.capability.isAllowed).toBe(false);
  });
});
