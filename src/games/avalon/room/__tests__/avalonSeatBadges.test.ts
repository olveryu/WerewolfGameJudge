/**
 * createAvalonSeatDataSource badges: the quest phase marks team seats that
 * have already played with 已出牌 (existence only, never the card content),
 * mirroring the vote phase's 已投票 badge. States come from the real engine.
 */
import {
  type AvalonCommand,
  avalonEngine,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';

import { createAvalonSeatDataSource } from '../avalonRoomAdapter';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

function questPhaseSession() {
  let commandNumber = 0;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: AvalonCommand, userId = 'host', controlledSeat: number | null = null) => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(avalonEngine.evolve, state);
    return state;
  };
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  send({ type: 'avalon.game.start' });
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'avalon.role.viewed' }, seatUser(seat));
  }
  if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
    if (state.phase.kind !== 'night') break;
    for (const seat of getAvalonNightParticipants(state.roles, step)) {
      send({ type: 'avalon.night.confirm' }, seatUser(seat));
    }
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  }
  const leader = state.leaderSeat;
  send({ type: 'avalon.team.propose', seats: [leader, (leader + 1) % 5] }, seatUser(leader));
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(seat));
  }
  send({ type: 'avalon.vote.finish' });
  if (state.phase.kind !== 'quest') throw new Error('expected quest phase');
  return {
    get state() {
      return state;
    },
    send,
    seatUser,
    leader,
  };
}

describe('createAvalonSeatDataSource — quest played badge', () => {
  it('marks a team seat as 已出牌 after it plays, and only that seat', () => {
    const session = questPhaseSession();
    const leader = session.leader;
    session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(leader));
    const source = createAvalonSeatDataSource(session.state, 1, 'host', null);
    expect(source.getSeat(leader).statusBadge).toEqual({ label: '队长 · 已出牌', tone: 'success' });
    const other = (leader + 1) % 5;
    expect(source.getSeat(other).statusBadge).toEqual({ label: '队员', tone: 'success' });
    const outsider = (leader + 2) % 5;
    expect(source.getSeat(outsider).statusBadge).toBeNull();
  });
});

describe('createAvalonSeatDataSource — night badges', () => {
  function nightSession() {
    let commandNumber = 0;
    let state: AvalonState = avalonEngine.createInitialState(
      { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
      { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
    );
    const send = (command: AvalonCommand, userId = 'host') => {
      const context: CommandContext = {
        actor: { kind: 'user', userId },
        controlledSeat: null,
        nowMs: 1000,
        commandId: `command:${commandNumber++}`,
        randomSeed: `seed:${commandNumber}`,
      };
      const decision = avalonEngine.decide(state, command, context);
      if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
      state = decision.events.reduce(avalonEngine.evolve, state);
      return state;
    };
    const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
    for (let seat = 0; seat < 5; seat += 1) {
      send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
    }
    send({ type: 'avalon.game.start' });
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
    if (state.phase.kind !== 'night') throw new Error('expected night phase');
    return {
      get state() {
        return state;
      },
      send,
      seatUser,
    };
  }

  it('shows the viewed-role badge per seat during the night only', () => {
    const session = nightSession();
    session.send({ type: 'avalon.role.viewed' }, session.seatUser(2));
    const source = createAvalonSeatDataSource(session.state, 1, 'host', null);
    expect(source.getSeat(2).showReadyBadge).toBe(true);
    expect(source.getSeat(1).showReadyBadge).toBe(false);
  });

  it('shows 已确认 only to fellow participants of the current night step', () => {
    const session = nightSession();
    const evilSeats = getAvalonNightParticipants(session.state.roles, 'evilReveal');
    expect(evilSeats.length).toBeGreaterThanOrEqual(2);
    const firstEvil = evilSeats[0];
    const secondEvil = evilSeats[1];
    if (firstEvil === undefined || secondEvil === undefined) {
      throw new Error('expected two evil seats');
    }
    session.send({ type: 'avalon.night.confirm' }, session.seatUser(firstEvil));

    // A fellow evil participant sees the confirmed badge on the confirmer.
    const evilView = createAvalonSeatDataSource(
      session.state,
      1,
      session.seatUser(secondEvil),
      null,
    );
    expect(evilView.getSeat(firstEvil).statusBadge?.label).toContain('已确认');
    // A non-participant (good player) sees nothing about the private confirm.
    const goodSeat = [0, 1, 2, 3, 4].find((seat) => !evilSeats.includes(seat));
    if (goodSeat === undefined) throw new Error('expected a good seat');
    const goodView = createAvalonSeatDataSource(session.state, 1, session.seatUser(goodSeat), null);
    expect(goodView.getSeat(firstEvil).statusBadge?.label ?? '').not.toContain('已确认');
  });
});

describe('createAvalonSeatDataSource — night badge window closes', () => {
  it('drops the viewed badge once the night ends', () => {
    const session = questPhaseSession();
    const source = createAvalonSeatDataSource(session.state, 1, 'host', null);
    for (let seat = 0; seat < 5; seat += 1) {
      expect(source.getSeat(seat).showReadyBadge).toBe(false);
    }
  });
});

describe('createAvalonSeatDataSource — nominate picked badge', () => {
  it('marks locally picked seats as 队员 during nomination (leader keeps 队长)', () => {
    let commandNumber = 0;
    let state: AvalonState = avalonEngine.createInitialState(
      { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
      { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
    );
    const send = (command: AvalonCommand, userId = 'host') => {
      const context: CommandContext = {
        actor: { kind: 'user', userId },
        controlledSeat: null,
        nowMs: 1000,
        commandId: `command:${commandNumber++}`,
        randomSeed: `seed:${commandNumber}`,
      };
      const decision = avalonEngine.decide(state, command, context);
      if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
      state = decision.events.reduce(avalonEngine.evolve, state);
      return state;
    };
    const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
    for (let seat = 0; seat < 5; seat += 1) {
      send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
    }
    send({ type: 'avalon.game.start' });
    for (let seat = 0; seat < 5; seat += 1) {
      send({ type: 'avalon.role.viewed' }, seatUser(seat));
    }
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
    for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
      if (state.phase.kind !== 'night') break;
      for (const seat of getAvalonNightParticipants(state.roles, step)) {
        send({ type: 'avalon.night.confirm' }, seatUser(seat));
      }
      if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
    }
    if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
    const leader = state.leaderSeat;
    const pickedSeat = (leader + 1) % 5;
    const unpickedSeat = (leader + 2) % 5;
    const source = createAvalonSeatDataSource(
      state,
      1,
      'host',
      null,
      new Set([pickedSeat, leader]),
    );
    expect(source.getSeat(pickedSeat).statusBadge).toEqual({ label: '队员', tone: 'success' });
    expect(source.getSeat(leader).statusBadge?.label).toBe('队长');
    expect(source.getSeat(unpickedSeat).statusBadge).toBeNull();
  });
});
