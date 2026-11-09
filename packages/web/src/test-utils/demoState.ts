/**
 * Demo rounds played through the real engine for client tests: a full
 * four-seat lobby, a game started into its playing phase, and a game
 * ended through the engine's terminal seam.
 */

import {
  DEFAULT_DEMO_CONFIG,
  type DemoCommand,
  demoEngine,
  type DemoState,
  endDemoGame,
} from '@game-judge/game-engine/games/demo/public';

type CommandContext = Parameters<typeof demoEngine.decide>[2];

function context(userId: string, commandId: string): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs: 1000,
    commandId,
    randomSeed: 'seed',
  };
}

/** Applies one command as `userId` (the host by default); a rejected command fails the test. */
export function driveDemoTestCommand(
  state: DemoState,
  command: DemoCommand,
  userId = 'host',
): DemoState {
  const decision = demoEngine.decide(state, command, context(userId, command.type));
  if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  return decision.events.reduce(demoEngine.evolve, state);
}

/** A full four-seat lobby: the host, one more player (`u1`) and two bots. */
export function buildDemoTestLobby(): DemoState {
  let state = demoEngine.createInitialState(
    { ...DEFAULT_DEMO_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  state = driveDemoTestCommand(state, {
    type: 'room.seat.take',
    seat: 0,
    profile: { displayName: '房主' },
  });
  state = driveDemoTestCommand(
    state,
    { type: 'room.seat.take', seat: 1, profile: { displayName: '小明' } },
    'u1',
  );
  return driveDemoTestCommand(state, { type: 'room.seat.fillBots' });
}

/** Starts a game from a full lobby or a finished game and plays it into its playing phase. */
export function startDemoTestGame(from: DemoState): DemoState {
  let state = from;
  state = driveDemoTestCommand(state, { type: 'demo.roles.assign' });
  state = driveDemoTestCommand(state, { type: 'demo.role.viewed' });
  state = driveDemoTestCommand(state, { type: 'demo.role.viewed' }, 'u1');
  state = driveDemoTestCommand(state, { type: 'demo.bots.markAllBotsViewed' });
  return driveDemoTestCommand(state, { type: 'demo.game.begin' });
}

/** Ends a playing game through the engine's terminal seam. */
export function endDemoTestGame(playing: DemoState): DemoState {
  const decision = endDemoGame(playing, context('host', 'end'));
  if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  return decision.events.reduce(demoEngine.evolve, playing);
}
