/**
 * createAvalonStatusRibbon at the Identity Viewing checkpoint: while
 * the night is held for missing role views, the ribbon names the
 * blocker; at every other moment it names the current night step
 * as text (private confirmation counts are never shown).
 * States are produced by the real engine, never hand-assembled.
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
  if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  return {
    get state() {
      return state;
    },
    send,
    seatUser,
  };
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

describe('createAvalonStatusRibbon — viewing checkpoint', () => {
  it('names the current night step as text while steps are still running (no private counts)', () => {
    const session = startFivePlayerGame();
    expect(createAvalonStatusRibbon(session.state)).toEqual({
      kind: 'message',
      icon: 'guide',
      text: '天黑 · 坏人互认',
      supportingText: null,
    });
  });

  it('names the missing role views once the night is held at the checkpoint', () => {
    const session = startFivePlayerGame();
    // Everyone but seat 4 views their role; then the night steps finish.
    for (let seat = 0; seat < 4; seat += 1) {
      session.send({ type: 'avalon.role.viewed' }, session.seatUser(seat));
    }
    walkNightSteps(session);
    expect(session.state.phase.kind).toBe('night');

    const ribbon = createAvalonStatusRibbon(session.state);
    expect(ribbon).toEqual({
      kind: 'message',
      icon: 'guide',
      text: '等待全员查看身份 · 还差 1 人',
      supportingText: null,
    });
  });
});
