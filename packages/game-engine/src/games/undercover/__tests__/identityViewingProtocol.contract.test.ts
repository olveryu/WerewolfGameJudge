/**
 * Identity Viewing Protocol — cross-game contract scenarios (P-1).
 *
 * Every game that deals secret identities must (1) record per-seat
 * viewed state on the server, (2) mark it idempotently, and (3) hold
 * its checkpoint until every human has viewed. These scenarios run the
 * same assertions against each compliant engine. The engine module
 * boundary forbids cross-game imports, so each game carries its own
 * scenario file under this same name in its __tests__: undercover
 * (reading checkpoint) lands first; werewolf's record flip joins in
 * batch A, avalon's pre-mission checkpoint in batch C, and fibking's
 * per-round viewing phase in batch D.
 */

import type { CommandContext } from '../../../platform/engine';
import { haveAllHumansViewed, markSeatViewed } from '../../../platform/room/identityViewing';
import type { UndercoverCommand } from '../commands/types';
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

function readingState(): UndercoverState {
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

describe('Identity Viewing Protocol — undercover reading checkpoint', () => {
  it('holds the checkpoint until every human has viewed, then advances', () => {
    let state = readingState();
    expect(state.phase).toBe('reading');
    if (state.round === null) throw new Error('Expected round');
    // AU-18: bot seats are marked at round start (engine auto-mark);
    // the fixture's only human is the host on seat 0.
    expect(state.round.confirmedSeats).toEqual([1, 2, 3, 4, 5, 6, 7]);

    // Confirming bot seats under takeover never advances the gate.
    for (let seat = 1; seat < config.numberOfPlayers; seat += 1) {
      state = confirmSeat(state, seat);
      expect(state.phase).toBe('reading');
    }
    state = confirmSeat(state, 0);
    expect(state.phase).toBe('ongoing');
  });

  it('records views with the shared helper semantics (sorted, idempotent)', () => {
    let state = readingState();
    if (state.round === null) throw new Error('Expected round');
    const born = state.round.confirmedSeats;
    state = confirmSeat(state, 3);
    state = confirmSeat(state, 1);
    if (state.round === null) throw new Error('Expected round');
    // Bot confirms are no-ops over the auto-marked set.
    expect(state.round.confirmedSeats).toEqual(born);

    state = confirmSeat(state, 0);
    if (state.round === null) throw new Error('Expected round');
    const expected = markSeatViewed(born, 0);
    expect(state.round.confirmedSeats).toEqual(expected);

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
    let state = readingState();
    // AU-18: the engine's participants come from its own constructor
    // and its checkpoint IS the shared predicate - no stricter gate.
    if (state.round === null) throw new Error('Expected round');
    expect(
      haveAllHumansViewed(getUndercoverViewingParticipants(state), state.round.confirmedSeats),
    ).toBe(state.phase === 'ongoing');
    state = confirmSeat(state, 0);
    if (state.round === null) throw new Error('Expected round');
    expect(
      haveAllHumansViewed(getUndercoverViewingParticipants(state), state.round.confirmedSeats),
    ).toBe(true);
    expect(state.phase).toBe('ongoing');
  });
});
