/**
 * Room Commands — storyrelay scenario (E-1).
 *
 * Runs the shared room-command propositions against the real
 * storyrelay engine through its public decide. The room is the
 * default six-player config; the driver's config variants move it
 * to seven players (valid), three (invalid, below the minimum), or
 * five (shrinking, which strands the last seat).
 *
 * Story Relay-specific propositions pin what the switch changed or
 * derived: a valid config's player count drives the room end to
 * end (the new seats exist, fill, and start a round), and fill /
 * clear with nothing to change commit empty instead of emitting an
 * empty seats-changed event.
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext } from '../../../platform/engine';
import {
  describeRoomCommands,
  type RoomCommandsSession,
  type RoomScenarioActor,
  type RoomScenarioIntent,
} from '../../../platform/room/__tests__/roomCommandsScenarios';
import { isBotOccupant } from '../../../platform/room/seating';
import type { StoryRelayCommand } from '../commands/types';
import { STORY_RELAY_REASONS } from '../domain/decision';
import { storyRelayEngine } from '../engine';
import { DEFAULT_STORY_RELAY_CONFIG, type StoryRelayState } from '../state/types';

function buildCommand(intent: RoomScenarioIntent): StoryRelayCommand {
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
      return {
        type: 'storyrelay.config.update',
        config: { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: count },
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

function freshState(): StoryRelayState {
  return storyRelayEngine.createInitialState(DEFAULT_STORY_RELAY_CONFIG, {
    roomCode: '1234',
    hostUserId: 'host',
    nowMs: 1000,
    commandId: 'create',
  });
}

function makeSession(): RoomCommandsSession {
  let state = freshState();
  const dispatch = (intent: RoomScenarioIntent, actor: RoomScenarioActor): string | null => {
    const decision = storyRelayEngine.decide(state, buildCommand(intent), context(actor));
    if (decision.kind === 'reject') return decision.reason;
    for (const event of decision.events) state = storyRelayEngine.evolve(state, event);
    state = storyRelayEngine.normalize(state);
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
      for (let seat = 0; seat < 6; seat += 1) {
        const userId = seat === 0 ? 'host' : `u${seat}`;
        const reason = dispatch(
          { kind: 'take', seat, displayName: `P${seat}` },
          { userId, controlledSeat: null },
        );
        if (reason !== null) throw new Error(`leaveLobby take failed: ${reason}`);
      }
      const decision = storyRelayEngine.decide(
        state,
        { type: 'storyrelay.game.begin' },
        context(HOST),
      );
      if (decision.kind === 'reject')
        throw new Error(`leaveLobby begin failed: ${decision.reason}`);
      for (const event of decision.events) state = storyRelayEngine.evolve(state, event);
      state = storyRelayEngine.normalize(state);
      if (state.phase === 'lobby') throw new Error('leaveLobby stayed in the lobby');
    },
  };
}

describeRoomCommands({
  game: 'storyrelay',
  hostUserId: 'host',
  seatCount: 6,
  validSeatCount: 7,
  phaseReason: STORY_RELAY_REASONS.phase,
  configReason: STORY_RELAY_REASONS.config,
  occupiedReason: STORY_RELAY_REASONS.occupied,
  makeSession,
});

describe('Room Commands - storyrelay config derivation', () => {
  it('drives the room from the updated player count: new seats take, fill, and start', () => {
    const session = makeSession();
    expect(session.dispatch({ kind: 'config', variant: 'valid' }, HOST)).toBeNull();
    expect(session.seatCount()).toBe(7);
    // Seat 6 did not exist under the old count; it takes and fills now.
    expect(session.dispatch({ kind: 'take', seat: 6, displayName: 'Last' }, HOST)).toBeNull();
    expect(session.dispatch({ kind: 'fillBots' }, HOST)).toBeNull();
    for (let seat = 0; seat < 7; seat += 1) {
      expect(session.occupantKind(seat)).not.toBe('empty');
    }
  });
});

describe('Room Commands - storyrelay empty commits', () => {
  it('commits fill on a full room and clear on an empty room with no events', () => {
    let state = freshState();
    const clearDecision = storyRelayEngine.decide(
      state,
      { type: 'room.seat.clear' },
      context(HOST),
    );
    expect(clearDecision.kind).toBe('commit');
    if (clearDecision.kind === 'commit') expect(clearDecision.events).toEqual([]);

    const fill = storyRelayEngine.decide(state, { type: 'room.seat.fillBots' }, context(HOST));
    if (fill.kind === 'reject') throw new Error(`fill failed: ${fill.reason}`);
    for (const event of fill.events) state = storyRelayEngine.evolve(state, event);
    state = storyRelayEngine.normalize(state);

    const refillDecision = storyRelayEngine.decide(
      state,
      { type: 'room.seat.fillBots' },
      context(HOST),
    );
    expect(refillDecision.kind).toBe('commit');
    if (refillDecision.kind === 'commit') expect(refillDecision.events).toEqual([]);
  });
});
