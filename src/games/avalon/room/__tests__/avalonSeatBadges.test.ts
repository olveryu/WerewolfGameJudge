/**
 * createAvalonSeatDataSource badges: the quest phase marks team seats that
 * have already played with 已出牌 (existence only, never the card content),
 * mirroring the vote phase's 已投票 badge. States come from the real engine.
 */
import {
  avalonEngine,
  type AvalonPhaseKind,
  type AvalonPlayerCount,
  type AvalonPublicCommand,
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
  const send = (
    command: AvalonPublicCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => {
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
  send({ type: 'avalon.game.begin' });
  if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
    if (state.phase.kind !== 'night') break;
    for (const seat of getAvalonNightParticipants(state.roles, step)) {
      send({ type: 'avalon.night.confirm' }, seatUser(seat));
    }
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  }
  const leader = state.leaderSeat;
  send({ type: 'avalon.team.updateDraft', seats: [leader, (leader + 1) % 5] }, seatUser(leader));
  send({ type: 'avalon.team.propose' }, seatUser(leader));
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
    const source = createAvalonSeatDataSource({
      state: session.state,
      revision: 1,
      userId: 'host',
      controlledSeat: null,
    });
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
    const send = (command: AvalonPublicCommand, userId = 'host') => {
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
    send({ type: 'avalon.game.begin' });
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

  it('shows the viewed-role badge per seat during the viewing stage only', () => {
    // Viewing stage: only the seats that viewed light up.
    let commandNumber = 0;
    let state: AvalonState = avalonEngine.createInitialState(
      { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
      { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
    );
    const send = (command: AvalonPublicCommand, userId = 'host') => {
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
    send({ type: 'avalon.role.viewed' }, seatUser(2));
    const viewingSource = createAvalonSeatDataSource({
      state,
      revision: 1,
      userId: 'host',
      controlledSeat: null,
    });
    expect(viewingSource.getSeat(2).showReadyBadge).toBe(true);
    expect(viewingSource.getSeat(1).showReadyBadge).toBe(false);

    // Night: the game has begun, so the viewing-stage badges are all cleared
    // even though every seat has a viewing record.
    const night = nightSession();
    const nightSource = createAvalonSeatDataSource({
      state: night.state,
      revision: 1,
      userId: 'host',
      controlledSeat: null,
    });
    for (let seat = 0; seat < 5; seat += 1) {
      expect(nightSource.getSeat(seat).showReadyBadge).toBe(false);
    }
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
    const evilView = createAvalonSeatDataSource({
      state: session.state,
      revision: 1,
      userId: session.seatUser(secondEvil),
      controlledSeat: null,
    });
    expect(evilView.getSeat(firstEvil).statusBadge?.label).toContain('已确认');
    // A non-participant (good player) sees nothing about the private confirm.
    const goodSeat = [0, 1, 2, 3, 4].find((seat) => !evilSeats.includes(seat));
    if (goodSeat === undefined) throw new Error('expected a good seat');
    const goodView = createAvalonSeatDataSource({
      state: session.state,
      revision: 1,
      userId: session.seatUser(goodSeat),
      controlledSeat: null,
    });
    expect(goodView.getSeat(firstEvil).statusBadge?.label ?? '').not.toContain('已确认');
  });
});

describe('createAvalonSeatDataSource — night badge window closes', () => {
  it('drops the viewed badge once the night ends', () => {
    const session = questPhaseSession();
    const source = createAvalonSeatDataSource({
      state: session.state,
      revision: 1,
      userId: 'host',
      controlledSeat: null,
    });
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
    const send = (command: AvalonPublicCommand, userId = 'host') => {
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
    send({ type: 'avalon.game.begin' });
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
    // 场景来源：队长经 updateDraft 把两人写进服务端草稿（徽标读草稿）。
    send({ type: 'avalon.team.updateDraft', seats: [pickedSeat, leader] }, seatUser(leader));
    const source = createAvalonSeatDataSource({
      state,
      revision: 1,
      userId: 'host',
      controlledSeat: null,
    });
    expect(source.getSeat(pickedSeat).statusBadge).toEqual({ label: '队员', tone: 'success' });
    expect(source.getSeat(leader).statusBadge?.label).toBe('队长');
    expect(source.getSeat(unpickedSeat).statusBadge).toBeNull();
  });
});

describe('createAvalonSeatDataSource — leader badge phase gate', () => {
  function startSession(numberOfPlayers: AvalonPlayerCount) {
    let commandNumber = 0;
    let state: AvalonState = avalonEngine.createInitialState(
      { ...DEFAULT_AVALON_CONFIG, numberOfPlayers },
      { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
    );
    const send = (command: AvalonPublicCommand, userId = 'host') => {
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
    for (let seat = 0; seat < numberOfPlayers; seat += 1) {
      send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
    }
    return {
      get state() {
        return state;
      },
      send,
      seatUser,
    };
  }

  type Session = ReturnType<typeof startSession>;

  /** The 队长-carrying badge label anywhere on the seat board, or null when gated off. */
  function leaderBadgeLabel(state: AvalonState): string | null {
    const source = createAvalonSeatDataSource({
      state,
      revision: 1,
      userId: 'host',
      controlledSeat: null,
    });
    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      const label = source.getSeat(seat).statusBadge?.label ?? null;
      if (label !== null && label.includes('队长')) return label;
    }
    return null;
  }

  function beginGame(session: Session) {
    session.send({ type: 'avalon.game.start' });
    for (let seat = 0; seat < session.state.config.numberOfPlayers; seat += 1) {
      session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.game.begin' });
    if (session.state.isAudioPlaying) session.send({ type: 'avalon.audio.ack' }, 'host');
  }

  function walkNightSteps(session: Session) {
    for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
      if (session.state.phase.kind !== 'night') break;
      for (const seat of getAvalonNightParticipants(session.state.roles, step)) {
        session.send({ type: 'avalon.night.confirm' }, session.seatUser(seat));
      }
      if (session.state.isAudioPlaying) session.send({ type: 'avalon.audio.ack' }, 'host');
    }
  }

  /** Proposes leader + lowest seats up to requiredSize; returns the team. */
  function proposeTeam(session: Session): number[] {
    const state = session.state;
    if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
    const team: number[] = [state.leaderSeat];
    for (let seat = 0; team.length < state.phase.requiredSize; seat += 1) {
      if (!team.includes(seat)) team.push(seat);
    }
    session.send(
      { type: 'avalon.team.updateDraft', seats: team },
      session.seatUser(state.leaderSeat),
    );
    session.send({ type: 'avalon.team.propose' }, session.seatUser(state.leaderSeat));
    return team;
  }

  /** Plays one full successful round starting from the nominate phase. */
  function playSuccessfulRound(session: Session) {
    const team = proposeTeam(session);
    for (let seat = 0; seat < session.state.config.numberOfPlayers; seat += 1) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.vote.finish' });
    for (const seat of team) {
      session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.quest.finish' });
  }

  it('shows the leader badge in daytime phases only across a game walk', () => {
    const session = startSession(5);
    const seen: Array<readonly [AvalonPhaseKind, string | null]> = [];
    const record = () => {
      seen.push([session.state.phase.kind, leaderBadgeLabel(session.state)] as const);
    };
    record();
    session.send({ type: 'avalon.game.start' });
    record();
    for (let seat = 0; seat < 5; seat += 1) {
      session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.game.begin' });
    if (session.state.isAudioPlaying) session.send({ type: 'avalon.audio.ack' }, 'host');
    record();
    walkNightSteps(session);
    record();
    const team = proposeTeam(session);
    record();
    for (let seat = 0; seat < 5; seat += 1) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.vote.finish' });
    record();
    for (const seat of team) {
      session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.quest.finish' });
    record();
    expect(seen).toEqual([
      ['lobby', null],
      ['viewing', null],
      ['night', null],
      ['nominate', '队长'],
      ['vote', '队长'],
      ['quest', '队长'],
      ['nominate', '队长'],
    ]);
  });

  it('shows the leader badge during the lady phase of a 9-player game', () => {
    // 湖中仙女只存在于 9/10 人局（引擎规则），故此用例开 9 人局。
    const session = startSession(9);
    beginGame(session);
    walkNightSteps(session);
    playSuccessfulRound(session);
    playSuccessfulRound(session);
    if (session.state.phase.kind !== 'lady') throw new Error('expected lady phase');
    expect(leaderBadgeLabel(session.state)).toBe('队长');
  });

  it('shows the leader badge in the assassin phase and drops it once ended', () => {
    const session = startSession(5);
    beginGame(session);
    walkNightSteps(session);
    playSuccessfulRound(session);
    playSuccessfulRound(session);
    playSuccessfulRound(session);
    if (session.state.phase.kind !== 'assassin') throw new Error('expected assassin phase');
    expect(leaderBadgeLabel(session.state)).toBe('队长');
    const assassinKey = Object.keys(session.state.roles).find(
      (key) => session.state.roles[Number(key)] === 'assassin',
    );
    if (assassinKey === undefined) throw new Error('expected an assassin');
    const assassinSeat = Number(assassinKey);
    session.send(
      { type: 'avalon.assassin.accuse', seat: (assassinSeat + 1) % 5 },
      session.seatUser(assassinSeat),
    );
    const endedState = session.state;
    if (endedState.phase.kind !== 'ended') throw new Error('expected ended phase');
    expect(leaderBadgeLabel(endedState)).toBeNull();
  });
});
