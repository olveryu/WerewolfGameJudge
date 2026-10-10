/** v2 -> v3 roster migration: implicit bot seats materialize seat-by-seat. */

import type { CommandContext } from '../../../platform/engine';
import { getHumanSeatMap } from '../../../platform/room/seating';
import type { AvalonCommand } from '../commands/types';
import { getAvalonNightParticipants } from '../domain/rules';
import { avalonEngine } from '../engine';
import { migratePersistedAvalonState, parseAvalonState } from '../state/codec';
import { type AvalonState, DEFAULT_AVALON_CONFIG, getAvalonBotSeats } from '../state/types';

function context(actorUserId: string, commandId: string): CommandContext {
  return {
    actor: { kind: 'user', userId: actorUserId },
    controlledSeat: null,
    nowMs: 1000,
    commandId,
    randomSeed: 'roles',
  };
}

function dispatch(state: AvalonState, command: AvalonCommand, actor = 'host'): AvalonState {
  const decision = avalonEngine.decide(state, command, context(actor, command.type));
  if (decision.kind === 'reject') throw new Error(`Rejected ${command.type}: ${decision.reason}`);
  return avalonEngine.normalize(decision.events.reduce(avalonEngine.evolve, state));
}

function lobby(humans: number): AvalonState {
  let state = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
  );
  for (let seat = 0; seat < humans; seat += 1) {
    state = dispatch(
      state,
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      seat === 0 ? 'host' : `user-${seat}`,
    );
  }
  return state;
}

/** Rebuilds the exact document a v2 store would have persisted. */
function downgradeToV2(state: AvalonState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  const humans = getHumanSeatMap(state.roster, state.config.numberOfPlayers);
  const bots = getAvalonBotSeats(state);
  delete raw.roster;
  return {
    ...raw,
    stateVersion: 2,
    realSeats: humans,
    // A kicked-bot seat is indistinguishable from a never-filled seat in the
    // new model; v2 documents that produced this state had fill on and the
    // now-empty seats excluded.
    fillEmptySeatsWithBots: bots.length > 0,
    excludedBotSeats: Array.from(
      { length: state.config.numberOfPlayers },
      (_, seat) => seat,
    ).filter((seat) => humans[seat] === undefined && !bots.includes(seat)),
  };
}

describe('Avalon v2 -> v3 roster migration', () => {
  it('materializes a filled lobby exactly (host + 4 bots)', () => {
    let state = lobby(1);
    state = dispatch(state, { type: 'room.seat.fillBots' });
    expect(getAvalonBotSeats(state)).toEqual([1, 2, 3, 4]);
    const legacy = downgradeToV2(state);
    expect(() => parseAvalonState(legacy)).toThrow();
    expect(migratePersistedAvalonState(legacy)).toEqual(state);
    expect(migratePersistedAvalonState(state)).toEqual(state);
  });

  it('keeps a kicked bot seat empty instead of reviving it', () => {
    let state = lobby(1);
    state = dispatch(state, { type: 'room.seat.fillBots' });
    state = dispatch(state, { type: 'room.seat.kick', seat: 3 });
    expect(migratePersistedAvalonState(downgradeToV2(state))).toEqual(state);
  });

  it('migrates an unfilled lobby with no bots at all', () => {
    const state = lobby(3);
    expect(getAvalonBotSeats(state)).toEqual([]);
    expect(migratePersistedAvalonState(downgradeToV2(state))).toEqual(state);
  });

  it('migrates an in-progress game (roles dealt, night pending)', () => {
    let state = lobby(1);
    state = dispatch(state, { type: 'room.seat.fillBots' });
    state = dispatch(state, { type: 'avalon.game.start' });
    expect(state.phase.kind).toBe('night');
    expect(Object.keys(state.roles)).toHaveLength(5);
    expect(migratePersistedAvalonState(downgradeToV2(state))).toEqual(state);
  });

  it('materializes nothing when fill was off, even with empty seats', () => {
    const state = lobby(3);
    const legacy = downgradeToV2(state);
    // Hand-written shape: fill off and no exclusions recorded.
    legacy.fillEmptySeatsWithBots = false;
    legacy.excludedBotSeats = [];
    const migrated = migratePersistedAvalonState(legacy);
    expect(getAvalonBotSeats(migrated)).toEqual([]);
    expect(migrated).toEqual(state);
  });

  it('ignores excluded entries that name human seats or out-of-range seats', () => {
    let state = lobby(1);
    state = dispatch(state, { type: 'room.seat.fillBots' });
    const legacy = downgradeToV2(state);
    legacy.excludedBotSeats = [0, 99];
    expect(migratePersistedAvalonState(legacy)).toEqual(state);
  });

  it('chains v1 (pre role-viewing) through to the v3 roster', () => {
    let state = lobby(1);
    state = dispatch(state, { type: 'room.seat.fillBots' });
    const legacy = downgradeToV2(state);
    legacy.stateVersion = 1;
    delete legacy.roleViewedSeats;
    const migrated = migratePersistedAvalonState(legacy);
    expect(migrated.roleViewedSeats).toEqual([]);
    expect(migrated.roster).toEqual(state.roster);
  });
});

