/**
 * Room Commands — undercover scenario (E-1).
 *
 * Runs the shared room-command propositions against the real
 * undercover engine through its public decide. The room is the
 * eight-player config with a blank seat; the driver's config
 * variants move it to nine players (valid), three (invalid, below
 * the minimum), or seven (shrinking, which strands the last seat).
 *
 * Undercover-specific propositions pin what the switch changed:
 * taking a bot seat hears the config reason for a blank display
 * name (the name check now precedes the roster decide; the retired
 * isBotSeat precheck answered seat_taken first) and seat_taken for
 * a valid name, fill / clear with nothing to change commit empty
 * instead of emitting an empty seats-changed event, a resent config
 * re-emits its event (no no-op policy), and the updated player
 * count drives the start gate end to end.
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext } from '../../../platform/engine';
import { REASON_SEAT_TAKEN } from '../../../platform/protocol/reasons';
import {
  describeRoomCommands,
  type RoomCommandsSession,
  type RoomScenarioActor,
  type RoomScenarioIntent,
} from '../../../platform/room/__tests__/roomCommandsScenarios';
import { isBotOccupant } from '../../../platform/room/seating';
import type { UndercoverCommand } from '../commands/types';
import { UNDERCOVER_REASONS } from '../domain/decision';
import { undercoverEngine } from '../engine';
import type { UndercoverConfig, UndercoverState } from '../state/types';

const BASE_CONFIG: UndercoverConfig = {
  numberOfPlayers: 8,
  hasBlank: true,
  category: 'all',
};

function buildCommand(intent: RoomScenarioIntent): UndercoverCommand {
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
      const count = intent.variant === 'valid' ? 9 : intent.variant === 'shrinking' ? 7 : 3;
      return {
        type: 'undercover.config.update',
        config: { ...BASE_CONFIG, numberOfPlayers: count },
      };
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

const HOST: RoomScenarioActor = { userId: 'host', controlledSeat: null };
const GUEST: RoomScenarioActor = { userId: 'guest', controlledSeat: null };

function freshState(): UndercoverState {
  return undercoverEngine.createInitialState(BASE_CONFIG, {
    roomCode: '1234',
    hostUserId: 'host',
    nowMs: 1000,
    commandId: 'create',
  });
}

function apply(state: UndercoverState, command: UndercoverCommand, actor: RoomScenarioActor) {
  const decision = undercoverEngine.decide(state, command, context(actor));
  if (decision.kind === 'reject') throw new Error(`dispatch failed: ${decision.reason}`);
  let next = state;
  for (const event of decision.events) next = undercoverEngine.evolve(next, event);
  return undercoverEngine.normalize(next);
}

function makeSession(): RoomCommandsSession {
  let state = freshState();
  const dispatch = (intent: RoomScenarioIntent, actor: RoomScenarioActor): string | null => {
    const decision = undercoverEngine.decide(state, buildCommand(intent), context(actor));
    if (decision.kind === 'reject') return decision.reason;
    for (const event of decision.events) state = undercoverEngine.evolve(state, event);
    state = undercoverEngine.normalize(state);
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
    seatCount: () => state.config.numberOfPlayers,
    leaveLobby: () => {
      state = apply(
        state,
        { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
        HOST,
      );
      state = apply(state, { type: 'room.seat.fillBots' }, HOST);
      state = apply(state, { type: 'undercover.roles.assign', shouldAllowRepeated: false }, HOST);
      if (state.phase === 'lobby') throw new Error('leaveLobby stayed in the lobby');
    },
  };
}

describeRoomCommands({
  game: 'undercover',
  hostUserId: 'host',
  seatCount: 8,
  validSeatCount: 9,
  phaseReason: UNDERCOVER_REASONS.phase,
  configReason: UNDERCOVER_REASONS.config,
  occupiedReason: UNDERCOVER_REASONS.occupied,
  makeSession,
});

describe('Room Commands - undercover bot-seat take precedence', () => {
  it('answers the config reason for a blank name on a bot seat, seat_taken for a valid name', () => {
    let state = freshState();
    state = apply(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
      HOST,
    );
    state = apply(state, { type: 'room.seat.fillBots' }, HOST);
    // Seat 3 is a bot. The skeleton validates the display name ahead
    // of the roster decide, so a blank name hears the config reason;
    // before the switch, the isBotSeat precheck answered seat_taken.
    expect(
      undercoverEngine.decide(
        state,
        { type: 'room.seat.take', seat: 3, profile: { displayName: '  ' } },
        context(GUEST),
      ),
    ).toEqual({ kind: 'reject', reason: UNDERCOVER_REASONS.config });
    expect(
      undercoverEngine.decide(
        state,
        { type: 'room.seat.take', seat: 3, profile: { displayName: 'Guest' } },
        context(GUEST),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_SEAT_TAKEN });
  });
});

describe('Room Commands - undercover empty commits', () => {
  it('commits fill on a full room and clear on an empty room with no events', () => {
    let state = freshState();
    const clearDecision = undercoverEngine.decide(
      state,
      { type: 'room.seat.clear' },
      context(HOST),
    );
    expect(clearDecision.kind).toBe('commit');
    if (clearDecision.kind === 'commit') expect(clearDecision.events).toEqual([]);

    state = apply(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
      HOST,
    );
    state = apply(state, { type: 'room.seat.fillBots' }, HOST);

    const refillDecision = undercoverEngine.decide(
      state,
      { type: 'room.seat.fillBots' },
      context(HOST),
    );
    expect(refillDecision.kind).toBe('commit');
    if (refillDecision.kind === 'commit') expect(refillDecision.events).toEqual([]);
  });
});

describe('Room Commands - undercover config derivation', () => {
  it('re-emits the config event when the same config is resent (no no-op policy)', () => {
    const state = freshState();
    const decision = undercoverEngine.decide(
      state,
      { type: 'undercover.config.update', config: { ...BASE_CONFIG } },
      context(HOST),
    );
    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit')
      expect(decision.events).toEqual([{ type: 'undercover.config.updated', config: BASE_CONFIG }]);
  });

  it('drives the room from the updated player count: new seats take, fill, and start', () => {
    let state = freshState();
    state = apply(
      state,
      { type: 'undercover.config.update', config: { ...BASE_CONFIG, numberOfPlayers: 9 } },
      HOST,
    );
    expect(state.config.numberOfPlayers).toBe(9);
    // Seat 8 did not exist under the old count; it takes and fills
    // now, and the start gate admits the round at the derived count.
    state = apply(
      state,
      { type: 'room.seat.take', seat: 8, profile: { displayName: 'Last' } },
      { userId: 'last', controlledSeat: null },
    );
    state = apply(state, { type: 'room.seat.fillBots' }, HOST);
    state = apply(state, { type: 'undercover.roles.assign', shouldAllowRepeated: false }, HOST);
    expect(state.phase).toBe('preparing');
  });
});
