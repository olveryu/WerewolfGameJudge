/**
 * Room Commands — fibking scenario (E-1).
 *
 * Runs the shared room-command propositions against the real
 * fibking engine through its public decide. The room is a
 * six-player config; the driver's config variants move it to seven
 * players (valid), three (invalid, below the minimum), or five
 * (shrinking, which strands the last seat).
 *
 * FibKing-specific propositions pin what the skeleton receives as
 * injections: the config update restating the current player count
 * is a no-op empty commit (fibking's own policy, kept through
 * configFacts.isNoop), a profile update lands as the standalone
 * fibking.profile.updated event rather than a seats-changed roster
 * change, and a blank display name on take or profile update now
 * rejects with the config reason — the engine-layer tightening the
 * skeleton's welded validation order adds (the worker command
 * schema already rejects an empty string, but not a
 * whitespace-only name).
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext } from '../../../platform/engine';
import { REASON_GAME_IN_PROGRESS } from '../../../platform/protocol/reasons';
import {
  describeRoomCommands,
  type RoomCommandsSession,
  type RoomScenarioActor,
  type RoomScenarioIntent,
} from '../../../platform/room/__tests__/roomCommandsScenarios';
import { isBotOccupant } from '../../../platform/room/seating';
import type { FibCommand } from '../commands/types';
import {
  REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
  REASON_FIB_PLAYER_COUNT_INVALID,
} from '../domain/reasons';
import { fibEngine } from '../engine';
import type { FibState } from '../state/types';

const ROOM_SEAT_COUNT = 6;

function buildCommand(intent: RoomScenarioIntent): FibCommand {
  switch (intent.kind) {
    case 'take':
      return {
        type: 'room.seat.take',
        seat: intent.seat,
        profile: { displayName: intent.displayName },
      };
    case 'leave':
      return { type: 'room.seat.leave' };
    case 'updateProfile':
      return { type: 'room.profile.update', profile: { displayName: intent.displayName } };
    case 'fillBots':
      return { type: 'room.seat.fillBots' };
    case 'kick':
      return { type: 'room.seat.kick', seat: intent.seat };
    case 'clear':
      return { type: 'room.seat.clear' };
    case 'config': {
      const count = intent.variant === 'valid' ? 7 : intent.variant === 'shrinking' ? 5 : 3;
      return { type: 'fibking.config.update', numberOfPlayers: count };
    }
  }
}

function context(actor: RoomScenarioActor): CommandContext {
  return {
    actor: { kind: 'user', userId: actor.userId },
    controlledSeat: actor.controlledSeat,
    nowMs: 1000,
    commandId: 'room-commands-scenario',
    randomSeed: 'room-commands',
  };
}

const HOST_CONTEXT: CommandContext = context({ userId: 'host', controlledSeat: null });

function freshState(): FibState {
  return fibEngine.createInitialState(
    { numberOfPlayers: ROOM_SEAT_COUNT },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
}

function makeSession(): RoomCommandsSession {
  let state = freshState();
  const dispatch = (intent: RoomScenarioIntent, actor: RoomScenarioActor): string | null => {
    const decision = fibEngine.decide(state, buildCommand(intent), context(actor));
    if (decision.kind === 'reject') return decision.reason;
    for (const event of decision.events) state = fibEngine.evolve(state, event);
    state = fibEngine.normalize(state);
    return null;
  };
  return {
    dispatch,
    occupantKind: (seat) => {
      const occupant = state.roster[seat];
      if (occupant == null) return 'empty';
      return isBotOccupant(occupant) ? 'bot' : 'human';
    },
    displayName: (seat) => {
      const occupant = state.roster[seat];
      return occupant == null || isBotOccupant(occupant) ? null : occupant.profile.displayName;
    },
    seatCount: () => state.numberOfPlayers,
    leaveLobby: () => {
      for (let seat = 0; seat < ROOM_SEAT_COUNT; seat += 1) {
        const userId = seat === 0 ? 'host' : `u${seat}`;
        const reason = dispatch(
          { kind: 'take', seat, displayName: `P${seat}` },
          { userId, controlledSeat: null },
        );
        if (reason !== null) throw new Error(`leaveLobby take failed: ${reason}`);
      }
      const decision = fibEngine.decide(state, { type: 'fibking.roles.assign' }, HOST_CONTEXT);
      if (decision.kind === 'reject')
        throw new Error(`leaveLobby roles.assign failed: ${decision.reason}`);
      for (const event of decision.events) state = fibEngine.evolve(state, event);
      state = fibEngine.normalize(state);
      if (state.phase === 'lobby') throw new Error('leaveLobby stayed in the lobby');
    },
  };
}

describeRoomCommands({
  game: 'fibking',
  hostUserId: 'host',
  seatCount: ROOM_SEAT_COUNT,
  validSeatCount: 7,
  phaseReason: REASON_GAME_IN_PROGRESS,
  configReason: REASON_FIB_PLAYER_COUNT_INVALID,
  occupiedReason: REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
  makeSession,
});

describe('Room Commands - fibking config no-op', () => {
  it('commits empty when the config update restates the current player count', () => {
    const state = freshState();
    const decision = fibEngine.decide(
      state,
      { type: 'fibking.config.update', numberOfPlayers: ROOM_SEAT_COUNT },
      HOST_CONTEXT,
    );
    expect(decision).toEqual({
      kind: 'commit',
      events: [],
      effects: [],
      broadcast: 'none',
      outcome: { kind: 'success' },
    });
  });
});

describe('Room Commands - fibking profile landing', () => {
  it('emits the standalone profile event, not a seats-changed event', () => {
    let state = freshState();
    const take = fibEngine.decide(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
      HOST_CONTEXT,
    );
    if (take.kind === 'reject') throw new Error(`take failed: ${take.reason}`);
    for (const event of take.events) state = fibEngine.evolve(state, event);

    const decision = fibEngine.decide(
      state,
      { type: 'room.profile.update', profile: { displayName: 'Renamed' } },
      HOST_CONTEXT,
    );
    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit')
      expect(decision.events).toEqual([
        { type: 'fibking.profile.updated', seat: 0, profile: { displayName: 'Renamed' } },
      ]);
  });
});

describe('Room Commands - fibking blank display names', () => {
  it('rejects a whitespace-only display name on take and on profile update', () => {
    let state = freshState();
    expect(
      fibEngine.decide(
        state,
        { type: 'room.seat.take', seat: 0, profile: { displayName: '  ' } },
        HOST_CONTEXT,
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_PLAYER_COUNT_INVALID });

    const take = fibEngine.decide(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
      HOST_CONTEXT,
    );
    if (take.kind === 'reject') throw new Error(`take failed: ${take.reason}`);
    for (const event of take.events) state = fibEngine.evolve(state, event);
    expect(
      fibEngine.decide(
        state,
        { type: 'room.profile.update', profile: { displayName: ' ' } },
        HOST_CONTEXT,
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_PLAYER_COUNT_INVALID });
  });
});
