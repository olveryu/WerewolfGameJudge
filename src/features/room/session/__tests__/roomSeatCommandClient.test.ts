import type { RoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import {
  clearRoomSeats,
  fillRoomSeatsWithBots,
  kickRoomSeat,
  leaveRoomSeat,
  type RoomSeatCommandContext,
  takeRoomSeat,
} from '@/features/room/session/roomSeatCommandClient';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';

interface TestState {
  readonly gameType: 'werewolf';
  readonly stateVersion: 1;
  readonly roomCode: string;
  readonly hostUserId: string;
}

interface TestProfile {
  readonly displayName: string;
}

const SNAPSHOT = {
  gameType: 'werewolf',
  stateVersion: 1,
  revision: 2,
  state: {
    gameType: 'werewolf',
    stateVersion: 1,
    roomCode: '1234',
    hostUserId: 'host-user',
  },
} satisfies RoomSnapshot<TestState>;

function createContext(outcome: RoomCommandDispatchOutcome<TestState>) {
  type Dispatch = RoomSeatCommandContext<TestState, TestProfile>['dispatch'];
  const dispatch = jest.fn<ReturnType<Dispatch>, Parameters<Dispatch>>().mockResolvedValue(outcome);
  return {
    context: { dispatch },
    dispatch,
  };
}

describe('roomSeatCommandClient', () => {
  it('uses one canonical command vocabulary for every seat operation', async () => {
    const { context, dispatch } = createContext({
      kind: 'decided',
      decision: {
        kind: 'committed',
        commandId: 'command-1',
        snapshot: SNAPSHOT,
        outcome: { kind: 'success' },
      },
    });
    const profile = { displayName: '玩家' };

    await takeRoomSeat(context, 3, profile);
    await leaveRoomSeat(context);
    await kickRoomSeat(context, 4);
    await clearRoomSeats(context);
    await fillRoomSeatsWithBots(context);

    expect(dispatch.mock.calls.map(([command]) => command)).toEqual([
      { type: 'room.seat.take', seat: 3, profile },
      { type: 'room.seat.leave' },
      { type: 'room.seat.kick', seat: 4 },
      { type: 'room.seat.clear' },
      { type: 'room.seat.fillBots' },
    ]);
    expect(dispatch.mock.calls.map(([, options]) => options.controlledSeat)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it.each([
    {
      outcome: { kind: 'notDecided', commandId: 'command-2', reason: 'RATE_LIMITED' } as const,
      expected: {
        success: false,
        failureKind: 'notDecided',
        commandId: 'command-2',
        reason: 'RATE_LIMITED',
      },
    },
    {
      outcome: {
        kind: 'deliveryUnknown',
        commandId: 'command-3',
        reason: 'NETWORK_ERROR',
      } as const,
      expected: {
        success: false,
        failureKind: 'deliveryUnknown',
        commandId: 'command-3',
        reason: 'NETWORK_ERROR',
      },
    },
    {
      outcome: {
        kind: 'decided',
        decision: { kind: 'rejected', commandId: 'command-4', reason: 'NOT_HOST' },
      } as const,
      expected: {
        success: false,
        failureKind: 'rejected',
        commandId: 'command-4',
        reason: 'NOT_HOST',
      },
    },
    {
      outcome: {
        kind: 'decided',
        decision: {
          kind: 'committed',
          commandId: 'command-5',
          snapshot: SNAPSHOT,
          outcome: { kind: 'domainRejected', reason: 'SEAT_OCCUPIED' },
        },
      } as const,
      expected: {
        success: false,
        failureKind: 'rejected',
        commandId: 'command-5',
        reason: 'SEAT_OCCUPIED',
      },
    },
  ])('preserves $outcome.kind failure evidence', async ({ outcome, expected }) => {
    const { context } = createContext(outcome);

    await expect(leaveRoomSeat(context)).resolves.toEqual(expected);
  });

  it('preserves a committed success reason', async () => {
    const { context } = createContext({
      kind: 'decided',
      decision: {
        kind: 'committed',
        commandId: 'command-6',
        snapshot: SNAPSHOT,
        outcome: { kind: 'success', reason: 'BOT_REMOVED' },
      },
    });

    await expect(leaveRoomSeat(context)).resolves.toEqual({
      success: true,
      reason: 'BOT_REMOVED',
    });
  });

  it('throws when an old session epoch supersedes the operation', async () => {
    const { context } = createContext({ kind: 'superseded', commandId: 'command-7' });

    await expect(leaveRoomSeat(context)).rejects.toThrow(
      'Room command command-7 was superseded by another session',
    );
  });
});
