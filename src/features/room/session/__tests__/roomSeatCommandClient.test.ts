import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import {
  clearRoomSeats,
  fillRoomSeatsWithBots,
  kickRoomSeat,
  leaveRoomSeat,
  type RoomSeatCommandContext,
  takeRoomSeat,
} from '@/features/room/session/roomSeatCommandClient';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import {
  domainRejectedRoomCommand,
  rejectedRoomCommand,
  successfulRoomCommand,
  testRoomState,
} from '@/test-utils/roomCommand';

interface TestProfile {
  readonly displayName: string;
}

type TestState = BaseGameState<'werewolf'>;
const state = testRoomState('werewolf');

function createContext(outcome: RoomCommandDispatchOutcome<TestState>) {
  type Dispatch = RoomSeatCommandContext<TestState, TestProfile>['dispatch'];
  const dispatch = jest.fn<ReturnType<Dispatch>, Parameters<Dispatch>>().mockResolvedValue(outcome);
  return { context: { dispatch }, dispatch };
}

describe('roomSeatCommandClient', () => {
  it('uses one canonical command vocabulary for every seat operation', async () => {
    const outcome = successfulRoomCommand(state, 'command-1');
    const { context, dispatch } = createContext(outcome);
    const profile = { displayName: '玩家' };

    await expect(takeRoomSeat(context, 3, profile)).resolves.toBe(outcome);
    await expect(leaveRoomSeat(context)).resolves.toBe(outcome);
    await expect(kickRoomSeat(context, 4)).resolves.toBe(outcome);
    await expect(clearRoomSeats(context)).resolves.toBe(outcome);
    await expect(fillRoomSeatsWithBots(context)).resolves.toBe(outcome);

    expect(dispatch.mock.calls).toEqual([
      [
        { type: 'room.seat.take', seat: 3, profile },
        { controlledSeat: null, label: 'takeRoomSeat' },
      ],
      [{ type: 'room.seat.leave' }, { controlledSeat: null, label: 'leaveRoomSeat' }],
      [
        { type: 'room.seat.kick', seat: 4 },
        { controlledSeat: null, label: 'kickRoomSeat' },
      ],
      [{ type: 'room.seat.clear' }, { controlledSeat: null, label: 'clearRoomSeats' }],
      [{ type: 'room.seat.fillBots' }, { controlledSeat: null, label: 'fillRoomSeatsWithBots' }],
    ]);
  });

  it.each<RoomCommandDispatchOutcome<TestState>>([
    { kind: 'notDecided', commandId: 'command-2', reason: 'rate_limited' },
    { kind: 'deliveryUnknown', commandId: 'command-3', reason: 'network_error' },
    rejectedRoomCommand<TestState>('not_host', 'command-4'),
    domainRejectedRoomCommand(state, 'seat_taken', 'command-5'),
    successfulRoomCommand(state, 'command-6', 1, 'bot_removed'),
  ])('returns the canonical $kind outcome unchanged', async (outcome) => {
    const { context } = createContext(outcome);

    await expect(leaveRoomSeat(context)).resolves.toBe(outcome);
  });
});