describe('Avalon unified roster rules', () => {
  it('rejects a human taking a bot seat', () => {
    let state = lobby(1);
    state = dispatch(state, { type: 'room.seat.fillBots' });
    const decision = avalonEngine.decide(
      state,
      { type: 'room.seat.take', seat: 2, profile: { displayName: 'Guest' } },
      context('guest', 'take'),
    );
    expect(decision).toEqual({ kind: 'reject', reason: 'seat_taken' });
  });

  it('does not revive a bot when a human leaves a filled room', () => {
    let state = lobby(2);
    state = dispatch(state, { type: 'room.seat.fillBots' });
    state = dispatch(state, { type: 'room.seat.leave' }, 'user-1');
    expect(getAvalonBotSeats(state)).toEqual([2, 3, 4]);
    expect(state.roster[1]).toBeUndefined();
  });

  it('rejects a config shrink that would strand a bot seat', () => {
    let big = avalonEngine.createInitialState(
      { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 6 },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    big = dispatch(big, { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
    big = dispatch(big, { type: 'room.seat.fillBots' });
    const shrink = avalonEngine.decide(
      big,
      { type: 'avalon.config.update', config: { ...big.config, numberOfPlayers: 5 } },
      context('host', 'shrink'),
    );
    expect(shrink.kind).toBe('reject');
  });
});

describe('Avalon v3 -> v4 countdown migration', () => {
  /** Drives a 5-human game into the vote phase with two ballots cast. */
  function votePhaseState(): AvalonState {
    let state = lobby(5);
    state = dispatch(state, { type: 'avalon.game.start' });
    for (let seat = 0; seat < 5; seat += 1) {
      state = dispatch(state, { type: 'avalon.role.viewed' }, seat === 0 ? 'host' : `user-${seat}`);
    }
    if (state.isAudioPlaying) state = dispatch(state, { type: 'avalon.audio.ack' });
    while (state.phase.kind === 'night') {
      const participants = getAvalonNightParticipants(state.roles, state.phase.step);
      for (const seat of participants) {
        state = dispatch(
          state,
          { type: 'avalon.night.confirm' },
          seat === 0 ? 'host' : `user-${seat}`,
        );
      }
      if (state.isAudioPlaying) state = dispatch(state, { type: 'avalon.audio.ack' });
    }
    const leader = state.leaderSeat;
    state = dispatch(
      state,
      { type: 'avalon.team.propose', seats: [leader, (leader + 1) % 5] },
      leader === 0 ? 'host' : `user-${leader}`,
    );
    state = dispatch(state, { type: 'avalon.team.vote', vote: 'approve' }, 'host');
    state = dispatch(state, { type: 'avalon.team.vote', vote: 'reject' }, 'user-1');
    return state;
  }

  /** Rebuilds the exact document a v3 store would have persisted. */
  function downgradeToV3(state: AvalonState): Record<string, unknown> {
    const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    const phase = raw.phase as Record<string, unknown>;
    delete phase.deadlineAt;
    return { ...raw, stateVersion: 3 };
  }

  it('migrates an in-progress vote with a null deadline, ballots intact', () => {
    const state = votePhaseState();
    if (state.phase.kind !== 'vote') throw new Error('expected vote phase');
    const migrated = migratePersistedAvalonState(downgradeToV3(state));
    expect(migrated.stateVersion).toBe(4);
    if (migrated.phase.kind !== 'vote') throw new Error('expected vote phase');
    expect(migrated.phase.deadlineAt).toBeNull();
    expect(migrated.phase.ballots).toEqual(state.phase.kind === 'vote' ? state.phase.ballots : {});
    expect({ ...migrated, phase: state.phase }).toEqual(state);
    // The migrated v4 document (null deadline) must round-trip through the strict parser.
    expect(parseAvalonState(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  });

  it('migrates an in-progress quest with a null deadline', () => {
    let state = votePhaseState();
    for (const seat of [2, 3, 4]) {
      state = dispatch(
        state,
        { type: 'avalon.team.vote', vote: 'approve' },
        seat === 0 ? 'host' : `user-${seat}`,
      );
    }
    // The completed ballot set only arms the countdown; the host finish settles it.
    state = dispatch(state, { type: 'avalon.vote.finish' });
    if (state.phase.kind !== 'quest') throw new Error('expected quest phase');
    const migrated = migratePersistedAvalonState(downgradeToV3(state));
    if (migrated.phase.kind !== 'quest') throw new Error('expected quest phase');
    expect(migrated.phase.deadlineAt).toBeNull();
    expect({ ...migrated, phase: state.phase }).toEqual(state);
    expect(parseAvalonState(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  });
});
