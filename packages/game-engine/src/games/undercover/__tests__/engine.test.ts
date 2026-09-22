/** Undercover command-level scenarios use authoritative events, never mutate test state. */

import type { CommandContext } from '../../../platform/engine';
import type { UndercoverCommand } from '../commands/types';
import { UNDERCOVER_REASONS } from '../domain/decision';
import type { UndercoverRole } from '../domain/rules';
import { getUndercoverWordCard } from '../domain/visibility';
import { undercoverEngine } from '../engine';
import { UNDERCOVER_STATE_CODEC } from '../state/codec';
import type { UndercoverConfig, UndercoverState } from '../state/types';

const config: UndercoverConfig = {
  numberOfPlayers: 8,
  hasBlank: true,
  isTestMode: true,
  category: 'all',
};

function user(
  userId = 'host',
  controlledSeat: number | null = null,
  commandId = 'start',
): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    commandId,
    randomSeed: 'undercover-test',
    nowMs: 1000,
  };
}

function system(): CommandContext {
  return {
    actor: { kind: 'system', effectId: 'word-selection' },
    controlledSeat: null,
    commandId: 'complete',
    randomSeed: 'undercover-test',
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

function createLobby(settings: UndercoverConfig = config): UndercoverState {
  let state = undercoverEngine.createInitialState(settings, {
    roomCode: '1234',
    hostUserId: 'host',
    nowMs: 0,
    commandId: 'create',
  });
  state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  return state;
}

function prepare(): UndercoverState {
  const state = dispatch(createLobby(), { type: 'room.seat.fillBots' });
  return dispatch(state, { type: 'undercover.round.start', shouldAllowRepeated: false });
}

function complete(state: UndercoverState): UndercoverState {
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

function ongoing(): UndercoverState {
  let state = complete(prepare());
  if (state.round === null) throw new Error('Expected round');
  const roundId = state.round.roundId;
  for (let seat = 0; seat < config.numberOfPlayers; seat += 1) {
    state = dispatch(
      state,
      { type: 'undercover.round.confirm', roundId },
      user('host', seat === 0 ? null : seat),
    );
  }
  return state;
}

function reveal(state: UndercoverState, role: UndercoverRole, context = user()): UndercoverState {
  if (state.round === null) throw new Error('Expected round');
  const revealed = state.round.revelations.map((revelation) => revelation.seat);
  const seat = state.round.roles.findIndex(
    (assigned, index) => assigned === role && !revealed.includes(index),
  );
  if (seat < 0) throw new Error(`Missing live ${role}`);
  return dispatch(
    state,
    { type: 'undercover.round.reveal', roundId: state.round.roundId, seat },
    context,
  );
}

describe('Undercover authoritative engine', () => {
  it('strictly round-trips all phase variants without resetting the game', () => {
    const preparing = prepare();
    if (preparing.phase !== 'preparing') throw new Error('Expected preparation');
    const active = ongoing();
    if (active.round === null) throw new Error('Expected round');
    const states = [
      createLobby(),
      preparing,
      complete(preparing),
      active,
      dispatch(
        preparing,
        {
          type: 'undercover.round.failPreparation',
          roundId: preparing.pendingRound.roundId,
          failureCode: 'selectionFailed',
        },
        system(),
      ),
      dispatch(active, { type: 'undercover.round.abort', roundId: active.round.roundId }),
      reveal(reveal(reveal(active, 'blank'), 'undercover'), 'undercover'),
    ];
    for (const state of states) {
      expect(UNDERCOVER_STATE_CODEC.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
      expect(() => UNDERCOVER_STATE_CODEC.parse({ ...state, unexpected: true })).toThrow();
    }
  });

  it('limits cards to the real player or host-controlled robot and hides affiliation', () => {
    const state = ongoing();
    expect(getUndercoverWordCard(state, 'visitor', null)).toBeNull();
    expect(getUndercoverWordCard(state, 'visitor', 1)).toBeNull();
    expect(getUndercoverWordCard(state, 'host', 0)).toBeNull();
    for (const seat of state.botSeats) {
      const card = getUndercoverWordCard(state, 'host', seat);
      expect(card).not.toBeNull();
      expect(card).not.toHaveProperty('role');
      expect(card).not.toHaveProperty('category');
    }
    if (state.round === null) throw new Error('Expected round');
    const aborted = dispatch(state, {
      type: 'undercover.round.abort',
      roundId: state.round.roundId,
    });
    expect(getUndercoverWordCard(aborted, 'host', 1)).toBeNull();
  });
  it('lets one host confirm all robot seats without changing host identity', () => {
    const state = ongoing();
    expect(state.phase).toBe('ongoing');
    expect(state.round?.confirmedSeats).toHaveLength(8);
    expect(state.botSeats).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(state.usedWordPairIds).toEqual(['pair-1']);
    expect(reveal(state, 'civilian', user('host', 2)).round?.revelations).toHaveLength(1);
  });

  it('keeps blank victory ahead of parity and publishes one final elimination', () => {
    let state = ongoing();
    for (let count = 0; count < 5; count += 1) state = reveal(state, 'civilian');
    expect(state.phase).toBe('ongoing');
    state = reveal(state, 'undercover');
    expect(state).toMatchObject({ phase: 'ended', winner: 'blank' });
    expect(state.round?.revelations).toHaveLength(6);
  });

  it('ends with civilian victory when all enemies are revealed', () => {
    const state = reveal(reveal(reveal(ongoing(), 'blank'), 'undercover'), 'undercover');
    expect(state).toMatchObject({ phase: 'ended', winner: 'civilian' });
  });

  it('ends with undercover victory at parity after blank elimination', () => {
    let state = reveal(ongoing(), 'blank');
    for (let count = 0; count < 3; count += 1) state = reveal(state, 'civilian');
    expect(state).toMatchObject({ phase: 'ended', winner: 'undercover' });
  });

  it('rejects bot fill outside test mode', () => {
    const state = createLobby({ ...config, isTestMode: false });
    expect(undercoverEngine.decide(state, { type: 'room.seat.fillBots' }, user())).toEqual({
      kind: 'reject',
      reason: UNDERCOVER_REASONS.testMode,
    });
  });

  it('does not replace a human or allow control of a human seat', () => {
    let state = dispatch(
      createLobby(),
      { type: 'room.seat.take', seat: 1, profile: { displayName: 'Guest' } },
      user('guest'),
    );
    state = dispatch(state, { type: 'room.seat.fillBots' });
    expect(state.botSeats).not.toContain(1);
    state = complete(
      dispatch(state, { type: 'undercover.round.start', shouldAllowRepeated: false }),
    );
    if (state.round === null) throw new Error('Expected round');
    const command: UndercoverCommand = {
      type: 'undercover.round.confirm',
      roundId: state.round.roundId,
    };
    expect(undercoverEngine.decide(state, command, user('host', 1))).toEqual({
      kind: 'reject',
      reason: UNDERCOVER_REASONS.bot,
    });
    expect(undercoverEngine.decide(state, command, user('guest', 2)).kind).toBe('reject');
    expect(dispatch(state, command, user('guest')).round?.confirmedSeats).toEqual([1]);
  });

  it('keeps repeated confirmations idempotent and requires everyone to confirm', () => {
    let state = complete(prepare());
    if (state.round === null) throw new Error('Expected round');
    const command: UndercoverCommand = {
      type: 'undercover.round.confirm',
      roundId: state.round.roundId,
    };
    state = dispatch(state, command);
    expect(dispatch(state, command)).toEqual(state);
    expect(state.phase).toBe('reading');
    expect(
      undercoverEngine.decide(
        state,
        { type: 'undercover.round.reveal', roundId: state.round!.roundId, seat: 1 },
        user(),
      ).kind,
    ).toBe('reject');
  });

  it('rejects non-host reveal, repeated reveal, and all post-victory reveals', () => {
    let state = ongoing();
    if (state.round === null) throw new Error('Expected round');
    const command: UndercoverCommand = {
      type: 'undercover.round.reveal',
      roundId: state.round.roundId,
      seat: 0,
    };
    expect(undercoverEngine.decide(state, command, user('guest')).kind).toBe('reject');
    state = dispatch(state, command);
    expect(undercoverEngine.decide(state, command, user())).toEqual({
      kind: 'reject',
      reason: UNDERCOVER_REASONS.alreadyRevealed,
    });
    const ended = reveal(reveal(reveal(ongoing(), 'blank'), 'undercover'), 'undercover');
    expect(undercoverEngine.decide(ended, command, user()).kind).toBe('reject');
  });

  it('preserves the preparation identity and explicit repeat authorization on retry', () => {
    const initial = prepare();
    if (initial.phase !== 'preparing') throw new Error('Expected preparation');
    const failed = dispatch(
      initial,
      {
        type: 'undercover.round.failPreparation',
        roundId: initial.pendingRound.roundId,
        failureCode: 'selectionFailed',
      },
      system(),
    );
    const decision = undercoverEngine.decide(
      failed,
      { type: 'undercover.round.retry', roundId: initial.pendingRound.roundId },
      user(),
    );
    if (decision.kind !== 'commit') throw new Error(decision.reason);
    expect(decision.effects).toEqual([
      {
        type: 'undercover.word.select',
        payload: {
          roundId: initial.pendingRound.roundId,
          category: 'all',
          avoidWordPairIds: [],
          shouldAllowRepeated: false,
        },
      },
    ]);
    const retried = dispatch(failed, {
      type: 'undercover.round.retry',
      roundId: initial.pendingRound.roundId,
    });
    expect(retried).toEqual(initial);
  });

  it('rejects stale system responses and user-authored word selection', () => {
    const state = prepare();
    const command: UndercoverCommand = {
      type: 'undercover.round.complete',
      roundId: 'stale',
      wordPair: { id: 'pair-1', wordA: 'Milk', wordB: 'Soy milk', category: 'food' },
    };
    expect(undercoverEngine.decide(state, command, system())).toEqual({
      kind: 'reject',
      reason: UNDERCOVER_REASONS.round,
    });
    expect(undercoverEngine.decide(state, command, user()).kind).toBe('reject');
  });

  it('freezes the roster and mode during a round', () => {
    const state = ongoing();
    const commands: UndercoverCommand[] = [
      { type: 'room.seat.leave' },
      { type: 'room.seat.clear' },
      { type: 'room.seat.fillBots' },
      { type: 'undercover.bots.clear' },
      { type: 'room.seat.kick', seat: 1 },
      { type: 'undercover.config.update', config: { ...config, isTestMode: false } },
    ];
    for (const command of commands)
      expect(undercoverEngine.decide(state, command, user()).kind).toBe('reject');
  });

  it('resets phase-owned data but keeps seats, config and used pairs', () => {
    const initial = ongoing();
    if (initial.round === null) throw new Error('Expected round');
    const roundId = initial.round.roundId;
    const aborted = dispatch(initial, { type: 'undercover.round.abort', roundId });
    const lobby = dispatch(aborted, { type: 'undercover.game.returnToLobby' });
    expect(lobby).toMatchObject({
      phase: 'lobby',
      round: null,
      botSeats: initial.botSeats,
      realSeats: initial.realSeats,
      config,
      usedWordPairIds: ['pair-1'],
    });
    expect(lobby).not.toHaveProperty('winner');
    expect(lobby).not.toHaveProperty('pendingRound');
    const restarted = dispatch(
      lobby,
      { type: 'undercover.round.start', shouldAllowRepeated: false },
      user('host', null, 'next-round'),
    );
    expect(
      undercoverEngine.decide(restarted, { type: 'undercover.round.abort', roundId }, user()),
    ).toEqual({ kind: 'reject', reason: UNDERCOVER_REASONS.round });
  });
});
