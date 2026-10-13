/**
 * Identity Viewing Protocol — cross-game contract scenarios (P-1).
 *
 * Every game that deals secret identities must (1) record per-seat
 * viewed state on the server, (2) mark it idempotently, and (3) hold
 * its checkpoint until every seated player has viewed - bot seats
 * count like everyone else and are filled by the host's scaffold
 * action (mark all bots viewed), never by an engine auto-mark.
 * These scenarios run the
 * same assertions against each compliant engine. The engine module
 * boundary forbids cross-game imports, so each game carries its own
 * scenario file under this same name in its __tests__: undercover
 * (viewing-stage begin gate) lands first; werewolf's record flip joins
 * in batch A, avalon's pre-mission checkpoint in batch C, and fibking's
 * per-round viewing phase in batch D.
 */

import type { CommandContext } from '../../../platform/engine';
import { describeIdentityViewingProtocol } from '../../../platform/room/__tests__/identityViewingScenarios';
import { haveAllViewed, markSeatViewed } from '../../../platform/room/identityViewing';
import type { UndercoverCommand } from '../commands/types';
import { UNDERCOVER_REASONS } from '../domain/decision';
import { undercoverEngine } from '../engine';
import {
  getUndercoverViewingParticipants,
  type UndercoverConfig,
  type UndercoverState,
} from '../state/types';

const config: UndercoverConfig = {
  numberOfPlayers: 8,
  hasBlank: true,
  category: 'all',
};

function user(userId = 'host', controlledSeat: number | null = null): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    commandId: 'contract',
    randomSeed: 'viewing-protocol',
    nowMs: 1000,
  };
}

function system(): CommandContext {
  return {
    actor: { kind: 'system', effectId: 'word-selection' },
    controlledSeat: null,
    commandId: 'complete',
    randomSeed: 'viewing-protocol',
    nowMs: 1200,
  };
}

function dispatch(
  state: UndercoverState,
  command: UndercoverCommand,
  context = user(),
): UndercoverState {
  const decision = undercoverEngine.decide(state, command, context);
  if (decision.kind === 'reject') throw new Error(`Rejected ${command.type}: ${decision.reason}`);
  return undercoverEngine.normalize(decision.events.reduce(undercoverEngine.evolve, state));
}

function viewingState(): UndercoverState {
  let state = undercoverEngine.createInitialState(config, {
    roomCode: '1234',
    hostUserId: 'host',
    nowMs: 0,
    commandId: 'create',
  });
  state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  state = dispatch(state, { type: 'room.seat.fillBots' });
  state = dispatch(state, { type: 'undercover.round.start', shouldAllowRepeated: false });
  if (state.phase !== 'preparing') throw new Error('Expected preparation');
  return dispatch(
    state,
    {
      type: 'undercover.round.complete',
      roundId: state.pendingRound.roundId,
      wordPair: { id: 'pair-1', wordA: 'Milk', wordB: 'Soy milk', category: 'food' },
    },
    system(),
  );
}

function confirmSeat(state: UndercoverState, seat: number): UndercoverState {
  if (state.round === null) throw new Error('Expected round');
  return dispatch(
    state,
    { type: 'undercover.round.confirm', roundId: state.round.roundId },
    user('host', seat === 0 ? null : seat),
  );
}

function beginRound(state: UndercoverState): UndercoverState {
  if (state.round === null) throw new Error('Expected round');
  return dispatch(state, { type: 'undercover.round.begin', roundId: state.round.roundId });
}

