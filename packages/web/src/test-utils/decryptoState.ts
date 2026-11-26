/**
 * Decrypto client fixtures driven through the real engine, including a complete match.
 */

import {
  type DecryptoCode,
  type DecryptoCommand,
  decryptoEngine,
  type DecryptoInternalCommand,
  type DecryptoState,
  type DecryptoTeam,
  DEFAULT_DECRYPTO_CONFIG,
} from '@game-judge/game-engine/games/decrypto/public';

import type { ReviewTestRounds } from './reviewTestRounds';

type CommandContext = Parameters<typeof decryptoEngine.decide>[2];

function context(
  userId: string,
  commandId: string,
  options: { readonly controlledSeat?: number | null; readonly nowMs?: number } = {},
): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: options.controlledSeat ?? null,
    nowMs: options.nowMs ?? 1000,
    commandId,
    randomSeed: commandId,
  };
}

function systemContext(commandId: string, nowMs = 1000): CommandContext {
  return {
    actor: { kind: 'system', effectId: commandId },
    controlledSeat: null,
    nowMs,
    commandId,
    randomSeed: commandId,
  };
}

/** Applies one command and fails the fixture immediately if the engine rejects it. */
export function driveDecryptoTestCommand(
  state: DecryptoState,
  command: DecryptoCommand,
  userId = 'host',
  options: { readonly controlledSeat?: number | null; readonly nowMs?: number } = {},
): DecryptoState {
  const decision = decryptoEngine.decide(state, command, context(userId, command.type, options));
  if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  return decision.events.reduce(decryptoEngine.evolve, state);
}

function driveInternalCommand(
  state: DecryptoState,
  command: DecryptoInternalCommand,
  commandId: string,
  nowMs = 1000,
): DecryptoState {
  const decision = decryptoEngine.decide(state, command, systemContext(commandId, nowMs));
  if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  return decision.events.reduce(decryptoEngine.evolve, state);
}

