/**
 * Room Commands — pictionary scenario (E-1).
 *
 * Runs the shared room-command propositions against the real
 * pictionary engine through its public decide. The room is the
 * default six-player config; the driver's config variants move it
 * to seven players (valid), three (invalid, below the minimum), or
 * five (shrinking, which strands the last seat).
 *
 * Pictionary-specific propositions pin what the skeleton receives
 * as injections: a profile update lands as the standalone
 * pictionary.profile.updated event rather than a seats-changed
 * roster change, a blank display name on take or profile update
 * now rejects with the config reason — the engine-layer tightening
 * the skeleton's welded validation order adds (the worker command
 * schema already rejects an empty string, but not a
 * whitespace-only name) — and a resent config re-emits its event:
 * the same-value no-op policy is fibking's alone, pictionary does
 * not inject one.
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
import type { PictionaryCommand, PictionaryCommandInput } from '../commands/types';
import {
  REASON_PICTIONARY_CONFIG_INVALID,
  REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE,
} from '../domain/reasons';
import { pictionaryEngine } from '../engine';
import { DEFAULT_PICTIONARY_CONFIG, type PictionaryState } from '../state/types';
import { decidePictionaryInput } from './commandBinding';

const ROOM_SEAT_COUNT = DEFAULT_PICTIONARY_CONFIG.numberOfPlayers;

function buildCommand(intent: RoomScenarioIntent): PictionaryCommandInput {
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
        type: 'pictionary.config.update',
        config: { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: count },
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
const HOST_CONTEXT: CommandContext = context(HOST);

function freshState(): PictionaryState {
  return pictionaryEngine.createInitialState(DEFAULT_PICTIONARY_CONFIG, {
    roomCode: '1234',
    hostUserId: 'host',
    nowMs: 1000,
    commandId: 'create',
  });
}

function applyDecision(
  state: PictionaryState,
  decision: ReturnType<typeof pictionaryEngine.decide>,
): PictionaryState {
  if (decision.kind === 'reject') throw new Error(`dispatch failed: ${decision.reason}`);
  let next = state;
  for (const event of decision.events) next = pictionaryEngine.evolve(next, event);
  return pictionaryEngine.normalize(next);
}

function apply(
  state: PictionaryState,
  command: PictionaryCommand,
  actor: RoomScenarioActor,
): PictionaryState {
  return applyDecision(state, pictionaryEngine.decide(state, command, context(actor)));
}

function makeSession(): RoomCommandsSession {
  let state = freshState();
  const dispatch = (intent: RoomScenarioIntent, actor: RoomScenarioActor): string | null => {
    const decision = decidePictionaryInput(state, buildCommand(intent), context(actor));
    if (decision.kind === 'reject') return decision.reason;
    for (const event of decision.events) state = pictionaryEngine.evolve(state, event);
    state = pictionaryEngine.normalize(state);
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
      state = applyDecision(
        state,
        decidePictionaryInput(state, { type: 'pictionary.game.begin' }, HOST_CONTEXT),
      );
      if (state.phase === 'lobby') throw new Error('leaveLobby stayed in the lobby');
    },
  };
}

describeRoomCommands({
  game: 'pictionary',
  hostUserId: 'host',
  seatCount: ROOM_SEAT_COUNT,
  validSeatCount: 7,
  phaseReason: REASON_GAME_IN_PROGRESS,
  configReason: REASON_PICTIONARY_CONFIG_INVALID,
  occupiedReason: REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE,
  makeSession,
});

describe('Room Commands - pictionary profile landing', () => {
  it('emits the standalone profile event, not a seats-changed event', () => {
    let state = freshState();
    state = apply(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
      HOST,
    );

    const decision = pictionaryEngine.decide(
      state,
      { type: 'room.profile.update', profile: { displayName: 'Renamed' } },
      HOST_CONTEXT,
    );
    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit')
      expect(decision.events).toEqual([
        { type: 'pictionary.profile.updated', seat: 0, profile: { displayName: 'Renamed' } },
      ]);
  });
});

describe('Room Commands - pictionary blank display names', () => {
  it('rejects a whitespace-only display name on take and on profile update', () => {
    let state = freshState();
    expect(
      pictionaryEngine.decide(
        state,
        { type: 'room.seat.take', seat: 0, profile: { displayName: '  ' } },
        HOST_CONTEXT,
      ),
    ).toEqual({ kind: 'reject', reason: REASON_PICTIONARY_CONFIG_INVALID });

    state = apply(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
      HOST,
    );
    expect(
      pictionaryEngine.decide(
        state,
        { type: 'room.profile.update', profile: { displayName: ' ' } },
        HOST_CONTEXT,
      ),
    ).toEqual({ kind: 'reject', reason: REASON_PICTIONARY_CONFIG_INVALID });
  });
});

describe('Room Commands - pictionary config resend', () => {
  it('re-emits the config event when the same config is resent (no no-op policy)', () => {
    const state = freshState();
    const decision = pictionaryEngine.decide(
      state,
      { type: 'pictionary.config.update', config: { ...DEFAULT_PICTIONARY_CONFIG } },
      HOST_CONTEXT,
    );
    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit')
      expect(decision.events).toEqual([
        { type: 'pictionary.config.updated', config: DEFAULT_PICTIONARY_CONFIG },
      ]);
  });
});

describe('Room Commands - pictionary empty commits', () => {
  it('commits fill on a full room and clear on an empty room with no events', () => {
    let state = freshState();
    const clearDecision = pictionaryEngine.decide(state, { type: 'room.seat.clear' }, HOST_CONTEXT);
    expect(clearDecision.kind).toBe('commit');
    if (clearDecision.kind === 'commit') expect(clearDecision.events).toEqual([]);

    state = apply(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
      HOST,
    );
    state = apply(state, { type: 'room.seat.fillBots' }, HOST);

    const refillDecision = pictionaryEngine.decide(
      state,
      { type: 'room.seat.fillBots' },
      HOST_CONTEXT,
    );
    expect(refillDecision.kind).toBe('commit');
    if (refillDecision.kind === 'commit') expect(refillDecision.events).toEqual([]);
  });
});
