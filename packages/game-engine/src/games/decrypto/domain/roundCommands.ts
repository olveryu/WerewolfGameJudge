/** Clue, decoding, reveal, and tiebreak commands for Decrypto rounds. */

import { reject, requireHost } from '../../../platform/engine';
import { resolveActingSeat } from '../../../platform/room/actingSeat';
import type { DecryptoCommand } from '../commands/types';
import {
  DECRYPTO_MAX_ROUNDS,
  DECRYPTO_REVEAL_INTERVAL_MS,
  DECRYPTO_TEAMS,
  type DecryptoClues,
  type DecryptoClueTriple,
  type DecryptoCode,
  type DecryptoGame,
  type DecryptoHistory,
  type DecryptoHistoryEntry,
  type DecryptoMarks,
  type DecryptoState,
  type DecryptoTeam,
} from '../state/types';
import {
  commitDecrypto,
  DECRYPTO_REASONS,
  type DecryptoDecision,
  type DecryptoEffect,
  type DecryptoEvent,
} from './decision';
import { createDecryptoRound, nextDecryptoEncryptors, otherDecryptoTeam } from './rules';

function sameCode(left: DecryptoCode, right: DecryptoCode): boolean {
  return left.every((value, index) => value === right[index]);
}

function currentTeam(
  state: DecryptoState,
  context: Parameters<typeof requireHost>[0],
): { readonly seat: number; readonly team: DecryptoTeam } | null {
  if (state.phase.kind !== 'playing') return null;
  const acting = resolveActingSeat(state, state.config.numberOfPlayers, context);
  if (acting.kind === 'rejected') return null;
  const team = state.phase.game.assignments[acting.value];
  return team === undefined ? null : { seat: acting.value, team };
}

function submitClues(
  state: DecryptoState,
  command: Extract<DecryptoCommand, { type: 'decrypto.clues.submit' }>,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  if (state.phase.kind !== 'playing' || state.phase.game.step !== 'encrypt')
    return reject(DECRYPTO_REASONS.phase);
  const acting = currentTeam(state, context);
  if (acting === null) return reject(DECRYPTO_REASONS.notTeamMember);
  const game = state.phase.game;
  if (game.encryptors?.[acting.team] !== acting.seat) return reject(DECRYPTO_REASONS.notEncryptor);
  if (game.clues[acting.team] !== null) return reject(DECRYPTO_REASONS.stale);
  if (
    command.clues.length !== 3 ||
    command.clues.some((clue) => typeof clue !== 'string' || clue.trim().length === 0)
  )
    return reject(DECRYPTO_REASONS.invalidClues);
  const [first, second, third] = command.clues;
  if (first === undefined || second === undefined || third === undefined)
    return reject(DECRYPTO_REASONS.invalidClues);
  const teamClues: DecryptoClueTriple = [first.trim(), second.trim(), third.trim()];
  const clues: DecryptoClues = {
    ...game.clues,
    [acting.team]: teamClues,
  };
  const ready = clues.blue !== null && clues.purple !== null;
  const updated: DecryptoGame = {
    ...game,
    clues,
    step: ready ? 'guess' : 'encrypt',
  };
  return commitDecrypto([{ type: 'decrypto.game.updated', game: updated }]);
}

function validGuess(game: DecryptoGame, team: DecryptoTeam, kind: 'decode' | 'intercept'): boolean {
  if (kind === 'decode') return game.decoded[team] === null;
  return game.round > 1 && game.intercepted[team] === null;
}

function revealSequence(round: number): readonly ('intercept' | 'decode' | 'code')[] {
  return round === 1
    ? ['decode', 'code', 'decode', 'code']
    : ['intercept', 'decode', 'code', 'intercept', 'decode', 'code'];
}

