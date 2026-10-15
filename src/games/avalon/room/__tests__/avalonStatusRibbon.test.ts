/**
 * createAvalonStatusRibbon across the flow stages: the viewing stage
 * reports view progress; the night renders the shared progress shape
 * (step x of y + step label, aligned with werewolf — private
 * confirmation counts are never shown); later phases name their
 * public counts. States are produced by the real engine, never
 * hand-assembled.
 */
import {
  avalonEngine,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';

import { createAvalonStatusRibbon } from '../avalonRoomAdapter';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

function startFivePlayerGame(playerCount: 5 | 9 = 5) {
  let commandNumber = 0;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: playerCount },
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
  for (let seat = 0; seat < playerCount; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  send({ type: 'avalon.game.start' });
  return {
    get state() {
      return state;
    },
    send,
    seatUser,
  };
}

/** Views every seat and begins the game; acks the opening narration. */
function beginGame(session: ReturnType<typeof startFivePlayerGame>) {
  for (let seat = 0; seat < session.state.config.numberOfPlayers; seat += 1) {
    session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
  }
  session.send({ type: 'avalon.game.begin' });
  if (session.state.isAudioPlaying) session.send({ type: 'avalon.audio.ack' }, 'host');
}

function walkNightSteps(session: ReturnType<typeof startFivePlayerGame>) {
  const steps = ['evilReveal', 'merlinReveal', 'percivalReveal'] as const;
  for (const step of steps) {
    if (session.state.phase.kind !== 'night') break;
    if (session.state.isAudioPlaying) session.send({ type: 'avalon.audio.ack' }, 'host');
    for (const seat of getAvalonNightParticipants(session.state.roles, step)) {
      session.send({ type: 'avalon.night.confirm' }, session.seatUser(seat));
    }
    if (session.state.isAudioPlaying) session.send({ type: 'avalon.audio.ack' }, 'host');
  }
}

describe('createAvalonStatusRibbon — viewing stage', () => {
  it('reports view progress while the game waits in the viewing stage', () => {
    const session = startFivePlayerGame();
    expect(session.state.phase.kind).toBe('viewing');
    for (let seat = 0; seat < 4; seat += 1) {
      session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
    }
    expect(createAvalonStatusRibbon(session.state)).toEqual({
      kind: 'message',
      icon: 'guide',
      text: '等待全员查看身份 · 4/5',
      supportingText: null,
    });
  });

  it('reports ready once every seat has viewed, still in the viewing stage', () => {
    const session = startFivePlayerGame();
    for (let seat = 0; seat < 5; seat += 1) {
      session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
    }
    expect(session.state.phase.kind).toBe('viewing');
    expect(createAvalonStatusRibbon(session.state)).toEqual({
      kind: 'message',
      icon: 'guide',
      text: '全员已查看身份，等待房主开始游戏',
      supportingText: null,
    });
  });

  it('renders the night as shared progress (step x of y + label) once begun', () => {
    const session = startFivePlayerGame();
    beginGame(session);
    expect(session.state.phase.kind).toBe('night');
    expect(createAvalonStatusRibbon(session.state)).toEqual({
      kind: 'progress',
      current: 1,
      total: 3,
      label: '坏人互认',
    });
  });
});

describe('createAvalonStatusRibbon — public action counts', () => {
  it('counts cast ballots during the vote and plays during the quest', () => {
    const session = startFivePlayerGame();
    beginGame(session);
    walkNightSteps(session);
    expect(session.state.phase.kind).toBe('nominate');
    const leader = session.state.leaderSeat;
    session.send(
      { type: 'avalon.team.updateDraft', seats: [leader, (leader + 1) % 5] },
      session.seatUser(leader),
    );
    session.send({ type: 'avalon.team.propose' }, session.seatUser(leader));
    session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(0));
    session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(1));
    expect(createAvalonStatusRibbon(session.state)).toEqual({
      kind: 'message',
      icon: 'guide',
      text: '第 1 轮 · 组队投票中',
      supportingText: '已投 2/5',
    });
    for (let seat = 2; seat < 5; seat += 1) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    // Armed: everyone voted, the reveal countdown is running.
    const armed = createAvalonStatusRibbon(session.state);
    if (!armed || armed.kind !== 'message') throw new Error('expected message ribbon');
    expect(armed.supportingText).toBe('已全部投票 · 即将揭晓');
    session.send({ type: 'avalon.vote.finish' });
    expect(session.state.phase.kind).toBe('quest');
    const quest = createAvalonStatusRibbon(session.state);
    if (!quest || quest.kind !== 'message') throw new Error('expected message ribbon');
    expect(quest.supportingText).toBe('已出牌 0/2');
  });
});

