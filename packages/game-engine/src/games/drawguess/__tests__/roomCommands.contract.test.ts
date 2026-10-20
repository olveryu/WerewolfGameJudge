/**
 * Room Commands — drawguess scenario (E-1).
 *
 * Runs the shared room-command propositions against the real
 * drawguess engine through its public decide. The room is the
 * default six-player config; the driver's config variants move it
 * to seven players (valid), three (invalid, below the minimum), or
 * five (shrinking, which strands the last seat).
 *
 * DrawGuess-specific propositions pin the lobby gate the skeleton
 * receives as a ready-made rejection: once the game has begun, a
 * rejoin or config attempt — host or not — hears the phase reason,
 * because the lobby gate runs ahead of both the seat branch and
 * the host gate.
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
import type { DrawGuessCommand } from '../commands/types';
import { DRAWGUESS_REASONS } from '../domain/decision';
import { drawGuessEngine } from '../engine';
import { DEFAULT_DRAWGUESS_CONFIG, type DrawGuessState } from '../state/types';

function buildCommand(intent: RoomScenarioIntent): DrawGuessCommand {
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
        type: 'drawguess.config.update',
        config: { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: count },
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

function freshState(): DrawGuessState {
  return drawGuessEngine.createInitialState(DEFAULT_DRAWGUESS_CONFIG, {
    roomCode: '1234',
    hostUserId: 'host',
    nowMs: 1000,
    commandId: 'create',
  });
}

function makeSession(): RoomCommandsSession {
  let state = freshState();
  const dispatch = (intent: RoomScenarioIntent, actor: RoomScenarioActor): string | null => {
    const decision = drawGuessEngine.decide(state, buildCommand(intent), context(actor));
    if (decision.kind === 'reject') return decision.reason;
    for (const event of decision.events) state = drawGuessEngine.evolve(state, event);
    state = drawGuessEngine.normalize(state);
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
      const decision = drawGuessEngine.decide(
        state,
        { type: 'drawguess.game.begin' },
        context({ userId: 'host', controlledSeat: null }),
      );
      if (decision.kind === 'reject')
        throw new Error(`leaveLobby begin failed: ${decision.reason}`);
      for (const event of decision.events) state = drawGuessEngine.evolve(state, event);
      state = drawGuessEngine.normalize(state);
      if (state.phase.kind === 'lobby') throw new Error('leaveLobby stayed in the lobby');
    },
  };
}

describeRoomCommands({
  game: 'drawguess',
  hostUserId: 'host',
  seatCount: 6,
  validSeatCount: 7,
  phaseReason: DRAWGUESS_REASONS.phase,
  configReason: DRAWGUESS_REASONS.config,
  occupiedReason: DRAWGUESS_REASONS.occupied,
  makeSession,
});

describe('Room Commands - drawguess config resend', () => {
  it('re-emits the config event when the same config is resent (no no-op policy)', () => {
    const state = freshState();
    const decision = drawGuessEngine.decide(
      state,
      { type: 'drawguess.config.update', config: { ...DEFAULT_DRAWGUESS_CONFIG } },
      context({ userId: 'host', controlledSeat: null }),
    );
    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit')
      expect(decision.events).toEqual([
        { type: 'drawguess.config.updated', config: { ...DEFAULT_DRAWGUESS_CONFIG } },
      ]);
  });
});

describe('Room Commands - drawguess lobby gate after begin', () => {
  it('answers rejoin and config attempts with the phase reason, ahead of the host gate', () => {
    const session = makeSession();
    session.leaveLobby();
    const guest: RoomScenarioActor = { userId: 'u1', controlledSeat: null };
    // A seated player re-dispatching take mid-game (rejoin) hears the phase reason.
    expect(session.dispatch({ kind: 'take', seat: 0, displayName: 'Again' }, guest)).toBe(
      DRAWGUESS_REASONS.phase,
    );
    // A non-host config attempt hears the phase reason, not not-host:
    // the lobby gate precedes the host gate.
    expect(session.dispatch({ kind: 'config', variant: 'valid' }, guest)).toBe(
      DRAWGUESS_REASONS.phase,
    );
    expect(session.dispatch({ kind: 'config', variant: 'invalid' }, guest)).toBe(
      DRAWGUESS_REASONS.phase,
    );
  });
});