function scheduleReveal(
  state: DecryptoState,
  game: DecryptoGame,
  revealIndex: number,
  team: DecryptoTeam,
  revealAt: number,
): DecryptoEffect {
  return {
    type: 'decrypto.reveal.due',
    payload: {
      gameSequence: state.gameSequence,
      round: game.round,
      team,
      revealIndex,
      revealAt,
    },
  };
}

function beginReveal(state: DecryptoState, game: DecryptoGame, nowMs: number): DecryptoDecision {
  const sequence = revealSequence(game.round);
  const revealAt = nowMs + DECRYPTO_REVEAL_INTERVAL_MS;
  const updated: DecryptoGame = {
    ...game,
    step: 'reveal',
    activeTeam: 'blue',
    revealSequence: sequence,
    revealIndex: 0,
    revealAt,
  };
  return commitDecrypto(
    [{ type: 'decrypto.game.updated', game: updated }],
    [scheduleReveal(state, updated, 0, 'blue', revealAt)],
  );
}

function submitGuess(
  state: DecryptoState,
  command: Extract<DecryptoCommand, { type: 'decrypto.guess.submit' }>,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  if (state.phase.kind !== 'playing' || state.phase.game.step !== 'guess')
    return reject(DECRYPTO_REASONS.phase);
  const acting = currentTeam(state, context);
  if (acting === null) return reject(DECRYPTO_REASONS.notTeamMember);
  const game = state.phase.game;
  if (game.encryptors?.[acting.team] === acting.seat)
    return reject(DECRYPTO_REASONS.ineligibleDecoder);
  if (command.kind !== 'decode' && command.kind !== 'intercept')
    return reject(DECRYPTO_REASONS.invalidGuess);
  if (command.kind === 'intercept' && game.round === 1)
    return reject(DECRYPTO_REASONS.invalidGuess);
  if (!validGuess(game, acting.team, command.kind)) return reject(DECRYPTO_REASONS.duplicateGuess);
  if (
    command.guess.length !== 3 ||
    command.guess.some((value) => !Number.isSafeInteger(value) || value < 1 || value > 4) ||
    new Set(command.guess).size !== 3
  )
    return reject(DECRYPTO_REASONS.invalidGuess);
  const guess: DecryptoCode = [command.guess[0], command.guess[1], command.guess[2]];
  const updated: DecryptoGame = {
    ...game,
    decoded: command.kind === 'decode' ? { ...game.decoded, [acting.team]: guess } : game.decoded,
    intercepted:
      command.kind === 'intercept'
        ? { ...game.intercepted, [acting.team]: guess }
        : game.intercepted,
  };
  const ready = DECRYPTO_TEAMS.every(
    (team) =>
      updated.decoded[team] !== null && (updated.round === 1 || updated.intercepted[team] !== null),
  );
  return ready
    ? beginReveal(state, updated, context.nowMs)
    : commitDecrypto([{ type: 'decrypto.game.updated', game: updated }]);
}

function buildHistory(game: DecryptoGame): DecryptoHistory {
  const history: Record<DecryptoTeam, readonly DecryptoHistoryEntry[]> = {
    blue: game.history.blue,
    purple: game.history.purple,
  };
  for (const team of DECRYPTO_TEAMS) {
    const clues = game.clues[team];
    const decoded = game.decoded[team];
    if (clues === null || decoded === null)
      throw new Error('Decrypto reveal is missing a team answer');
    const entry: DecryptoHistoryEntry = {
      round: game.round,
      team,
      code: game.codes[team],
      clues,
      decode: decoded,
      intercept: game.round === 1 ? null : game.intercepted[otherDecryptoTeam(team)],
    };
    history[team] = [...history[team], entry];
  }
  return history;
}

function updateMarks(game: DecryptoGame): {
  readonly interceptions: DecryptoMarks;
  readonly miscommunications: DecryptoMarks;
} {
  const interceptions = { ...game.interceptions };
  const miscommunications = { ...game.miscommunications };
  for (const team of DECRYPTO_TEAMS) {
    if (!sameCode(game.decoded[team]!, game.codes[team])) miscommunications[team] += 1;
    if (game.round > 1 && sameCode(game.intercepted[team]!, game.codes[otherDecryptoTeam(team)]))
      interceptions[team] += 1;
  }
  return { interceptions, miscommunications };
}

