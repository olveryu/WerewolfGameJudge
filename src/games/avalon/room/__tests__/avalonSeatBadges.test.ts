/**
 * createAvalonSeatDataSource badges: the quest phase marks team seats that
 * have already played with 已出牌 (existence only, never the card content),
 * without per-seat vote progress. States come from the real engine.
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
  let nowMs = 1000;
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
      nowMs,
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
  send({ type: 'avalon.roles.assign' });
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'avalon.role.viewed' }, seatUser(seat));
  }
  send({ type: 'avalon.game.begin' });
  if (state.isAudioPlaying)
    send({ type: 'avalon.audio.ack', audioBatchId: state.audioBatchId }, 'host');
  for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
    if (state.phase.kind !== 'night') break;
    for (const seat of getAvalonNightParticipants(state.roles, step)) {
      send({ type: 'avalon.night.confirm' }, seatUser(seat));
    }
    if (state.isAudioPlaying)
      send({ type: 'avalon.audio.ack', audioBatchId: state.audioBatchId }, 'host');
  }
  const leader = state.leaderSeat;
  send({ type: 'avalon.team.preselect', seats: [leader, (leader + 1) % 5] }, seatUser(leader));
  send({ type: 'avalon.team.propose', seats: [leader, (leader + 1) % 5] }, seatUser(leader));
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(seat));
  }
  // 全员投完后倒计时到期结算（手动结束已删）：把时钟推到 deadline 发 expire。
  const armedVote = state.phase;
  if (armedVote.kind !== 'vote' || armedVote.deadlineAt === null) {
    throw new Error('expected an armed vote countdown');
  }
  nowMs = armedVote.deadlineAt;
  send({ type: 'avalon.phase.expire' });
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
    // 出牌前：组队者本人在队伍里，组队者与队员两个事实同显。
    const beforePlay = createAvalonSeatDataSource({
      state: session.state,
      revision: 1,
      userId: 'host',
      controlledSeat: null,
    });
    expect(beforePlay.getSeat(leader)).toMatchObject({
      statusBadge: null,
      indicators: {
        selection: { kind: 'selected', label: '队员' },
        markers: [
          {
            key: 'leader',
            label: '组队者',
            tone: 'warning',
          },
        ],
        progressLabel: null,
      },
    });
    session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(leader));
    const source = createAvalonSeatDataSource({
      state: session.state,
      revision: 2,
      userId: 'host',
      controlledSeat: null,
    });
    expect(source.getSeat(leader).indicators).toEqual({
      selection: { kind: 'selected', label: '队员' },
      markers: [
        {
          key: 'leader',
          label: '组队者',
          tone: 'warning',
        },
      ],
      progressLabel: '已出牌',
    });
    const other = (leader + 1) % 5;
    expect(source.getSeat(other).indicators).toEqual({
      markers: [],
      selection: { kind: 'selected', label: '队员' },
      progressLabel: null,
    });
    const outsider = (leader + 2) % 5;
    expect(source.getSeat(outsider).indicators).toEqual({
      markers: [],
      selection: null,
      progressLabel: null,
    });
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
    send({ type: 'avalon.roles.assign' });
    for (let seat = 0; seat < 5; seat += 1) {
      send({ type: 'avalon.role.viewed' }, seatUser(seat));
    }
    send({ type: 'avalon.game.begin' });
    if (state.isAudioPlaying)
      send({ type: 'avalon.audio.ack', audioBatchId: state.audioBatchId }, 'host');
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
    send({ type: 'avalon.roles.assign' });
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
    expect(evilView.getSeat(firstEvil).indicators?.progressLabel).toBe('已确认');
    // A non-participant (good player) sees nothing about the private confirm.
    const goodSeat = [0, 1, 2, 3, 4].find((seat) => !evilSeats.includes(seat));
    if (goodSeat === undefined) throw new Error('expected a good seat');
    const goodView = createAvalonSeatDataSource({
      state: session.state,
      revision: 1,
      userId: session.seatUser(goodSeat),
      controlledSeat: null,
    });
    expect(goodView.getSeat(firstEvil).indicators?.progressLabel).toBeNull();
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
  it('keeps selection independent of the leader and distinguishes replaced preselected seats', () => {
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
    send({ type: 'avalon.roles.assign' });
    for (let seat = 0; seat < 5; seat += 1) {
      send({ type: 'avalon.role.viewed' }, seatUser(seat));
    }
    send({ type: 'avalon.game.begin' });
    if (state.isAudioPlaying)
      send({ type: 'avalon.audio.ack', audioBatchId: state.audioBatchId }, 'host');
    for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
      if (state.phase.kind !== 'night') break;
      for (const seat of getAvalonNightParticipants(state.roles, step)) {
        send({ type: 'avalon.night.confirm' }, seatUser(seat));
      }
      if (state.isAudioPlaying)
        send({ type: 'avalon.audio.ack', audioBatchId: state.audioBatchId }, 'host');
    }
    if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
    const leader = state.leaderSeat;
    const pickedSeat = (leader + 1) % 5;
    const unpickedSeat = (leader + 2) % 5;
    // 选人在组队者的弹窗里，不是房间状态：预选前座位盘没有任何选择徽标。
    const before = createAvalonSeatDataSource({
      state,
      revision: 1,
      userId: 'host',
      controlledSeat: null,
    });
    expect(before.getSeat(pickedSeat).indicators?.selection).toBeNull();
    expect(before.getSeat(leader).indicators).toMatchObject({
      selection: null,
      markers: [{ key: 'leader' }],
    });
    // 预选锁定后全房看到「预选」；组队者徽标与选择独立。
    send({ type: 'avalon.team.preselect', seats: [pickedSeat, leader] }, seatUser(leader));
    const preselected = createAvalonSeatDataSource({
      state,
      revision: 2,
      userId: 'host',
      controlledSeat: null,
    });
    expect(preselected.getSeat(pickedSeat).indicators?.selection?.kind).toBe('preselected');
    expect(preselected.getSeat(leader).indicators).toMatchObject({
      selection: { kind: 'preselected' },
      markers: [{ key: 'leader' }],
    });
    expect(preselected.getSeat(unpickedSeat).indicators?.selection).toBeNull();
    // 最终队伍与预选不同：进入投票后只有最终队伍亮「队员」，预选不再显示。
    send({ type: 'avalon.team.propose', seats: [unpickedSeat, leader] }, seatUser(leader));
    const afterPropose: AvalonState = state;
    if (afterPropose.phase.kind !== 'vote') throw new Error('expected vote phase');
    const proposed = createAvalonSeatDataSource({
      state,
      revision: 3,
      userId: 'host',
      controlledSeat: null,
    });
    expect(proposed.getSeat(pickedSeat).indicators?.selection).toBeNull();
    expect(proposed.getSeat(unpickedSeat).indicators?.selection?.kind).toBe('selected');
    expect(proposed.getSeat(leader).indicators).toMatchObject({
      selection: { kind: 'selected' },
      markers: [{ key: 'leader' }],
    });
  });
});

describe('createAvalonSeatDataSource — leader badge phase gate', () => {
  function startSession(numberOfPlayers: AvalonPlayerCount) {
    let commandNumber = 0;
    let nowMs = 1000;
    let state: AvalonState = avalonEngine.createInitialState(
      { ...DEFAULT_AVALON_CONFIG, numberOfPlayers },
      { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
    );
    const send = (command: AvalonPublicCommand, userId = 'host') => {
      const context: CommandContext = {
        actor: { kind: 'user', userId },
        controlledSeat: null,
        nowMs,
        commandId: `command:${commandNumber++}`,
        randomSeed: `seed:${commandNumber}`,
      };
      const decision = avalonEngine.decide(state, command, context);
      if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
      state = decision.events.reduce(avalonEngine.evolve, state);
      return state;
    };
    /** 全员投完/出完后把时钟推到 deadline 并发公开 expire——唯一关轮路径（手动结算已删）。 */
    const settle = () => {
      const phase = state.phase;
      if ((phase.kind !== 'vote' && phase.kind !== 'quest') || phase.deadlineAt === null) return;
      nowMs = phase.deadlineAt;
      send({ type: 'avalon.phase.expire' });
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
      settle,
      seatUser,
    };
  }

  type Session = ReturnType<typeof startSession>;

  /** The 组队者-carrying badge label anywhere on the seat board, or null when gated off. */
  function leaderBadgeLabel(state: AvalonState): string | null {
    const source = createAvalonSeatDataSource({
      state,
      revision: 1,
      userId: 'host',
      controlledSeat: null,
    });
    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      const marker = source
        .getSeat(seat)
        .indicators?.markers.find((entry) => entry.key === 'leader');
      if (marker !== undefined) return marker.label;
    }
    return null;
  }

  function beginGame(session: Session) {
    session.send({ type: 'avalon.roles.assign' });
    for (let seat = 0; seat < session.state.config.numberOfPlayers; seat += 1) {
      session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.game.begin' });
    if (session.state.isAudioPlaying)
      session.send({ type: 'avalon.audio.ack', audioBatchId: session.state.audioBatchId }, 'host');
  }

  function walkNightSteps(session: Session) {
    for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
      if (session.state.phase.kind !== 'night') break;
      for (const seat of getAvalonNightParticipants(session.state.roles, step)) {
        session.send({ type: 'avalon.night.confirm' }, session.seatUser(seat));
      }
      if (session.state.isAudioPlaying)
        session.send(
          { type: 'avalon.audio.ack', audioBatchId: session.state.audioBatchId },
          'host',
        );
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
      { type: 'avalon.team.preselect', seats: team },
      session.seatUser(state.leaderSeat),
    );
    session.send({ type: 'avalon.team.propose', seats: team }, session.seatUser(state.leaderSeat));
    return team;
  }

  /** Plays one full successful round starting from the nominate phase. */
  function playSuccessfulRound(session: Session) {
    const team = proposeTeam(session);
    for (let seat = 0; seat < session.state.config.numberOfPlayers; seat += 1) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    session.settle();
    for (const seat of team) {
      session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(seat));
    }
    session.settle();
  }

  it('shows the leader badge in daytime phases only across a game walk', () => {
    const session = startSession(5);
    const seen: Array<readonly [AvalonPhaseKind, string | null]> = [];
    const record = () => {
      seen.push([session.state.phase.kind, leaderBadgeLabel(session.state)] as const);
    };
    record();
    session.send({ type: 'avalon.roles.assign' });
    record();
    for (let seat = 0; seat < 5; seat += 1) {
      session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.game.begin' });
    if (session.state.isAudioPlaying)
      session.send({ type: 'avalon.audio.ack', audioBatchId: session.state.audioBatchId }, 'host');
    record();
    walkNightSteps(session);
    record();
    const team = proposeTeam(session);
    record();
    for (let seat = 0; seat < 5; seat += 1) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    session.settle();
    record();
    for (const seat of team) {
      session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(seat));
    }
    session.settle();
    record();
    expect(seen).toEqual([
      ['lobby', null],
      ['viewing', null],
      ['night', null],
      ['nominate', '组队者'],
      ['vote', '组队者'],
      ['quest', '组队者'],
      ['nominate', '组队者'],
    ]);
  });

  it.each([9, 10] as const)(
    'shows the Lady from dealing and transfers it independently in a %i-player game',
    (numberOfPlayers) => {
      const session = startSession(numberOfPlayers);
      const source = () =>
        createAvalonSeatDataSource({
          state: session.state,
          revision: 1,
          userId: 'host',
          controlledSeat: null,
        });
      const ladySeats = () => {
        const seats = source();
        return Array.from({ length: numberOfPlayers }, (_entry, seat) => seat).filter((seat) =>
          seats.getSeat(seat).indicators?.markers.some((marker) => marker.key === 'lady'),
        );
      };
      expect(ladySeats()).toEqual([]);
      session.send({ type: 'avalon.roles.assign' });
      const holder = session.state.ladyHolderSeat;
      if (holder === null) throw new Error('expected initial Lady holder');
      expect(session.state.phase.kind).toBe('viewing');
      expect(ladySeats()).toEqual([holder]);
      for (let seat = 0; seat < numberOfPlayers; seat += 1) {
        session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
      }
      session.send({ type: 'avalon.game.begin' });
      if (session.state.isAudioPlaying)
        session.send({ type: 'avalon.audio.ack', audioBatchId: session.state.audioBatchId });
      expect(ladySeats()).toEqual([holder]);
      walkNightSteps(session);
      expect(ladySeats()).toEqual([holder]);
      playSuccessfulRound(session);
      playSuccessfulRound(session);
      if (session.state.phase.kind !== 'lady') throw new Error('expected lady phase');
      expect(leaderBadgeLabel(session.state)).toBe('组队者');
      const target = (session.state.leaderSeat + 1) % numberOfPlayers;
      session.send({ type: 'avalon.lady.check', seat: target }, session.seatUser(holder));
      expect(ladySeats()).toEqual([holder]);
      session.send({ type: 'avalon.lady.acknowledge' }, session.seatUser(target));
      expect(ladySeats()).toEqual([target]);
      proposeTeam(session);
      expect(source().getSeat(target).indicators).toMatchObject({
        selection: { kind: 'selected', label: '队员' },
        markers: [{ key: 'leader' }, { key: 'lady' }],
        progressLabel: null,
      });
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(target));
      expect(source().getSeat(target).indicators?.progressLabel).toBeNull();
      expect(source().getSeat(target).indicators?.selection).toEqual({
        kind: 'selected',
        label: '队员',
      });
    },
  );

  it('shows the leader badge in the assassin phase and drops it once ended', () => {
    const session = startSession(5);
    beginGame(session);
    walkNightSteps(session);
    playSuccessfulRound(session);
    playSuccessfulRound(session);
    playSuccessfulRound(session);
    if (session.state.phase.kind !== 'assassin') throw new Error('expected assassin phase');
    expect(leaderBadgeLabel(session.state)).toBe('组队者');
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