describe('Identity Viewing Protocol — undercover viewing-stage begin gate', () => {
  it('holds the round in viewing until every seat viewed and the host begins', () => {
    let state = viewingState();
    expect(state.phase).toBe('viewing');
    if (state.round === null) throw new Error('Expected round');
    expect(state.round.confirmedSeats).toEqual([]);

    for (let seat = 1; seat < config.numberOfPlayers; seat += 1) {
      state = confirmSeat(state, seat);
      expect(state.phase).toBe('viewing');
    }
    // The begin gate is still closed: the host has not viewed yet.
    if (state.round === null) throw new Error('Expected round');
    const blocked = undercoverEngine.decide(
      state,
      { type: 'undercover.round.begin', roundId: state.round.roundId },
      user(),
    );
    expect(blocked.kind).toBe('reject');
    if (blocked.kind === 'reject') expect(blocked.reason).toBe(UNDERCOVER_REASONS.notAllViewed);

    state = confirmSeat(state, 0);
    // Every seat has viewed, but play opens only on the host's begin.
    expect(state.phase).toBe('viewing');
    state = beginRound(state);
    expect(state.phase).toBe('ongoing');
  });

  it('fills bot records through the host scaffold action, then waits on the humans', () => {
    let state = viewingState();
    if (state.round === null) throw new Error('Expected round');
    state = dispatch(state, {
      type: 'undercover.round.markAllBotsViewed',
      roundId: state.round.roundId,
    });
    if (state.round === null) throw new Error('Expected round');
    expect(state.round.confirmedSeats).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(state.phase).toBe('viewing');

    state = confirmSeat(state, 0);
    expect(state.phase).toBe('viewing');
    state = beginRound(state);
    expect(state.phase).toBe('ongoing');
  });

  it('rejects begin from a non-host and in the wrong phase', () => {
    let state = viewingState();
    if (state.round === null) throw new Error('Expected round');
    const roundId = state.round.roundId;
    for (let seat = 0; seat < config.numberOfPlayers; seat += 1) state = confirmSeat(state, seat);
    const nonHost = undercoverEngine.decide(
      state,
      { type: 'undercover.round.begin', roundId },
      user('guest'),
    );
    expect(nonHost.kind).toBe('reject');
    state = beginRound(state);
    const again = undercoverEngine.decide(
      state,
      { type: 'undercover.round.begin', roundId },
      user(),
    );
    expect(again.kind).toBe('reject');
    if (again.kind === 'reject') expect(again.reason).toBe(UNDERCOVER_REASONS.phase);
  });

  it('records views with the shared helper semantics (sorted, idempotent)', () => {
    let state = viewingState();
    state = confirmSeat(state, 3);
    state = confirmSeat(state, 1);
    if (state.round === null) throw new Error('Expected round');
    expect(state.round.confirmedSeats).toEqual(markSeatViewed(markSeatViewed([], 3), 1));
    expect(state.round.confirmedSeats).toEqual([1, 3]);

    state = confirmSeat(state, 0);
    if (state.round === null) throw new Error('Expected round');
    expect(state.round.confirmedSeats).toEqual([0, 1, 3]);

    // A duplicate confirm never duplicates the record: the engine either
    // no-ops or rejects, and the recorded set stays exactly the same.
    const before = state.round.confirmedSeats;
    try {
      state = confirmSeat(state, 0);
    } catch {
      // rejection is an acceptable idempotency guard
    }
    if (state.round === null) throw new Error('Expected round');
    expect(state.round.confirmedSeats).toEqual(before);
  });

  it('agrees with the shared checkpoint predicate over the recorded set', () => {
    let state = viewingState();
    if (state.round === null) throw new Error('Expected round');
    expect(haveAllViewed(getUndercoverViewingParticipants(state), state.round.confirmedSeats)).toBe(
      false,
    );
    state = dispatch(state, {
      type: 'undercover.round.markAllBotsViewed',
      roundId: state.round.roundId,
    });
    state = confirmSeat(state, 0);
    if (state.round === null) throw new Error('Expected round');
    // The predicate is satisfied while the phase still waits for begin.
    expect(haveAllViewed(getUndercoverViewingParticipants(state), state.round.confirmedSeats)).toBe(
      true,
    );
    expect(state.phase).toBe('viewing');
    state = beginRound(state);
    expect(state.phase).toBe('ongoing');
  });
});

describeIdentityViewingProtocol({
  game: 'undercover',
  makeSession: () => {
    let state = viewingState();
    const attempt = (next: () => UndercoverState) => {
      try {
        state = next();
      } catch {
        // Redundant marks/views are rejected by the phase gate; the
        // suite asserts the recorded state, not acceptance.
      }
    };
    return {
      viewedSeats: () => state.round?.confirmedSeats ?? [],
      participants: () => getUndercoverViewingParticipants(state),
      view: (seat) => attempt(() => confirmSeat(state, seat)),
      markAllBotsViewed: () =>
        attempt(() =>
          state.round === null
            ? state
            : dispatch(state, {
                type: 'undercover.round.markAllBotsViewed',
                roundId: state.round.roundId,
              }),
        ),
      // Non-mutating probe: the begin gate would commit right now.
      isCheckpointOpen: () =>
        state.round !== null &&
        undercoverEngine.decide(
          state,
          { type: 'undercover.round.begin', roundId: state.round.roundId },
          user(),
        ).kind === 'commit',
    };
  },
});