function finishReveal(game: DecryptoGame): DecryptoGame {
  const history = buildHistory(game);
  const marks = updateMarks(game);
  const blueMargin = marks.interceptions.blue - marks.miscommunications.blue;
  const purpleMargin = marks.interceptions.purple - marks.miscommunications.purple;
  const reachedEnd =
    game.round === DECRYPTO_MAX_ROUNDS ||
    marks.interceptions.blue >= 2 ||
    marks.interceptions.purple >= 2 ||
    marks.miscommunications.blue >= 2 ||
    marks.miscommunications.purple >= 2;
  const resolvedOutcome =
    reachedEnd && blueMargin !== purpleMargin
      ? blueMargin > purpleMargin
        ? 'blue'
        : 'purple'
      : null;
  return {
    ...game,
    activeTeam: null,
    revealAt: null,
    history,
    interceptions: marks.interceptions,
    miscommunications: marks.miscommunications,
    revealIndex: game.revealSequence.length,
    step: !reachedEnd ? 'continue' : resolvedOutcome === null ? 'tiebreakSubmit' : 'continue',
    outcome: resolvedOutcome,
  };
}

function advanceReveal(
  state: DecryptoState,
  command: Extract<DecryptoCommand, { type: 'decrypto.reveal.advance' }>,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  if (context.actor.kind !== 'system') return reject(DECRYPTO_REASONS.revealEarly);
  if (state.phase.kind !== 'playing' || state.phase.game.step !== 'reveal')
    return reject(DECRYPTO_REASONS.phase);
  const game = state.phase.game;
  if (
    command.gameSequence !== state.gameSequence ||
    command.round !== game.round ||
    command.revealIndex !== game.revealIndex ||
    command.team !== game.activeTeam ||
    command.revealAt !== game.revealAt ||
    context.nowMs < command.revealAt
  )
    return reject(DECRYPTO_REASONS.revealEarly);
  const nextIndex = game.revealIndex + 1;
  if (nextIndex === game.revealSequence.length) {
    const finished = finishReveal(game);
    return finished.outcome === null
      ? commitDecrypto([{ type: 'decrypto.game.updated', game: finished }])
      : commitDecrypto([{ type: 'decrypto.game.ended', game: finished }]);
  }
  const perTeam = game.round === 1 ? 2 : 3;
  const team = nextIndex < perTeam ? 'blue' : 'purple';
  const revealAt = context.nowMs + DECRYPTO_REVEAL_INTERVAL_MS;
  const updated: DecryptoGame = {
    ...game,
    activeTeam: team,
    revealIndex: nextIndex,
    revealAt,
  };
  return commitDecrypto(
    [{ type: 'decrypto.game.updated', game: updated }],
    [scheduleReveal(state, updated, nextIndex, team, revealAt)],
  );
}

function continueRound(
  state: DecryptoState,
  command: Extract<DecryptoCommand, { type: 'decrypto.reveal.continue' }>,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  const hostRejection = requireHost<DecryptoEvent, DecryptoEffect>(
    context,
    state.hostUserId,
    DECRYPTO_REASONS.notHostContinue,
  );
  if (hostRejection !== null) return hostRejection;
  if (
    state.phase.kind !== 'playing' ||
    state.phase.game.step !== 'continue' ||
    command.gameSequence !== state.gameSequence
  )
    return reject(DECRYPTO_REASONS.stale);
  if (state.phase.game.outcome !== null) return reject(DECRYPTO_REASONS.phase);
  const previous = state.phase.game;
  const encryptors = nextDecryptoEncryptors(state, previous.encryptors!);
  const game = createDecryptoRound(
    previous.assignments,
    encryptors,
    previous.keywords!,
    previous.round + 1,
    context.randomSeed,
    previous.history,
    previous.interceptions,
    previous.miscommunications,
  );
  return commitDecrypto([{ type: 'decrypto.game.updated', game }]);
}