describe('createAvalonStatusRibbon — nominate tally, lady and assassin supporting lines', () => {
  /** Plays one successful quest round from the current nominate phase. */
  function playSuccessfulRound(session: ReturnType<typeof startFivePlayerGame>) {
    const state = session.state;
    if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
    const leader = state.leaderSeat;
    const team: number[] = [leader];
    for (let seat = 0; team.length < state.phase.requiredSize; seat += 1) {
      if (!team.includes(seat)) team.push(seat);
    }
    session.send({ type: 'avalon.team.updateDraft', seats: team }, session.seatUser(leader));
    session.send({ type: 'avalon.team.propose' }, session.seatUser(leader));
    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.vote.finish' });
    for (const seat of team) {
      session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.quest.finish' });
  }

  function toNominate(session: ReturnType<typeof startFivePlayerGame>) {
    beginGame(session);
    walkNightSteps(session);
    if (session.state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
  }

  it('carries the quest tally as the nominate supporting line', () => {
    const session = startFivePlayerGame();
    toNominate(session);
    expect(createAvalonStatusRibbon(session.state)).toEqual({
      kind: 'message',
      icon: 'guide',
      text: '第 1 轮 · 队长组队中',
      supportingText: '任务成功 0 · 失败 0',
    });
    playSuccessfulRound(session);
    expect(createAvalonStatusRibbon(session.state)).toEqual({
      kind: 'message',
      icon: 'guide',
      text: '第 2 轮 · 队长组队中',
      supportingText: '任务成功 1 · 失败 0',
    });
  });

  it('names holder and target on the lady supporting line, never the result', () => {
    // 湖中仙女只存在于 9/10 人局（引擎规则），故此用例开 9 人局。
    const session = startFivePlayerGame(9);
    toNominate(session);
    playSuccessfulRound(session);
    playSuccessfulRound(session);
    if (session.state.phase.kind !== 'lady') throw new Error('expected the lady phase');
    const { holderSeat, examinedSeats } = session.state.phase;
    const selecting = createAvalonStatusRibbon(session.state);
    if (!selecting || selecting.kind !== 'message') throw new Error('expected message ribbon');
    expect(selecting.text).toBe('湖中仙女查验');
    expect(selecting.supportingText).toBe(`${holderSeat + 1} 号 · P${holderSeat} 正在选择查验目标`);
    const seats = Array.from({ length: 9 }, (_, seat) => seat);
    const target = seats.find((seat) => seat !== holderSeat && !examinedSeats.includes(seat));
    if (target === undefined) throw new Error('no eligible lady target');
    session.send({ type: 'avalon.lady.check', seat: target }, session.seatUser(holderSeat));
    const checking = createAvalonStatusRibbon(session.state);
    if (!checking || checking.kind !== 'message') throw new Error('expected message ribbon');
    expect(checking.supportingText).toBe(
      `${holderSeat + 1} 号 · P${holderSeat} 正在查验 ${target + 1} 号 · P${target}`,
    );
    expect(checking.supportingText).not.toContain('好人');
    expect(checking.supportingText).not.toContain('坏人');
  });

  it('waits for the assassin on the assassin supporting line', () => {
    const session = startFivePlayerGame();
    toNominate(session);
    playSuccessfulRound(session);
    playSuccessfulRound(session);
    if (session.state.phase.kind === 'lady') {
      const { holderSeat, examinedSeats } = session.state.phase;
      const target = [0, 1, 2, 3, 4].find(
        (seat) => seat !== holderSeat && !examinedSeats.includes(seat),
      );
      if (target === undefined) throw new Error('no eligible lady target');
      session.send({ type: 'avalon.lady.check', seat: target }, session.seatUser(holderSeat));
      session.send({ type: 'avalon.lady.acknowledge' }, session.seatUser(target));
    }
    playSuccessfulRound(session);
    if (session.state.phase.kind !== 'assassin') throw new Error('expected the assassin phase');
    expect(createAvalonStatusRibbon(session.state)).toEqual({
      kind: 'message',
      icon: 'guide',
      text: '刺杀阶段',
      supportingText: '等待刺客指认',
    });
  });
});
