import type { GameStore } from '@werewolf/game-engine/engine/store';

import { dispatchRoomCommand } from '@/services/facade/roomCommandTransport';
import {
  kickPlayer,
  leaveSeat,
  type SeatActionsContext,
  takeSeat,
} from '@/services/facade/seatActions';

jest.mock('@/services/facade/roomCommandTransport', () => ({
  dispatchRoomCommand: jest.fn(),
}));

const dispatchMock = jest.mocked(dispatchRoomCommand);

function createContext(roomCode: string | null = 'ABCD'): SeatActionsContext {
  return {
    store: {
      getState: jest.fn(() => (roomCode === null ? null : { roomCode })),
      applySnapshot: jest.fn(),
    } as unknown as GameStore,
  };
}

describe('canonical seat command builders', () => {
  beforeEach(() => {
    dispatchMock.mockReset().mockResolvedValue({ success: true });
  });

  it('takes a seat with the canonical profile and no client userId', async () => {
    const ctx = createContext();
    const profile = {
      displayName: 'Alice',
      avatarUrl: 'avatar',
      avatarFrame: 'frame',
      seatFlair: 'flair',
      nameStyle: 'style',
      roleRevealEffect: 'effect',
      seatAnimation: 'animation',
      level: 8,
    };

    await takeSeat(ctx, 2, profile);

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        roomCode: 'ABCD',
        command: { type: 'room.seat.take', seat: 2, profile },
        controlledSeat: null,
      }),
    );
    const command = dispatchMock.mock.calls[0]?.[0].command;
    expect(command).not.toHaveProperty('userId');
    expect(command).not.toHaveProperty('role');
  });

  it('uses canonical leave and kick commands', async () => {
    const ctx = createContext();

    await leaveSeat(ctx);
    expect(dispatchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ command: { type: 'room.seat.leave' }, controlledSeat: null }),
    );

    await kickPlayer(ctx, 3);
    expect(dispatchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        command: { type: 'room.seat.kick', seat: 3 },
        controlledSeat: null,
      }),
    );
  });

  it('returns NOT_CONNECTED without dispatching when state is absent', async () => {
    const ctx = createContext(null);

    await expect(leaveSeat(ctx)).resolves.toEqual({
      success: false,
      reason: 'NOT_CONNECTED',
    });
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