/** A full four-seat lobby with two people and two bots. */
export function buildDecryptoTestLobby(numberOfPlayers = 4): DecryptoState {
  let state = decryptoEngine.createInitialState(
    { ...DEFAULT_DECRYPTO_CONFIG, numberOfPlayers },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  state = driveDecryptoTestCommand(state, {
    type: 'room.seat.take',
    seat: 0,
    profile: { displayName: '房主' },
  });
  state = driveDecryptoTestCommand(
    state,
    { type: 'room.seat.take', seat: 1, profile: { displayName: '小明' } },
    'u1',
  );
  return driveDecryptoTestCommand(state, { type: 'room.seat.fillBots' });
}

/** Begins the game and opens the host-only team assignment phase. */
export function startDecryptoTestGame(from: DecryptoState): DecryptoState {
  return driveDecryptoTestCommand(from, { type: 'decrypto.game.begin' });
}

/** Confirms teams and completes the asynchronous word selection through its internal command. */
export function prepareDecryptoTestGame(from: DecryptoState): DecryptoState {
  const state = driveDecryptoTestCommand(from, { type: 'decrypto.teams.confirm' });
  return completeWordSelection(state);
}

function completeWordSelection(state: DecryptoState): DecryptoState {
  if (state.phase.kind !== 'preparing') throw new Error('Expected word preparation');
  return driveInternalCommand(
    state,
    {
      type: 'decrypto.words.selected',
      requestId: state.phase.requestId,
      keywords: {
        blue: ['苹果', '桥梁', '火山', '钢琴'],
        purple: ['月亮', '雨伞', '沙漠', '冰箱'],
      },
    },
    'words-selected',
  );
}

function seatActor(
  state: DecryptoState,
  seat: number,
): {
  readonly userId: string;
  readonly controlledSeat: number | null;
} {
  const occupant = state.roster[seat];
  if (occupant === null || occupant === undefined) throw new Error(`Missing seat ${seat}`);
  return 'userId' in occupant
    ? { userId: occupant.userId, controlledSeat: null }
    : { userId: state.hostUserId, controlledSeat: seat };
}

function submitAsSeat(
  state: DecryptoState,
  seat: number,
  command: DecryptoCommand,
  nowMs?: number,
): DecryptoState {
  const actor = seatActor(state, seat);
  return driveDecryptoTestCommand(state, command, actor.userId, {
    controlledSeat: actor.controlledSeat,
    ...(nowMs === undefined ? {} : { nowMs }),
  });
}

function wrongCode(code: DecryptoCode): DecryptoCode {
  const replacement = [1, 2, 3, 4].find((value) => !code.includes(value));
  if (replacement === undefined) throw new Error('A Decrypto code must leave one unused number');
  return [replacement, code[1], code[2]];
}

function submitRoundActions(state: DecryptoState): DecryptoState {
  if (state.phase.kind !== 'playing') throw new Error('Expected a playing game');
  const game = state.phase.game;
  for (const team of ['blue', 'purple'] as const) {
    const encryptor = game.encryptors?.[team];
    if (encryptor === undefined || encryptor === null) throw new Error(`Missing ${team} encryptor`);
    state = submitAsSeat(state, encryptor, {
      type: 'decrypto.clues.submit',
      clues: [`${team}线索一`, `${team}线索二`, `${team}线索三`],
    });
  }
  if (state.phase.kind !== 'playing') throw new Error('Expected the guess phase');
  for (const team of ['blue', 'purple'] as const) {
    if (state.phase.kind !== 'playing') throw new Error('Expected the guess phase');
    const currentGame = state.phase.game;
    const encryptor = currentGame.encryptors?.[team];
    if (encryptor === undefined || encryptor === null) throw new Error(`Missing ${team} encryptor`);
    const decoder = Object.entries(currentGame.assignments).find(
      ([seat, assignedTeam]) => assignedTeam === team && Number(seat) !== encryptor,
    )?.[0];
    if (decoder === undefined) throw new Error(`Missing ${team} decoder`);
    state = submitAsSeat(state, Number(decoder), {
      type: 'decrypto.guess.submit',
      kind: 'decode',
      guess: wrongCode(currentGame.codes[team]),
    });
    if (currentGame.round > 1) {
      state = submitAsSeat(state, Number(decoder), {
        type: 'decrypto.guess.submit',
        kind: 'intercept',
        guess: wrongCode(currentGame.codes[team === 'blue' ? 'purple' : 'blue']),
      });
    }
  }
  return advanceRevealToCompletion(state);
}

function advanceRevealToCompletion(state: DecryptoState): DecryptoState {
  let revealNumber = 0;
  while (state.phase.kind === 'playing' && state.phase.game.step === 'reveal') {
    const game = state.phase.game;
    const revealAt = game.revealAt;
    const activeTeam = game.activeTeam;
    if (revealAt === null || activeTeam === null)
      throw new Error('Reveal step is missing its timer or active team');
    state = driveInternalCommand(
      state,
      {
        type: 'decrypto.reveal.advance',
        gameSequence: state.gameSequence,
        round: game.round,
        team: activeTeam,
        revealIndex: game.revealIndex,
        revealAt,
      },
      `reveal-${revealNumber}`,
      revealAt,
    );
    revealNumber += 1;
  }
  if (revealNumber === 0) throw new Error('Expected staged reveal to run');
  return state;
}

function submitTiebreak(state: DecryptoState): DecryptoState {
  if (state.phase.kind !== 'playing' || state.phase.game.step !== 'tiebreakSubmit')
    throw new Error('Expected tiebreak submission');
  for (const team of ['blue', 'purple'] as const) {
    if (state.phase.kind !== 'playing' || state.phase.game.step !== 'tiebreakSubmit')
      throw new Error('Expected tiebreak submission');
    const seat = Object.entries(state.phase.game.assignments).find(
      ([, assignedTeam]) => assignedTeam === team,
    )?.[0];
    if (seat === undefined) throw new Error(`Missing ${team} tiebreak submitter`);
    state = submitAsSeat(state, Number(seat), {
      type: 'decrypto.tiebreak.submit',
      guesses: [`${team}词一`, `${team}词二`, `${team}词三`, `${team}词四`],
    });
  }
  return state;
}

/** Plays two rounds and stops at the host's tiebreak judgement. */
export function buildDecryptoTiebreakTestGame(from: DecryptoState): DecryptoState {
  let state =
    from.phase.kind === 'playing'
      ? from
      : from.phase.kind === 'preparing'
        ? completeWordSelection(from)
        : prepareDecryptoTestGame(from.phase.kind === 'teams' ? from : startDecryptoTestGame(from));
  state = submitRoundActions(state);
  if (state.phase.kind !== 'playing' || state.phase.game.step !== 'continue')
    throw new Error('Expected the first round to continue');
  state = driveDecryptoTestCommand(state, {
    type: 'decrypto.reveal.continue',
    gameSequence: state.gameSequence,
  });
  state = submitRoundActions(state);
  state = submitTiebreak(state);
  if (state.phase.kind !== 'playing' || state.phase.game.step !== 'tiebreakJudge')
    throw new Error('Expected host tiebreak judgement');
  return state;
}

/** Plays two rounds, reaches the real tiebreak, and settles a winner. */
export function endDecryptoTestGame(from: DecryptoState): DecryptoState {
  let state = buildDecryptoTiebreakTestGame(from);
  state = driveDecryptoTestCommand(state, {
    type: 'decrypto.tiebreak.judge',
    team: 'blue',
    correct: [true, true, false, false],
  });
  state = driveDecryptoTestCommand(state, {
    type: 'decrypto.tiebreak.judge',
    team: 'purple',
    correct: [true, false, false, false],
  });
  if (state.phase.kind !== 'ended') throw new Error('Expected a settled game');
  return state;
}

export function buildDecryptoStateForPhase(phase: DecryptoState['phase']['kind']): DecryptoState {
  const lobby = buildDecryptoTestLobby();
  if (phase === 'lobby') return lobby;
  const teams = startDecryptoTestGame(lobby);
  if (phase === 'teams') return teams;
  const prepared = prepareDecryptoTestGame(teams);
  if (phase === 'preparing') {
    const state = driveDecryptoTestCommand(teams, { type: 'decrypto.teams.confirm' });
    if (state.phase.kind !== 'preparing') throw new Error('Expected preparation state');
    return state;
  }
  if (phase === 'playing') return prepared;
  return endDecryptoTestGame(prepared);
}

export const DECRYPTO_REVIEW_ROUNDS: ReviewTestRounds<DecryptoState> = {
  lobby: buildDecryptoTestLobby,
  ended: () => endDecryptoTestGame(buildDecryptoTestLobby()),
  nextRound: (ended) => ({ ...ended, gameSequence: ended.gameSequence + 1 }),
};

export type { DecryptoTeam };