function submitTiebreak(
  state: DecryptoState,
  command: Extract<DecryptoCommand, { type: 'decrypto.tiebreak.submit' }>,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  if (state.phase.kind !== 'playing' || state.phase.game.step !== 'tiebreakSubmit')
    return reject(DECRYPTO_REASONS.phase);
  const acting = currentTeam(state, context);
  if (acting === null) return reject(DECRYPTO_REASONS.notTeamMember);
  if (state.phase.game.tiebreakGuesses[acting.team] !== null)
    return reject(DECRYPTO_REASONS.duplicateTiebreak);
  const guesses = command.guesses;
  if (
    guesses.length !== 4 ||
    guesses.some((word) => typeof word !== 'string' || word.trim().length === 0)
  )
    return reject(DECRYPTO_REASONS.wordsInvalid);
  const tiebreakGuesses = {
    ...state.phase.game.tiebreakGuesses,
    [acting.team]: [guesses[0].trim(), guesses[1].trim(), guesses[2].trim(), guesses[3].trim()],
  };
  const ready = DECRYPTO_TEAMS.every((team) => tiebreakGuesses[team] !== null);
  const game: DecryptoGame = {
    ...state.phase.game,
    tiebreakGuesses,
    step: ready ? 'tiebreakJudge' : 'tiebreakSubmit',
  };
  return commitDecrypto([{ type: 'decrypto.game.updated', game }]);
}

function judgeTiebreak(
  state: DecryptoState,
  command: Extract<DecryptoCommand, { type: 'decrypto.tiebreak.judge' }>,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  const hostRejection = requireHost<DecryptoEvent, DecryptoEffect>(
    context,
    state.hostUserId,
    DECRYPTO_REASONS.notHostJudge,
  );
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'playing' || state.phase.game.step !== 'tiebreakJudge')
    return reject(DECRYPTO_REASONS.phase);
  if (state.phase.game.tiebreakGuesses[command.team] === null)
    return reject(DECRYPTO_REASONS.wordsInvalid);
  if (state.phase.game.tiebreakJudgements[command.team] !== null)
    return reject(DECRYPTO_REASONS.duplicateTiebreak);
  const tiebreakJudgements = {
    ...state.phase.game.tiebreakJudgements,
    [command.team]: command.correct,
  };
  const ready = DECRYPTO_TEAMS.every((team) => tiebreakJudgements[team] !== null);
  if (!ready) {
    return commitDecrypto([
      {
        type: 'decrypto.game.updated',
        game: { ...state.phase.game, tiebreakJudgements },
      },
    ]);
  }
  const scores = {
    blue: tiebreakJudgements.blue!.filter(Boolean).length,
    purple: tiebreakJudgements.purple!.filter(Boolean).length,
  };
  const outcome =
    scores.blue === scores.purple ? 'shared' : scores.blue > scores.purple ? 'blue' : 'purple';
  return commitDecrypto([
    {
      type: 'decrypto.game.ended',
      game: { ...state.phase.game, tiebreakJudgements, outcome },
    },
  ]);
}

export function decideRoundCommand(
  state: DecryptoState,
  command: DecryptoCommand,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision | null {
  switch (command.type) {
    case 'decrypto.clues.submit':
      return submitClues(state, command, context);
    case 'decrypto.guess.submit':
      return submitGuess(state, command, context);
    case 'decrypto.reveal.advance':
      return advanceReveal(state, command, context);
    case 'decrypto.reveal.continue':
      return continueRound(state, command, context);
    case 'decrypto.tiebreak.submit':
      return submitTiebreak(state, command, context);
    case 'decrypto.tiebreak.judge':
      return judgeTiebreak(state, command, context);
    default:
      return null;
  }
}
