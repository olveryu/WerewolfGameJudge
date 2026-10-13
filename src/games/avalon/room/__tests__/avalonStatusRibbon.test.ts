/**
 * createAvalonStatusRibbon across the flow stages: the viewing stage
 * reports view progress; the night renders the shared progress shape
 * (step x of y + step label, aligned with werewolf — private
 * confirmation counts are never shown); later phases name their
 * public counts. States are produced by the real engine, never
 * hand-assembled.
 */
import {
  type AvalonCommand,
  avalonEngine,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';

import { createAvalonStatusRibbon } from '../avalonRoomAdapter';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

function startFivePlayerGame() {
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
  for (let seat = 0; seat < 5; seat += 1) {
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
      { type: 'avalon.team.propose', seats: [leader, (leader + 1) % 5] },
      session.seatUser(leader),
    );
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
