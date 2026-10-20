/**
 * createAvalonHistorySummary: the seat-board summary strip is a pure
 * projection of authoritative state — latest settle conclusion first,
 * current-round status otherwise, nothing in the lobby. Driven through
 * real engine commands, never injected state.
 */
import {
  type AvalonCommand,
  avalonEngine,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
  isAvalonEvilRole,
} from '@game-judge/game-engine/games/avalon/public';

import { createAvalonHistorySummary } from '../avalonRoomAdapter';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

function session() {
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
  };
  const userOf = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, userOf(seat));
  }
  const ackAudio = () => {
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' });
  };
  return {
    get state() {
      return state;
    },
    send,
    userOf,
    /** Deals, clears the viewing checkpoint, and passes the first night. */
    toNominate() {
      send({ type: 'avalon.roles.assign' });
      for (let seat = 0; seat < 5; seat += 1) send({ type: 'avalon.role.viewed' }, userOf(seat));
      send({ type: 'avalon.game.begin' });
      ackAudio();
      while (state.phase.kind === 'night') {
        const participants = getAvalonNightParticipants(state.roles, state.phase.step);
        for (const seat of participants) send({ type: 'avalon.night.confirm' }, userOf(seat));
        ackAudio();
      }
      if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
    },
    /** Proposes the leader's team and settles the vote with one ballot for all. */
    settleVote(ballot: 'approve' | 'reject') {
      if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
      const leader = state.leaderSeat;
      const size = state.phase.requiredSize;
      const team = Array.from({ length: size }, (_, index) => (leader + index) % 5);
      send({ type: 'avalon.team.updateDraft', seats: team }, userOf(leader));
      send({ type: 'avalon.team.propose' }, userOf(leader));
      for (let seat = 0; seat < 5; seat += 1) {
        send({ type: 'avalon.team.vote', vote: ballot }, userOf(seat));
      }
      send({ type: 'avalon.vote.finish' });
      return team;
    },
    /** Settles the in-flight quest; the first evil team member (if any) fails it. */
    settleQuest() {
      if (state.phase.kind !== 'quest') throw new Error('expected quest phase');
      for (const seat of state.phase.teamSeats) {
        const play = isAvalonEvilRole(state.roles[seat]!) ? 'fail' : 'success';
        send({ type: 'avalon.quest.play', play }, userOf(seat));
      }
      send({ type: 'avalon.quest.finish' });
    },
  };
}

describe('createAvalonHistorySummary', () => {
  it('is hidden in the lobby and narrates viewing and night', () => {
    const room = session();
    expect(createAvalonHistorySummary(room.state)).toBeNull();
    room.send({ type: 'avalon.roles.assign' });
    expect(createAvalonHistorySummary(room.state)).toBe('身份查看阶段');
    for (let seat = 0; seat < 5; seat += 1) {
      room.send({ type: 'avalon.role.viewed' }, room.userOf(seat));
    }
    room.send({ type: 'avalon.game.begin' });
    expect(createAvalonHistorySummary(room.state)).toBe('第一晚');
  });

  it('narrates the current proposal while nominating and voting', () => {
    const room = session();
    room.toNominate();
    expect(createAvalonHistorySummary(room.state)).toBe('任务一 · 第1次提案 · 队长组队中');
    if (room.state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
    const leader = room.state.leaderSeat;
    room.send(
      { type: 'avalon.team.updateDraft', seats: [leader, (leader + 1) % 5] },
      room.userOf(leader),
    );
    room.send({ type: 'avalon.team.propose' }, room.userOf(leader));
    expect(createAvalonHistorySummary(room.state)).toBe('任务一 · 第1次提案投票中');
  });

  it('shows the vote conclusion after a rejection and after an approval', () => {
    const room = session();
    room.toNominate();
    room.settleVote('reject');
    expect(createAvalonHistorySummary(room.state)).toBe('任务一 · 提案被否决（赞成 0 · 反对 5）');
    room.settleVote('approve');
    expect(room.state.phase.kind).toBe('quest');
    expect(createAvalonHistorySummary(room.state)).toBe('任务一 · 队伍通过（赞成 5 · 反对 0）');
  });

  it('shows the quest conclusion once the quest settles', () => {
    const room = session();
    room.toNominate();
    // Round 1 team is leader + next seat; whether it fails depends on the
    // dealt roles, so assert against the recorded outcome either way.
    room.settleVote('approve');
    room.settleQuest();
    const record = room.state.roundHistory[0];
    if (record?.quest === null || record?.quest === undefined)
      throw new Error('expected a settled quest record');
    const expected =
      record.quest.result === 'success'
        ? `任务一 · 成功（成功票 ${record.quest.successCount}）`
        : `任务一 · 失败（失败票 ${record.quest.failCount}）`;
    expect(createAvalonHistorySummary(room.state)).toBe(expected);
  });

  it('shows the end conclusion after the veto limit ends the game', () => {
    const room = session();
    room.toNominate();
    for (let attempt = 0; attempt < 5; attempt += 1) room.settleVote('reject');
    expect(room.state.phase.kind).toBe('ended');
    expect(createAvalonHistorySummary(room.state)).toBe('本局结束 · 坏人获胜');
  });
});
