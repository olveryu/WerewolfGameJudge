/**
 * deriveAvalonBottomProgress: the night renders the shared step-progress
 * shape (step x of y + step label, aligned with werewolf — private
 * confirmation counts are never shown) for the bottom panel's slim
 * progress row; every other phase carries no progress. States are
 * produced by the real engine, never hand-assembled.
 */
import {
  avalonEngine,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';

import { deriveAvalonBottomProgress } from '../avalonRoomAdapter';

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

describe('deriveAvalonBottomProgress', () => {
  it('carries no progress in the lobby or the viewing stage', () => {
    const session = startFivePlayerGame();
    expect(session.state.phase.kind).toBe('viewing');
    expect(deriveAvalonBottomProgress(session.state)).toBeNull();
  });

  it('renders the night as shared progress (step x of y + label) once begun', () => {
    const session = startFivePlayerGame();
    beginGame(session);
    expect(session.state.phase.kind).toBe('night');
    expect(deriveAvalonBottomProgress(session.state)).toEqual({
      current: 1,
      total: 3,
      label: '坏人互认',
    });
  });

  it('advances with the night steps and ends with the night', () => {
    const session = startFivePlayerGame();
    beginGame(session);
    const steps = ['evilReveal', 'merlinReveal', 'percivalReveal'] as const;
    for (const step of steps) {
      if (session.state.phase.kind !== 'night') break;
      if (session.state.isAudioPlaying) session.send({ type: 'avalon.audio.ack' }, 'host');
      for (const seat of getAvalonNightParticipants(session.state.roles, step)) {
        session.send({ type: 'avalon.night.confirm' }, session.seatUser(seat));
      }
      if (session.state.isAudioPlaying) session.send({ type: 'avalon.audio.ack' }, 'host');
    }
    expect(session.state.phase.kind).not.toBe('night');
    expect(deriveAvalonBottomProgress(session.state)).toBeNull();
  });
});
