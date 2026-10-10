/** Exercises Avalon through authoritative commands, never injecting progressed state. */

import type { CommandContext } from '../../../platform/engine';
import type { AvalonCommand } from '../commands/types';
import type { AvalonEffect } from '../domain/decision';
import { getAvalonNightParticipants } from '../domain/rules';
import { getAvalonViewModel } from '../domain/visibility';
import { avalonEngine } from '../engine';
import { parseAvalonState } from '../state/codec';
import {
  AVALON_BOARDS,
  AVALON_QUEST_SIZES,
  type AvalonBallot,
  type AvalonConfig,
  type AvalonPlay,
  type AvalonRoleId,
  DEFAULT_AVALON_CONFIG,
  isAvalonBotSeat,
  isAvalonEvilRole,
  isAvalonGoodRole,
} from '../state/types';

const GOOD_COUNTS: Record<number, number> = { 5: 3, 6: 4, 7: 4, 8: 5, 9: 6, 10: 6 };

function game(configOverrides: Partial<AvalonConfig> = {}, humanCount?: number) {
  let nowMs = 1000;
  let commandNumber = 0;
  const numberOfPlayers = configOverrides.numberOfPlayers ?? DEFAULT_AVALON_CONFIG.numberOfPlayers;
  let state = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, ...configOverrides },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const effects: AvalonEffect[] = [];
  const context = (userId: string, controlledSeat: number | null = null): CommandContext => ({
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: `seed:${commandNumber}`,
  });
  const apply = (command: AvalonCommand, ctx: CommandContext) => {
    const decision = avalonEngine.decide(state, command, ctx);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = parseAvalonState(
      JSON.parse(
        JSON.stringify(avalonEngine.normalize(decision.events.reduce(avalonEngine.evolve, state))),
      ),
    );
    effects.push(...decision.effects);
    return state;
  };
  const send = (command: AvalonCommand, userId = 'host', controlledSeat: number | null = null) =>
    apply(command, context(userId, controlledSeat));
  const decideAs = (
    command: AvalonCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => avalonEngine.decide(state, command, context(userId, controlledSeat));
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  const seatCount = humanCount ?? numberOfPlayers;
  for (let seat = 0; seat < seatCount; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  const api = {
    get state() {
      return state;
    },
    phase() {
      return state.phase;
    },
    effects,
    send,
    decideAs,
    seatUser,
    expectReject(
      command: AvalonCommand,
      reason: string,
      userId = 'host',
      controlledSeat: number | null = null,
    ) {
      const decision = decideAs(command, userId, controlledSeat);
      expect(decision.kind).toBe('reject');
      if (decision.kind === 'reject') expect(decision.reason).toBe(reason);
    },
    seatOfRole(role: AvalonRoleId): number {
      const seat = Object.keys(state.roles).find((key) => state.roles[Number(key)] === role);
      if (seat === undefined) throw new Error(`role ${role} not dealt`);
      return Number(seat);
    },
    goodSeats(): number[] {
      return Object.keys(state.roles)
        .map(Number)
        .filter((seat) => isAvalonGoodRole(state.roles[seat]!));
    },
    evilSeats(): number[] {
      return Object.keys(state.roles)
        .map(Number)
        .filter((seat) => isAvalonEvilRole(state.roles[seat]!));
    },
    startGame() {
      send({ type: 'avalon.game.start' });
      // 身份查看协议：全员先查看角色，否则第一个任务前的检查点不放行。
      for (let seat = 0; seat < seatCount; seat += 1) {
        send({ type: 'avalon.role.viewed' }, seatUser(seat));
      }
      // 开局播报由房主 ack（测试模拟房主已播完）。
      if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
    },
    /** 步进转场后的播报由房主 ack。 */
    ackAudio() {
      if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
    },
    /** 确认当前 night 步骤的全部参与者，直到天亮（机器人席位由房主接管确认）。 */
    passNight() {
      // 开局播报先 ack（对齐狼人杀：房主播完才放行确认）。
      if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
      while (state.phase.kind === 'night') {
        const participants = getAvalonNightParticipants(state.roles, state.phase.step);
        for (const seat of participants) {
          if (isAvalonBotSeat(state, seat)) {
            send({ type: 'avalon.night.confirm' }, 'host', seat);
          } else {
            send({ type: 'avalon.night.confirm' }, seatUser(seat));
          }
        }
        // 每步转场都排播报，ack 后才能继续。
        if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
      }
    },
    setNow(ms: number) {
      nowMs = ms;
    },
    leaderUser() {
      return seatUser(state.leaderSeat);
    },
    proposeTeam(team: readonly number[]) {
      send({ type: 'avalon.team.propose', seats: [...team] }, api.leaderUser());
    },
    voteAll(ballot: AvalonBallot) {
      for (let seat = 0; seat < numberOfPlayers; seat += 1) {
        send({ type: 'avalon.team.vote', vote: ballot }, seatUser(seat));
      }
    },
    finishVote() {
      // Settlement runs on the reveal countdown or this manual finish;
      // send only while the vote is still open or counting down.
      if (state.phase.kind === 'vote') send({ type: 'avalon.vote.finish' });
    },
    playAll(plays: Readonly<Record<number, AvalonPlay>>) {
      for (const [seat, play] of Object.entries(plays)) {
        send({ type: 'avalon.quest.play', play }, seatUser(Number(seat)));
      }
    },
    finishQuest() {
      if (state.phase.kind === 'quest') send({ type: 'avalon.quest.finish' });
    },
    /** 走完一轮：组队 → 全票赞成 → 房主结束投票 → 出牌 → 房主结束任务（跳过揭晓倒计时）。 */
    passQuestRound(team: readonly number[], plays: Readonly<Record<number, AvalonPlay>>) {
      if (api.phase().kind !== 'nominate') throw new Error('expected nominate phase');
      api.proposeTeam(team);
      api.voteAll('approve');
      api.finishVote();
      if (api.phase().kind !== 'quest') throw new Error('expected quest phase');
      api.playAll(plays);
      if (api.phase().kind === 'quest') api.finishQuest();
    },
    /** 走完一轮；若进入湖仙阶段则自动走完查验（9/10 人局连续推进用）。 */
    passQuestRoundAndLady(team: readonly number[], plays: Readonly<Record<number, AvalonPlay>>) {
      api.passQuestRound(team, plays);
      if (api.phase().kind === 'lady') api.passLady();
    },
    /** 持有人查验首个可查验座位，被查验者确认。 */
    passLady() {
      const phase = api.phase();
      if (phase.kind !== 'lady') throw new Error('expected lady phase');
      const pick = Array.from({ length: numberOfPlayers }, (_, seat) => seat).find(
        (seat) => seat !== phase.holderSeat && !phase.examinedSeats.includes(seat),
      );
      if (pick === undefined) throw new Error('no lady target available');
      send({ type: 'avalon.lady.check', seat: pick }, seatUser(phase.holderSeat));
      send({ type: 'avalon.lady.acknowledge' }, seatUser(pick));
    },
    accuse(target: number) {
      send({ type: 'avalon.assassin.accuse', seat: target }, seatUser(api.seatOfRole('assassin')));
    },
    earlyStrike(target: number) {
      send(
        { type: 'avalon.assassin.earlyStrike', seat: target },
        seatUser(api.seatOfRole('assassin')),
      );
    },
  };
  return api;
}

describe('Avalon engine', () => {
  it('rejects configs outside 5–10 players / 3–5 veto limit', () => {
    for (const numberOfPlayers of [4, 11]) {
      expect(() =>
        avalonEngine.createInitialState(
          { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: numberOfPlayers as 5 },
          { roomCode: '1', hostUserId: 'host', nowMs: 1, commandId: 'c' },
        ),
      ).toThrow();
    }
    for (const vetoLimit of [2, 6]) {
      expect(() =>
        avalonEngine.createInitialState(
          { ...DEFAULT_AVALON_CONFIG, vetoLimit: vetoLimit as 3 },
          { roomCode: '1', hostUserId: 'host', nowMs: 1, commandId: 'c' },
        ),
      ).toThrow();
    }
  });

  it.each([5, 6, 7, 8, 9, 10])('deals the fixed %d-player board (D2)', (players) => {
    const session = game({ numberOfPlayers: players as 5 });
    session.startGame();
    const dealt = Object.values(session.state.roles).sort();
    expect(dealt).toEqual([...AVALON_BOARDS[players as 5]].sort());
    expect(dealt).toContain('merlin');
    expect(dealt).toContain('assassin');
    const good = dealt.filter((role) => isAvalonGoodRole(role)).length;
    expect(good).toBe(GOOD_COUNTS[players]);
    expect(session.state.phase.kind).toBe('night');
    expect(session.state.gameSequence).toBe(1);
  });

  it('rejects starting when seats are not full or the actor is not the host', () => {
    const session = game({ numberOfPlayers: 6 }, 4);
    session.expectReject({ type: 'avalon.game.start' }, '请先坐满所有座位，或填充机器人。');
    session.expectReject({ type: 'avalon.game.start' }, '只有房主可以开始游戏', 'u1');
  });

  it('fills implicit bot seats and lets the host take them over', () => {
    const session = game({ numberOfPlayers: 6 }, 4);
    session.send({ type: 'room.seat.fillBots' });
    session.startGame();
    // 机器人席位由房主接管完成 night 确认，天亮后进入 nominate。
    session.passNight();
    expect(session.state.phase.kind).toBe('nominate');
  });

  it('runs the three night steps in order with correct visibility', () => {
    const session = game({ numberOfPlayers: 7 });
    session.startGame();
    expect(session.state.phase.kind).toBe('night');

    // evilReveal：坏人互认（奥伯伦除外）。
    const morgana = session.seatOfRole('morgana');
    const assassin = session.seatOfRole('assassin');
    const oberon = session.seatOfRole('oberon');
    const merlin = session.seatOfRole('merlin');
    const percival = session.seatOfRole('percival');
    const loyal = session.goodSeats().find((seat) => seat !== merlin && seat !== percival)!;

    let view = getAvalonViewModel(session.state, morgana);
    expect(view.nightStep).toBe('evilReveal');
    expect([...view.evilPeers!].sort()).toEqual([assassin]);
    view = getAvalonViewModel(session.state, oberon);
    expect(view.evilPeers).toBeNull();
    // 非参与者无信息且确认被拒绝。
    view = getAvalonViewModel(session.state, loyal);
    expect(view.evilPeers).toBeNull();
    expect(view.merlinSees).toBeNull();
    session.expectReject(
      { type: 'avalon.night.confirm' },
      '你不在当前确认步骤内',
      session.seatUser(loyal),
    );
    // 奥伯伦全程闭眼，不参与互认也不确认。
    session.expectReject(
      { type: 'avalon.night.confirm' },
      '你不在当前确认步骤内',
      session.seatUser(oberon),
    );

    for (const seat of [morgana, assassin]) {
      session.send({ type: 'avalon.night.confirm' }, session.seatUser(seat));
    }
    session.ackAudio();
    expect(session.state.phase.kind).toBe('night');
    if (session.state.phase.kind === 'night') expect(session.state.phase.step).toBe('merlinReveal');

    // merlinReveal：梅林看到坏人（7 人局无莫德雷德，看到全部 3 个坏人）。
    view = getAvalonViewModel(session.state, merlin);
    expect([...view.merlinSees!].sort()).toEqual([assassin, morgana, oberon].sort());
    session.send({ type: 'avalon.night.confirm' }, session.seatUser(merlin));
    session.ackAudio();
    if (session.state.phase.kind === 'night')
      expect(session.state.phase.step).toBe('percivalReveal');

    // percivalReveal：看到梅林 + 莫甘娜两人。
    view = getAvalonViewModel(session.state, percival);
    expect([...view.percivalSees!].sort()).toEqual([merlin, morgana].sort());
    session.send({ type: 'avalon.night.confirm' }, session.seatUser(percival));
    session.ackAudio();

    // 天亮：第 1 轮 nominate。
    expect(session.state.phase.kind).toBe('nominate');
    if (session.state.phase.kind === 'nominate') {
      expect(session.state.phase.round).toBe(1);
      expect(session.state.phase.requiredSize).toBe(AVALON_QUEST_SIZES[7][0]);
    }
  });

  it('hides Mordred from Merlin in 9-player games', () => {
    const session = game({ numberOfPlayers: 9 });
    session.startGame();
    const merlin = session.seatOfRole('merlin');
    const mordred = session.seatOfRole('mordred');
    // 先走完 evilReveal，进入 merlinReveal 再检查梅林视角。
    for (const seat of session.evilSeats()) {
      if (session.state.roles[seat] === 'oberon') continue; // 奥伯伦不参与确认
      session.send({ type: 'avalon.night.confirm' }, session.seatUser(seat));
    }
    session.ackAudio();
    const view = getAvalonViewModel(session.state, merlin);
    expect(view.nightStep).toBe('merlinReveal');
    expect(view.merlinSees).not.toContain(mordred);
    expect(view.merlinSees).toHaveLength(2);
    session.passNight();
    // 9 人局湖仙 token 给首任队长右手边。
    expect(session.state.ladyHolderSeat).not.toBeNull();
  });

  it('rejects team proposals from non-leaders or with wrong sizes', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    const leader = session.state.leaderSeat;
    const nonLeader = (leader + 1) % 6;
    session.expectReject(
      { type: 'avalon.team.propose', seats: [0, 1] },
      '只有当前队长可以组队',
      session.seatUser(nonLeader),
    );
    session.expectReject(
      { type: 'avalon.team.propose', seats: [0, 1, 2] },
      '队员人数必须为 2 人',
      session.seatUser(leader),
    );
    // 队长可以把自己选进队伍；组队后直接进入投票。
    session.send(
      { type: 'avalon.team.propose', seats: [leader, (leader + 1) % 6] },
      session.seatUser(leader),
    );
    const votePhase = session.phase();
    if (votePhase.kind !== 'vote') throw new Error('expected vote phase');
    expect(votePhase.proposedSeats).toContain(leader);
  });

  it('overwrites ballots on re-vote and settles on host finish (D15)', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    session.proposeTeam([0, 1]);
    session.send({ type: 'avalon.team.vote', vote: 'approve' }, 'host');
    session.send({ type: 'avalon.team.vote', vote: 'reject' }, 'host');
    if (session.state.phase.kind === 'vote') {
      expect(session.state.phase.ballots[0]).toBe('reject');
    }
    // 未投票视为弃权：只投 4 票。
    for (const seat of [1, 2, 3]) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    session.finishVote();
    expect(session.state.phase.kind).toBe('quest');
    expect(session.state.rejectStreak).toBe(0);
    if (session.state.phase.kind === 'quest') {
      expect(session.state.phase.approveCount).toBe(3);
      expect(session.state.phase.rejectCount).toBe(1);
      expect(session.state.phase.abstainCount).toBe(2);
    }
  });

  it('rejects ties, rotates the leader and bumps the streak', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    const firstLeader = session.state.leaderSeat;
    session.proposeTeam([0, 1]);
    // 3 赞成 3 反对：平票否决。
    for (const seat of [0, 1, 2]) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    for (const seat of [3, 4, 5]) {
      session.send({ type: 'avalon.team.vote', vote: 'reject' }, session.seatUser(seat));
    }
    session.finishVote();
    expect(session.state.phase.kind).toBe('nominate');
    expect(session.state.rejectStreak).toBe(1);
    expect(session.state.leaderSeat).toBe((firstLeader + 1) % 6);
    // 通过后清零。
    const team = [session.state.leaderSeat, (session.state.leaderSeat + 1) % 6];
    session.proposeTeam(team);
    session.voteAll('approve');
    session.finishVote();
    expect(session.state.phase.kind).toBe('quest');
    expect(session.state.rejectStreak).toBe(0);
  });

  it('arms a 5s reveal countdown when the last ballot lands, then settles on timeout', () => {
    const session = game({ numberOfPlayers: 5 });
    session.startGame();
    session.passNight();
    session.proposeTeam([0, 1]);
    if (session.state.phase.kind !== 'vote') throw new Error('expected vote phase');
    // Ballots open: no countdown is running and the timeout rejects.
    expect(session.state.phase.deadlineAt).toBeNull();
    session.expectReject({ type: 'avalon.vote.timeout' }, '尚未到截止时间', session.seatUser(2));
    for (const seat of [0, 1, 2, 3]) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    if (session.state.phase.kind !== 'vote') throw new Error('expected vote phase');
    expect(session.state.phase.deadlineAt).toBeNull();
    session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(4));
    if (session.state.phase.kind !== 'vote') throw new Error('expected vote phase');
    expect(session.state.phase.deadlineAt).toBe(1000 + 5000);
    session.expectReject({ type: 'avalon.vote.timeout' }, '尚未到截止时间', session.seatUser(2));
    session.setNow(1000 + 5000);
    session.send({ type: 'avalon.vote.timeout' }, session.seatUser(3));
    expect(session.state.phase.kind).toBe('quest');
    expect(session.state.lastVoteResult?.approveCount).toBe(5);
  });

  it('settles a reject majority when the countdown expires and rotates the leader', () => {
    const session = game({ numberOfPlayers: 5 });
    session.startGame();
    session.passNight();
    const firstLeader = session.state.leaderSeat;
    session.proposeTeam([0, 1]);
    session.voteAll('reject');
    expect(session.state.phase.kind).toBe('vote');
    session.setNow(1000 + 5000);
    session.send({ type: 'avalon.vote.timeout' }, session.seatUser(0));
    expect(session.state.phase.kind).toBe('nominate');
    expect(session.state.rejectStreak).toBe(1);
    expect(session.state.leaderSeat).toBe((firstLeader + 1) % 5);
  });

  it('keeps ballots changeable during the countdown without re-arming it', () => {
    const session = game({ numberOfPlayers: 5 });
    session.startGame();
    session.passNight();
    session.proposeTeam([0, 1]);
    for (const seat of [0, 1, 2, 3]) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.team.vote', vote: 'reject' }, session.seatUser(4));
    if (session.state.phase.kind !== 'vote') throw new Error('expected vote phase');
    expect(session.state.phase.deadlineAt).toBe(1000 + 5000);
    // Seat 0 changes their mind inside the countdown window; the deadline stands.
    session.send({ type: 'avalon.team.vote', vote: 'reject' }, session.seatUser(0));
    if (session.state.phase.kind !== 'vote') throw new Error('expected vote phase');
    expect(session.state.phase.deadlineAt).toBe(1000 + 5000);
    session.setNow(1000 + 5000);
    session.send({ type: 'avalon.vote.timeout' }, session.seatUser(1));
    expect(session.state.phase.kind).toBe('quest');
    expect(session.state.lastVoteResult?.approveCount).toBe(3);
    expect(session.state.lastVoteResult?.rejectCount).toBe(2);
  });

  it('ends the game when countdown settlements hit the veto limit (no manual finish)', () => {
    const session = game({ numberOfPlayers: 5, vetoLimit: 3 });
    session.startGame();
    session.passNight();
    let now = 1000;
    for (let round = 0; round < 3; round += 1) {
      const leader = session.state.leaderSeat;
      session.proposeTeam([leader, (leader + 1) % 5]);
      session.voteAll('reject');
      now += 5000;
      session.setNow(now);
      session.send({ type: 'avalon.vote.timeout' }, session.seatUser(0));
      if (round < 2) expect(session.state.phase.kind).toBe('nominate');
    }
    expect(session.state.phase.kind).toBe('ended');
    if (session.state.phase.kind === 'ended') {
      expect(session.state.phase.winner).toBe('evil');
      expect(session.state.phase.reason).toBe('vetoLimitReached');
    }
    expect(session.effects.filter((effect) => effect.type === 'avalon.game.completed').length).toBe(
      1,
    );
  });

  it('rejects timeouts from a bot-takeover actor, before arming, and after settlement', () => {
    const session = game({ numberOfPlayers: 5 });
    session.startGame();
    session.passNight();
    session.proposeTeam([0, 1]);
    // Not armed yet (ballots still open): any timeout rejects.
    session.expectReject({ type: 'avalon.vote.timeout' }, '尚未到截止时间', session.seatUser(2));
    session.voteAll('approve');
    session.setNow(1000 + 5000);
    // A host acting through a taken-over bot seat may not submit the timeout.
    const controlled = session.decideAs({ type: 'avalon.vote.timeout' }, 'host', 2);
    expect(controlled.kind).toBe('reject');
    session.send({ type: 'avalon.vote.timeout' }, session.seatUser(3));
    expect(session.state.phase.kind).toBe('quest');
    // Once settled, a late timeout hits the phase guard instead of double-settling.
    session.expectReject({ type: 'avalon.vote.timeout' }, '当前阶段不能执行此操作', 'host');
  });

  it('arms the quest reveal countdown when the last play lands, then settles on timeout', () => {
    const session = game({ numberOfPlayers: 5 });
    session.startGame();
    session.passNight();
    session.proposeTeam([0, 1]);
    session.voteAll('approve');
    session.finishVote();
    if (session.state.phase.kind !== 'quest') throw new Error('expected quest phase');
    expect(session.state.phase.deadlineAt).toBeNull();
    session.expectReject({ type: 'avalon.quest.timeout' }, '尚未到截止时间', session.seatUser(0));
    session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(0));
    if (session.state.phase.kind !== 'quest') throw new Error('expected quest phase');
    expect(session.state.phase.deadlineAt).toBeNull();
    session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(1));
    if (session.state.phase.kind !== 'quest') throw new Error('expected quest phase');
    expect(session.state.phase.deadlineAt).toBe(1000 + 5000);
    session.setNow(1000 + 5000);
    session.send({ type: 'avalon.quest.timeout' }, session.seatUser(1));
    expect(session.state.phase.kind).toBe('nominate');
    expect(session.state.questResults[0]).toBe('success');
  });

  it('keeps quest plays changeable during the countdown without re-arming it', () => {
    const session = game({ numberOfPlayers: 5 });
    session.startGame();
    session.passNight();
    const evil = session.evilSeats()[0]!;
    const good = session.goodSeats()[0]!;
    session.proposeTeam([evil, good]);
    session.voteAll('approve');
    session.finishVote();
    session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(evil));
    session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(good));
    if (session.state.phase.kind !== 'quest') throw new Error('expected quest phase');
    expect(session.state.phase.deadlineAt).toBe(1000 + 5000);
    // The evil member flips to a fail inside the countdown; the deadline stands.
    session.send({ type: 'avalon.quest.play', play: 'fail' }, session.seatUser(evil));
    if (session.state.phase.kind !== 'quest') throw new Error('expected quest phase');
    expect(session.state.phase.deadlineAt).toBe(1000 + 5000);
    session.setNow(1000 + 5000);
    session.send({ type: 'avalon.quest.timeout' }, session.seatUser(good));
    expect(session.state.questResults[0]).toBe('fail');
  });

  it('rejects vote.finish from non-hosts', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    session.proposeTeam([0, 1]);
    session.expectReject({ type: 'avalon.vote.finish' }, '只有房主可以结束投票', 'u1');
  });

  it.each([3, 5])('ends evil on vetoLimitReached at the %d boundary (D8)', (vetoLimit) => {
    const session = game({ numberOfPlayers: 6, vetoLimit: vetoLimit as 3 });
    session.startGame();
    session.passNight();
    for (let i = 0; i < vetoLimit; i += 1) {
      session.proposeTeam([0, 1]);
      session.voteAll('reject');
      session.finishVote();
    }
    expect(session.state.phase.kind).toBe('ended');
    if (session.state.phase.kind === 'ended') {
      expect(session.state.phase.winner).toBe('evil');
      expect(session.state.phase.reason).toBe('vetoLimitReached');
    }
    expect(session.effects.filter((effect) => effect.type === 'avalon.game.completed').length).toBe(
      1,
    );
  });

  it('reveals ballots in public mode and only counts in secret mode (D7)', () => {
    const open = game({ numberOfPlayers: 6, voteMode: 'public' });
    open.startGame();
    open.passNight();
    open.proposeTeam([0, 1]);
    open.voteAll('approve');
    open.finishVote();
    const openView = getAvalonViewModel(open.state, 2);
    expect(openView.ballots?.[0]).toBe('approve');
    open.playAll({ 0: 'success', 1: 'success' });
    open.finishQuest();
    const openSettledView = getAvalonViewModel(open.state, 2);
    expect(openSettledView.questHistory[0]?.ballots?.[0]).toBe('approve');

    const secret = game({ numberOfPlayers: 6, voteMode: 'secret' });
    secret.startGame();
    secret.passNight();
    secret.proposeTeam([0, 1]);
    secret.voteAll('approve');
    secret.finishVote();
    const secretView = getAvalonViewModel(secret.state, 2);
    expect(secretView.ballots).toBeNull();
    expect(secretView.voteCounts).toEqual({ approve: 6, reject: 0, abstain: 0 });
    secret.playAll({ 0: 'success', 1: 'success' });
    secret.finishQuest();
    const secretSettledView = getAvalonViewModel(secret.state, 2);
    expect(secretSettledView.questHistory[0]?.ballots).toBeNull();
    expect(secretSettledView.questHistory[0]?.approveCount).toBe(6);
  });

  it('rejects fail plays from good players and allows re-play before settle (D15)', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    const good = session.goodSeats()[0]!;
    const evil = session.evilSeats()[0]!;
    session.proposeTeam([good, evil]);
    session.voteAll('approve');
    session.finishVote();
    session.expectReject(
      { type: 'avalon.quest.play', play: 'fail' },
      '好人只能出成功牌',
      session.seatUser(good),
    );
    const outsider = [0, 1, 2, 3, 4, 5].find((seat) => seat !== good && seat !== evil)!;
    session.expectReject(
      { type: 'avalon.quest.play', play: 'success' },
      '你不在本轮任务队伍中',
      session.seatUser(outsider),
    );
    // 改牌：重出以后次为准。
    session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(evil));
    session.send({ type: 'avalon.quest.play', play: 'fail' }, session.seatUser(evil));
    if (session.state.phase.kind === 'quest') {
      expect(session.state.phase.plays[evil]).toBe('fail');
    }
    // 收齐前不揭晓他人选择。
    const otherView = getAvalonViewModel(session.state, good);
    expect(otherView.myPlay).toBeNull();
    const evilView = getAvalonViewModel(session.state, evil);
    expect(evilView.myPlay).toBe('fail');
  });

  it('lets the host finish the quest early with unplayed seats counting as success (D16)', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    const good = session.goodSeats();
    const team = [good[0]!, good[1]!];
    session.proposeTeam(team);
    session.voteAll('approve');
    session.finishVote();
    session.expectReject({ type: 'avalon.quest.finish' }, '只有房主可以结束任务', 'u1');
    session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(team[0]!));
    session.finishQuest();
    expect(session.state.questResults).toEqual(['success']);
    if (session.state.phase.kind === 'quest') {
      throw new Error('expected quest to settle');
    }
  });

  it('applies the fourth-quest double-fail rule for 7+ players', () => {
    const session = game({ numberOfPlayers: 7 });
    session.startGame();
    session.passNight();
    const good = session.goodSeats();
    const evil = session.evilSeats();
    // R1 成功，R2 失败，R3 成功 → R4（需 4 人）。
    session.passQuestRound([good[0]!, good[1]!], { [good[0]!]: 'success', [good[1]!]: 'success' });
    session.passQuestRound([good[0]!, good[1]!, evil[0]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [evil[0]!]: 'fail',
    });
    session.passQuestRound([good[0]!, good[1]!, good[2]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
    });
    if (session.state.phase.kind !== 'nominate' || session.state.phase.round !== 4) {
      throw new Error('expected round 4 nominate');
    }
    // R4：1 张失败 → 任务成功。
    const team4 = [good[0]!, good[1]!, good[2]!, evil[0]!];
    session.proposeTeam(team4);
    session.voteAll('approve');
    session.finishVote();
    session.playAll({
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
      [evil[0]!]: 'fail',
    });
    session.finishQuest();
    expect(session.state.questResults).toEqual(['success', 'fail', 'success', 'success']);
  });

  it('fails the fourth quest on a single fail for 6 players', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    const good = session.goodSeats();
    const evil = session.evilSeats();
    session.passQuestRound([good[0]!, good[1]!], { [good[0]!]: 'success', [good[1]!]: 'success' });
    session.passQuestRound([good[0]!, good[1]!, evil[0]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [evil[0]!]: 'fail',
    });
    session.passQuestRound([good[0]!, good[1]!, good[2]!, good[3]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
      [good[3]!]: 'success',
    });
    if (session.state.phase.kind !== 'nominate' || session.state.phase.round !== 4) {
      throw new Error('expected round 4 nominate');
    }
    // 6 人局第 4 轮：1 张失败即任务失败。
    const team4 = [good[0]!, good[1]!, evil[0]!];
    session.proposeTeam(team4);
    session.voteAll('approve');
    session.finishVote();
    session.playAll({
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [evil[0]!]: 'fail',
    });
    session.finishQuest();
    expect(session.state.questResults).toEqual(['success', 'fail', 'success', 'fail']);
  });

  it('ends evil on three failed quests', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    const good = session.goodSeats();
    const evil = session.evilSeats();
    const sizes = AVALON_QUEST_SIZES[6];
    for (let round = 0; round < 3; round += 1) {
      const team = [good[0]!, evil[0]!, ...good.slice(1, sizes[round]! - 1)];
      const plays: Record<number, AvalonPlay> = { [good[0]!]: 'success', [evil[0]!]: 'fail' };
      for (const seat of team) {
        if (plays[seat] === undefined) plays[seat] = 'success';
      }
      session.proposeTeam(team);
      session.voteAll('approve');
      session.finishVote();
      session.playAll(plays);
      session.finishQuest();
    }
    expect(session.state.phase.kind).toBe('ended');
    if (session.state.phase.kind === 'ended') {
      expect(session.state.phase.winner).toBe('evil');
      expect(session.state.phase.reason).toBe('threeFail');
    }
  });

  it('runs the lady check after rounds 2-4 in 9-player games (§2.3)', () => {
    const session = game({ numberOfPlayers: 9 });
    session.startGame();
    session.passNight();
    const good = session.goodSeats();
    // R1 成功（无湖仙）。
    session.passQuestRound([good[0]!, good[1]!, good[2]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
    });
    expect(session.state.phase.kind).toBe('nominate');
    // R2 成功后进入 lady。
    session.passQuestRound([good[0]!, good[1]!, good[2]!, good[3]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
      [good[3]!]: 'success',
    });
    session.finishQuest();
    expect(session.state.phase.kind).toBe('lady');
    if (session.state.phase.kind !== 'lady') throw new Error('expected lady phase');
    const holder = session.state.phase.holderSeat;
    expect(session.state.ladyExaminedSeats).toEqual([holder]);
    // 非持有人查验被拒绝；不能查验自己。
    const nonHolder = good.find((seat) => seat !== holder)!;
    session.expectReject(
      { type: 'avalon.lady.check', seat: nonHolder },
      '只有湖仙持有人可以查验',
      session.seatUser(nonHolder),
    );
    session.expectReject(
      { type: 'avalon.lady.check', seat: holder },
      '不能查验自己',
      session.seatUser(holder),
    );
    // 持有人查验一名好人；非被查验者确认被拒绝。
    const target = good.find((seat) => seat !== holder)!;
    session.send({ type: 'avalon.lady.check', seat: target }, session.seatUser(holder));
    session.expectReject(
      { type: 'avalon.lady.acknowledge' },
      '只有被查验者可以确认',
      session.seatUser(holder),
    );
    session.send({ type: 'avalon.lady.acknowledge' }, session.seatUser(target));
    // token 移交给被查验者；查验结果只对持有人可见。
    const afterPhase = session.phase();
    expect(afterPhase.kind).toBe('nominate');
    if (afterPhase.kind === 'nominate') expect(afterPhase.round).toBe(3);
    expect(session.state.ladyHolderSeat).toBe(target);
    expect(session.state.ladyExaminedSeats).toEqual([holder, target]);
    expect(getAvalonViewModel(session.state, holder).ladyCheckResult).toBe('good');
    expect(getAvalonViewModel(session.state, nonHolder).ladyCheckResult).toBeNull();
    // R3 失败后再次进入 lady（第 3 轮成功会直接进刺杀）：不能查验当过湖仙的玩家。
    const evil = session.evilSeats();
    const team3 = [good[0]!, good[1]!, good[2]!, evil[0]!];
    session.proposeTeam(team3);
    session.voteAll('approve');
    session.finishVote();
    session.playAll({
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
      [evil[0]!]: 'fail',
    });
    session.finishQuest();
    expect(session.state.phase.kind).toBe('lady');
    if (session.state.phase.kind !== 'lady') throw new Error('expected lady phase');
    expect(session.state.phase.holderSeat).toBe(target);
    session.expectReject(
      { type: 'avalon.lady.check', seat: holder },
      '该玩家已担任过湖仙，不能查验',
      session.seatUser(target),
    );
  });

  it('skips the lady phase in 8-player games', () => {
    const session = game({ numberOfPlayers: 8 });
    session.startGame();
    session.passNight();
    const good = session.goodSeats();
    session.passQuestRound([good[0]!, good[1]!, good[2]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
    });
    session.passQuestRound([good[0]!, good[1]!, good[2]!, good[3]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
      [good[3]!]: 'success',
    });
    expect(session.state.phase.kind).toBe('nominate');
    expect(session.state.ladyHolderSeat).toBeNull();
  });

  it('settles the assassination after three successes (D5a/D14)', () => {
    const session = game({ numberOfPlayers: 10 });
    session.startGame();
    session.passNight();
    const good = session.goodSeats();
    const merlin = session.seatOfRole('merlin');
    const oberon = session.seatOfRole('oberon');
    // R1/R2/R3 成功（R2/R3 后各有一次湖仙查验）。
    session.passQuestRoundAndLady([good[0]!, good[1]!, good[2]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
    });
    session.passQuestRoundAndLady([good[0]!, good[1]!, good[2]!, good[3]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
      [good[3]!]: 'success',
    });
    session.passQuestRoundAndLady([good[0]!, good[1]!, good[2]!, good[3]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
      [good[3]!]: 'success',
    });
    expect(session.state.phase.kind).toBe('assassin');
    // 刺杀阶段不亮牌（D11）。
    const assassinView = getAvalonViewModel(session.state, session.seatOfRole('assassin'));
    expect(assassinView.seats.every((seat) => seat.role === null)).toBe(true);
    expect(assassinView.canEarlyStrike).toBe(false);
    // 非刺客指认被拒绝；不能指认自己。
    session.expectReject(
      { type: 'avalon.assassin.accuse', seat: merlin },
      '只有刺客可以指认',
      session.seatUser(good[0]!),
    );
    session.expectReject(
      { type: 'avalon.assassin.accuse', seat: session.seatOfRole('assassin') },
      '不能指认自己',
      session.seatUser(session.seatOfRole('assassin')),
    );
    // 指认奥伯伦（坏人）也算刺错 → 好人胜（D14）。
    session.accuse(oberon);
    expect(session.state.phase.kind).toBe('ended');
    if (session.state.phase.kind === 'ended') {
      expect(session.state.phase.winner).toBe('good');
      expect(session.state.phase.reason).toBe('assassinationMiss');
      expect(session.state.phase.accusedSeat).toBe(oberon);
    }
  });

  it('lets the assassin flip the game by hitting Merlin', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    const good = session.goodSeats();
    const merlin = session.seatOfRole('merlin');
    for (let round = 0; round < 3; round += 1) {
      const size = AVALON_QUEST_SIZES[6][round]!;
      const team = good.slice(0, size);
      const plays: Record<number, AvalonPlay> = {};
      for (const seat of team) plays[seat] = 'success';
      session.passQuestRound(team, plays);
    }
    expect(session.state.phase.kind).toBe('assassin');
    session.accuse(merlin);
    if (session.state.phase.kind === 'ended') {
      expect(session.state.phase.winner).toBe('evil');
      expect(session.state.phase.reason).toBe('assassinationHit');
    }
    expect(session.effects.filter((effect) => effect.type === 'avalon.game.completed').length).toBe(
      1,
    );
  });

  it('supports early strike after night in any phase (D13)', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    const merlin = session.seatOfRole('merlin');
    // night 阶段拒绝提前刺杀。
    session.expectReject(
      { type: 'avalon.assassin.earlyStrike', seat: merlin },
      '晚上阶段不能刺杀',
      session.seatUser(session.seatOfRole('assassin')),
    );
    // 非刺客拒绝。
    session.passNight();
    session.expectReject(
      { type: 'avalon.assassin.earlyStrike', seat: merlin },
      '只有刺客可以刺杀',
      session.seatUser(merlin),
    );
    // nominate 阶段命中梅林 → 坏人直接胜。
    expect(getAvalonViewModel(session.state, session.seatOfRole('assassin')).canEarlyStrike).toBe(
      true,
    );
    session.earlyStrike(merlin);
    expect(session.state.phase.kind).toBe('ended');
    if (session.state.phase.kind === 'ended') {
      expect(session.state.phase.winner).toBe('evil');
      expect(session.state.phase.reason).toBe('earlyAssassinationHit');
    }
    // 终局后不可再发起。
    session.expectReject(
      { type: 'avalon.assassin.earlyStrike', seat: 0 },
      '当前阶段不能执行此操作',
      session.seatUser(session.seatOfRole('assassin')),
    );
  });

  it('wins good on an early strike miss, even against evil targets (D14)', () => {
    const session = game({ numberOfPlayers: 7 });
    session.startGame();
    session.passNight();
    const oberon = session.seatOfRole('oberon');
    session.proposeTeam([0, 1]);
    session.voteAll('approve');
    session.finishVote();
    // quest 阶段提前刺杀奥伯伦 → 刺错 → 好人胜。
    expect(getAvalonViewModel(session.state, session.seatOfRole('assassin')).canEarlyStrike).toBe(
      true,
    );
    session.earlyStrike(oberon);
    if (session.state.phase.kind === 'ended') {
      expect(session.state.phase.winner).toBe('good');
      expect(session.state.phase.reason).toBe('earlyAssassinationMiss');
    }
  });

  it('keeps per-role view models private (§6.2)', () => {
    const session = game({ numberOfPlayers: 9 });
    session.startGame();
    session.passNight();
    const loyal = session.goodSeats().find((seat) => session.state.roles[seat] === 'loyalServant')!;
    const view = getAvalonViewModel(session.state, loyal);
    expect(view.myRole).toBe('loyalServant');
    expect(view.evilPeers).toBeNull();
    expect(view.merlinSees).toBeNull();
    expect(view.percivalSees).toBeNull();
    expect(view.isAssassin).toBe(false);
    expect(view.canEarlyStrike).toBe(false);
    expect(view.ladyCheckResult).toBeNull();
    // 终局揭晓全员身份。
    const good = session.goodSeats();
    for (let round = 0; round < 3; round += 1) {
      const size = AVALON_QUEST_SIZES[9][round]!;
      const team = good.slice(0, size);
      const plays: Record<number, AvalonPlay> = {};
      for (const seat of team) plays[seat] = 'success';
      session.passQuestRoundAndLady(team, plays);
    }
    session.accuse(session.seatOfRole('merlin'));
    const endedView = getAvalonViewModel(session.state, loyal);
    expect(endedView.winner).toBe('evil');
    expect(endedView.endReason).toBe('assassinationHit');
    expect(endedView.seats.every((seat) => seat.role === session.state.roles[seat.seat])).toBe(
      true,
    );
  });

  it('restarts cleanly from ended and keeps the room config', () => {
    const session = game({ numberOfPlayers: 6, voteMode: 'secret', vetoLimit: 3 as const });
    session.startGame();
    session.passNight();
    const good = session.goodSeats();
    for (let round = 0; round < 3; round += 1) {
      const size = AVALON_QUEST_SIZES[6][round]!;
      const team = good.slice(0, size);
      const plays: Record<number, AvalonPlay> = {};
      for (const seat of team) plays[seat] = 'success';
      session.passQuestRound(team, plays);
    }
    session.accuse(session.seatOfRole('merlin'));
    expect(session.state.phase.kind).toBe('ended');
    session.send({ type: 'avalon.game.start' });
    expect(session.state.phase.kind).toBe('night');
    expect(session.state.gameSequence).toBe(2);
    expect(session.state.questResults).toEqual([]);
    expect(session.state.questHistory).toEqual([]);
    expect(session.state.rejectStreak).toBe(0);
    expect(session.state.xpSettled).toBe(false);
    expect(session.state.config).toEqual({ numberOfPlayers: 6, voteMode: 'secret', vetoLimit: 3 });
    expect(Object.keys(session.state.roles)).toHaveLength(6);
  });

  it('returns to lobby from ended', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    session.earlyStrike(session.seatOfRole('merlin'));
    expect(session.state.phase.kind).toBe('ended');
    session.expectReject({ type: 'avalon.game.returnToLobby' }, '只有房主可以返回大厅', 'u1');
    session.send({ type: 'avalon.game.returnToLobby' });
    expect(session.state.phase.kind).toBe('lobby');
    expect(session.state.leaderSeat).toBe(-1);
    expect(Object.keys(session.state.roles)).toHaveLength(0);
  });

  it('records quest history per round (captain/team/votes/result)', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    const leader = session.state.leaderSeat;
    const team = [leader, (leader + 1) % 6];
    session.proposeTeam(team);
    session.voteAll('approve');
    session.finishVote();
    session.playAll({ [team[0]!]: 'success', [team[1]!]: 'success' });
    session.finishQuest();
    expect(session.state.questHistory).toHaveLength(1);
    const entry = session.state.questHistory[0]!;
    expect(entry.round).toBe(1);
    expect(entry.leaderSeat).toBe(leader);
    expect(entry.teamSeats).toEqual(team);
    expect(entry.approveCount).toBe(6);
    expect(entry.result).toBe('success');
    expect(entry.successCount).toBe(2);
  });

  it('fail-fasts on corrupted state via normalize', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    const snapshot = (mutate: (raw: Record<string, unknown>) => void) => {
      const raw = JSON.parse(JSON.stringify(session.state)) as Record<string, unknown>;
      mutate(raw);
      return () => parseAvalonState(raw);
    };
    // 板子构成被篡改。
    expect(
      snapshot((raw) => {
        (raw['roles'] as Record<string, string>)['0'] = 'mordred';
      }),
    ).toThrow();
    // nightInfo 与 roles 不一致。
    expect(
      snapshot((raw) => {
        const nightInfo = raw['nightInfo'] as Record<string, unknown>;
        nightInfo['merlinSees'] = [0, 1, 2, 3, 4, 5];
      }),
    ).toThrow();
    // 未知字段。
    expect(
      snapshot((raw) => {
        raw['unexpected'] = 1;
      }),
    ).toThrow();
  });

  it('fail-fasts on corrupted ballots/plays/lady targets', () => {
    const session = game({ numberOfPlayers: 9 });
    session.startGame();
    session.passNight();
    const good = session.goodSeats();
    session.passQuestRound([good[0]!, good[1]!, good[2]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
    });
    session.passQuestRound([good[0]!, good[1]!, good[2]!, good[3]!], {
      [good[0]!]: 'success',
      [good[1]!]: 'success',
      [good[2]!]: 'success',
      [good[3]!]: 'success',
    });
    expect(session.state.phase.kind).toBe('lady');
    const snapshot = (mutate: (raw: Record<string, unknown>) => void) => {
      const raw = JSON.parse(JSON.stringify(session.state)) as Record<string, unknown>;
      mutate(raw);
      return () => parseAvalonState(raw);
    };
    // lady target 已在 examinedSeats 中。
    expect(
      snapshot((raw) => {
        const phase = raw['phase'] as Record<string, unknown>;
        phase['targetSeat'] = (phase['examinedSeats'] as number[])[0];
      }),
    ).toThrow();
    // questHistory ballots 含未知座位。
    expect(
      snapshot((raw) => {
        const history = raw['questHistory'] as Record<string, unknown>[];
        (history[0]!['ballots'] as Record<string, string>)['99'] = 'approve';
      }),
    ).toThrow();
  });

  it('updates config in the lobby', () => {
    const session = game({ numberOfPlayers: 6 }, 4);
    session.expectReject(
      {
        type: 'avalon.config.update',
        config: { numberOfPlayers: 6, voteMode: 'public', vetoLimit: 2 as 3 },
      },
      '阿瓦隆配置无效',
    );
    session.send({
      type: 'avalon.config.update',
      config: { numberOfPlayers: 5, voteMode: 'secret', vetoLimit: 4 },
    });
    expect(session.state.config).toEqual({ numberOfPlayers: 5, voteMode: 'secret', vetoLimit: 4 });
    // 人数变化后板子自动对应。
    session.send({ type: 'room.seat.take', seat: 4, profile: { displayName: 'P4' } }, 'u4');
    session.startGame();
    expect(Object.keys(session.state.roles)).toHaveLength(5);
  });

  it('records the vote result panel data when a team is approved', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    session.proposeTeam([0, 1]);
    session.voteAll('approve');
    session.finishVote();
    expect(session.state.phase.kind).toBe('quest');
    const last = session.state.lastVoteResult;
    expect(last).not.toBeNull();
    expect(last?.approved).toBe(true);
    expect(last?.rejectStreak).toBe(0);
    expect(last?.approveCount).toBe(6);
    expect(last?.rejectCount).toBe(0);
    expect(last?.abstainCount).toBe(0);
    expect(Object.keys(last?.ballots ?? {})).toHaveLength(6);
    expect(last?.ballots[0]).toBe('approve');
    // 公投模式 view 给全量逐人投票。
    const view = getAvalonViewModel(session.state, 2);
    expect(view.lastVoteResult?.approved).toBe(true);
    expect(view.lastVoteResult?.ballots?.[0]).toBe('approve');
  });

  it('records the vote result and streak when a team is rejected', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    session.proposeTeam([0, 1]);
    // 2 赞成 3 反对 1 弃权：否决。
    for (const seat of [0, 1]) {
      session.send({ type: 'avalon.team.vote', vote: 'approve' }, session.seatUser(seat));
    }
    for (const seat of [2, 3, 4]) {
      session.send({ type: 'avalon.team.vote', vote: 'reject' }, session.seatUser(seat));
    }
    session.finishVote();
    expect(session.state.phase.kind).toBe('nominate');
    expect(session.state.rejectStreak).toBe(1);
    const last = session.state.lastVoteResult;
    expect(last?.approved).toBe(false);
    expect(last?.rejectStreak).toBe(1);
    expect(last?.approveCount).toBe(2);
    expect(last?.rejectCount).toBe(3);
    expect(last?.abstainCount).toBe(1);
    expect(last?.ballots[5]).toBeUndefined();
    const view = getAvalonViewModel(session.state, 2);
    expect(view.lastVoteResult?.approved).toBe(false);
    expect(view.lastVoteResult?.rejectStreak).toBe(1);
    expect(view.lastVoteResult?.ballots?.[2]).toBe('reject');
    // 再否决一次，面板记第 2 次。
    const team = [session.state.leaderSeat, (session.state.leaderSeat + 1) % 6];
    session.proposeTeam(team);
    expect(session.state.lastVoteResult).toBeNull();
    session.voteAll('reject');
    session.finishVote();
    expect(session.state.lastVoteResult?.rejectStreak).toBe(2);
  });

  it('records the vote result when the veto limit ends the game', () => {
    const session = game({ numberOfPlayers: 6, vetoLimit: 3 });
    session.startGame();
    session.passNight();
    for (let i = 0; i < 3; i += 1) {
      session.proposeTeam([0, 1]);
      session.voteAll('reject');
      session.finishVote();
    }
    expect(session.state.phase.kind).toBe('ended');
    const last = session.state.lastVoteResult;
    expect(last?.approved).toBe(false);
    expect(last?.rejectStreak).toBe(3);
    expect(last?.rejectCount).toBe(6);
  });

  it('clears lastVoteResult when a new team is proposed', () => {
    const session = game({ numberOfPlayers: 6 });
    session.startGame();
    session.passNight();
    session.proposeTeam([0, 1]);
    session.voteAll('reject');
    session.finishVote();
    expect(session.state.phase.kind).toBe('nominate');
    expect(session.state.lastVoteResult).not.toBeNull();
    const team = [session.state.leaderSeat, (session.state.leaderSeat + 1) % 6];
    session.proposeTeam(team);
    expect(session.state.phase.kind).toBe('vote');
    expect(session.state.lastVoteResult).toBeNull();
    expect(getAvalonViewModel(session.state, 0).lastVoteResult).toBeNull();
  });

  it('hides per-seat ballots from the vote result panel in secret mode (D7)', () => {
    const secret = game({ numberOfPlayers: 6, voteMode: 'secret' });
    secret.startGame();
    secret.passNight();
    secret.proposeTeam([0, 1]);
    secret.voteAll('reject');
    secret.finishVote();
    expect(secret.state.lastVoteResult?.approved).toBe(false);
    const view = getAvalonViewModel(secret.state, 2);
    expect(view.lastVoteResult?.approved).toBe(false);
    expect(view.lastVoteResult?.rejectStreak).toBe(1);
    expect(view.lastVoteResult?.ballots).toBeNull();
    expect(view.lastVoteResult?.approveCount).toBe(0);
    expect(view.lastVoteResult?.rejectCount).toBe(6);
    expect(view.lastVoteResult?.abstainCount).toBe(0);
  });

  it('queues night narration on game start and blocks confirm until host ack', () => {
    // startGame helper 已 ack；这里手动走一遍验证队列内容。
    const raw = game({ numberOfPlayers: 7 });
    raw.send({ type: 'avalon.game.start' });
    expect(raw.state.isAudioPlaying).toBe(true);
    expect(raw.state.pendingAudioEffects.map((e) => e.audioKey)).toEqual(['night', 'evil_reveal']);
    // 播报未播完时确认被阻塞。
    const morgana = raw.seatOfRole('morgana');
    raw.expectReject(
      { type: 'avalon.night.confirm' },
      '播报尚未结束，请稍候',
      raw.seatUser(morgana),
    );
    // 非房主 ack 被拒绝（确保用非 0 号座位，莫甘娜可能随机分到房主座位）。
    const nonHostSeat = morgana === 0 ? 1 : morgana;
    raw.expectReject(
      { type: 'avalon.audio.ack' },
      '只有房主可以确认播报',
      raw.seatUser(nonHostSeat),
    );
    // 房主 ack 后放行。
    raw.send({ type: 'avalon.audio.ack' }, 'host');
    expect(raw.state.isAudioPlaying).toBe(false);
    expect(raw.state.pendingAudioEffects).toEqual([]);
  });

  it('queues step transition narration with end+begin pairs', () => {
    const session = game({ numberOfPlayers: 7 });
    session.send({ type: 'avalon.game.start' });
    // 身份查看协议：全员先查看角色，夜晚完成不被检查点拦住。
    for (let seat = 0; seat < 7; seat += 1) {
      session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
    }
    // 开局队列：night + evil_reveal begin。
    expect(session.state.pendingAudioEffects.map((e) => e.audioKey)).toEqual([
      'night',
      'evil_reveal',
    ]);
    session.send({ type: 'avalon.audio.ack' }, 'host');
    // 走完 evilReveal → merlinReveal：evil_reveal end + merlin_reveal begin。
    for (const seat of [session.seatOfRole('morgana'), session.seatOfRole('assassin')]) {
      session.send({ type: 'avalon.night.confirm' }, session.seatUser(seat));
    }
    expect(session.state.pendingAudioEffects).toEqual([
      { audioKey: 'evil_reveal', isEndAudio: true },
      { audioKey: 'merlin_reveal' },
    ]);
    session.send({ type: 'avalon.audio.ack' }, 'host');
    // 走完 merlinReveal → percivalReveal。
    session.send({ type: 'avalon.night.confirm' }, session.seatUser(session.seatOfRole('merlin')));
    expect(session.state.pendingAudioEffects).toEqual([
      { audioKey: 'merlin_reveal', isEndAudio: true },
      { audioKey: 'percival_reveal' },
    ]);
    session.send({ type: 'avalon.audio.ack' }, 'host');
    // 走完 percivalReveal → 天亮：percival_reveal end + night_end。
    session.send(
      { type: 'avalon.night.confirm' },
      session.seatUser(session.seatOfRole('percival')),
    );
    expect(session.state.pendingAudioEffects).toEqual([
      { audioKey: 'percival_reveal', isEndAudio: true },
      { audioKey: 'night_end' },
    ]);
  });

  it('blocks returnToLobby while audio is playing', () => {
    const session = game({ numberOfPlayers: 6 });
    session.send({ type: 'avalon.game.start' });
    // 身份查看协议：全员先查看角色，夜晚完成不被检查点拦住。
    for (let seat = 0; seat < 6; seat += 1) {
      session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
    }
    // 不 ack 开局播报，手动走完 night（每步 ack 转场播报，但保留最后的 night_end 未 ack）。
    session.send({ type: 'avalon.audio.ack' }, 'host');
    const evilSeats = [session.seatOfRole('morgana'), session.seatOfRole('assassin')];
    for (const seat of evilSeats) {
      session.send({ type: 'avalon.night.confirm' }, session.seatUser(seat));
    }
    session.send({ type: 'avalon.audio.ack' }, 'host');
    session.send({ type: 'avalon.night.confirm' }, session.seatUser(session.seatOfRole('merlin')));
    session.send({ type: 'avalon.audio.ack' }, 'host');
    session.send(
      { type: 'avalon.night.confirm' },
      session.seatUser(session.seatOfRole('percival')),
    );
    // 此时 night_end 播报未 ack，isAudioPlaying=true，phase=nominate。
    expect(session.state.isAudioPlaying).toBe(true);
    // 刺客提前刺杀结束游戏（nominate 阶段允许）。
    session.send(
      { type: 'avalon.assassin.earlyStrike', seat: session.seatOfRole('merlin') },
      session.seatUser(session.seatOfRole('assassin')),
    );
    expect(session.state.phase.kind).toBe('ended');
    // ended 但音频未播完，returnToLobby 被门控阻塞。
    session.expectReject({ type: 'avalon.game.returnToLobby' }, '播报尚未结束，请稍候');
    // ack 后放行。
    session.send({ type: 'avalon.audio.ack' }, 'host');
    session.send({ type: 'avalon.game.returnToLobby' });
    expect(session.state.phase.kind).toBe('lobby');
  });
});
