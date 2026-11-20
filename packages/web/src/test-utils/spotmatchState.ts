/**
 * 一眼成对 rounds played through the real engine for client tests: a full
 * four-seat lobby, a game started into its playing phase, and a game
 * ended through the engine's terminal seam.
 */

import {
  DEFAULT_SPOTMATCH_CONFIG,
  type SpotmatchCommand,
  spotmatchEngine,
  type SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';

import type { ReviewTestRounds } from './reviewTestRounds';

type CommandContext = Parameters<typeof spotmatchEngine.decide>[2];

function context(
  userId: string,
  commandId: string,
  controlledSeat: number | null = null,
): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs: 1000,
    commandId,
    randomSeed: 'seed',
  };
}

/** Applies one command as `userId` (the host by default); a rejected command fails the test. */
function driveSpotmatchTestCommand(
  state: SpotmatchState,
  command: SpotmatchCommand,
  userId = 'host',
  controlledSeat: number | null = null,
): SpotmatchState {
  const decision = spotmatchEngine.decide(state, command, {
    ...context(userId, command.type, controlledSeat),
    nowMs: state.round?.success?.until ?? 1000,
  });
  if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  return decision.events.reduce(spotmatchEngine.evolve, state);
}

/** A full four-seat lobby: the host, one more player (`u1`) and two bots. */
export function buildSpotmatchTestLobby(): SpotmatchState {
  let state = spotmatchEngine.createInitialState(
    { ...DEFAULT_SPOTMATCH_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  state = driveSpotmatchTestCommand(state, {
    type: 'room.seat.take',
    seat: 0,
    profile: { displayName: '房主' },
  });
  state = driveSpotmatchTestCommand(
    state,
    { type: 'room.seat.take', seat: 1, profile: { displayName: '小明' } },
    'u1',
  );
  return driveSpotmatchTestCommand(state, { type: 'room.seat.fillBots' });
}

/** Starts a game from a full lobby or a finished game and plays it into its playing phase. */
export function startSpotmatchTestGame(from: SpotmatchState): SpotmatchState {
  const state =
    from.phase.kind === 'ended'
      ? driveSpotmatchTestCommand(from, {
          type: 'spotmatch.game.restart',
          gameSequence: from.gameSequence,
          expectedPhase: 'ended',
        })
      : from;
  return driveSpotmatchTestCommand(state, { type: 'spotmatch.game.begin' });
}

/** Ends a playing game through the engine's terminal seam. */
export function endSpotmatchTestGame(playing: SpotmatchState): SpotmatchState {
  let state = playing;
  while (state.phase.kind === 'playing') {
    const round = state.round;
    const top = round?.players[0]?.top;
    if (round == null || top == null) throw new Error('Missing test hand');
    const symbolId = top.symbols.find((symbol) => round.central.symbols.includes(symbol));
    if (symbolId === undefined) throw new Error('Missing match');
    state = driveSpotmatchTestCommand(state, {
      type: 'spotmatch.card.claim',
      roundId: round.roundId,
      centralInstanceId: round.central.instanceId,
      topInstanceId: top.instanceId,
      symbolId,
    });
  }
  return state;
}

export const SPOTMATCH_REVIEW_ROUNDS: ReviewTestRounds<SpotmatchState> = {
  lobby: buildSpotmatchTestLobby,
  ended: () => endSpotmatchTestGame(startSpotmatchTestGame(buildSpotmatchTestLobby())),
  nextRound: (ended) => ({ ...ended, gameSequence: ended.gameSequence + 1 }),
};
