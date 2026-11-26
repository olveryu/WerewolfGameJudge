/** Deterministic setup, round construction, and Decrypto scoring rules. */

import { createSeededRng, randomIntInclusive, shuffleArray } from '../../../platform/random';
import type {
  DecryptoAssignments,
  DecryptoCode,
  DecryptoEncryptors,
  DecryptoGame,
  DecryptoHistory,
  DecryptoKeywordSets,
  DecryptoMarks,
  DecryptoState,
  DecryptoTeam,
} from '../state/types';

export function otherDecryptoTeam(team: DecryptoTeam): DecryptoTeam {
  return team === 'blue' ? 'purple' : 'blue';
}

export function randomDecryptoAssignments(
  seats: readonly number[],
  randomSeed: string,
): DecryptoAssignments {
  const shuffled = shuffleArray([...seats], createSeededRng(`${randomSeed}:teams`));
  const assignments: Record<number, DecryptoTeam> = {};
  shuffled.forEach((seat, index) => {
    assignments[seat] = index % 2 === 0 ? 'blue' : 'purple';
  });
  return assignments;
}

export function randomDecryptoEncryptors(
  assignments: DecryptoAssignments,
  randomSeed: string,
): DecryptoEncryptors {
  const rng = createSeededRng(`${randomSeed}:encryptors`);
  const choose = (team: DecryptoTeam): number => {
    const members = Object.entries(assignments)
      .filter(([, assignedTeam]) => assignedTeam === team)
      .map(([seat]) => Number(seat));
    if (members.length === 0) throw new Error(`Decrypto ${team} team cannot be empty`);
    return members[randomIntInclusive(0, members.length - 1, rng)]!;
  };
  return { blue: choose('blue'), purple: choose('purple') };
}

function getAssignments(state: DecryptoState): DecryptoAssignments {
  if (state.phase.kind === 'playing' || state.phase.kind === 'ended')
    return state.phase.game.assignments;
  if (state.phase.kind === 'teams' || state.phase.kind === 'preparing')
    return state.phase.assignments;
  throw new Error('Decrypto assignments are unavailable in the lobby');
}

export function nextDecryptoEncryptors(
  state: DecryptoState,
  previous: DecryptoEncryptors,
): DecryptoEncryptors {
  if (state.config.encryptorMode === 'fixed') return previous;
  const assignments = getAssignments(state);
  const next = (team: DecryptoTeam): number => {
    const members = Object.entries(assignments)
      .filter(([, assignedTeam]) => assignedTeam === team)
      .map(([seat]) => Number(seat))
      .sort((left, right) => left - right);
    if (members.length === 0) throw new Error(`Decrypto ${team} team cannot be empty`);
    const previousIndex = members.indexOf(previous[team]);
    return members[(previousIndex + 1 + members.length) % members.length]!;
  };
  return { blue: next('blue'), purple: next('purple') };
}

function createDecryptoCode(randomSeed: string, team: DecryptoTeam): DecryptoCode {
  const rng = createSeededRng(`${randomSeed}:code:${team}`);
  const shuffled = shuffleArray([1, 2, 3, 4] as const, rng);
  const [first, second, third] = shuffled;
  if (first === undefined || second === undefined || third === undefined)
    throw new Error('Decrypto code requires three distinct numbers');
  return [first, second, third];
}

function createEmptyHistory(): DecryptoHistory {
  return { blue: [], purple: [] };
}

function createEmptyMarks(): DecryptoMarks {
  return { blue: 0, purple: 0 };
}

export function createDecryptoRound(
  assignments: DecryptoAssignments,
  encryptors: DecryptoEncryptors,
  keywords: DecryptoKeywordSets,
  round: number,
  randomSeed: string,
  history = createEmptyHistory(),
  interceptions = createEmptyMarks(),
  miscommunications = createEmptyMarks(),
): DecryptoGame {
  return {
    keywords,
    encryptors,
    assignments,
    round,
    step: 'encrypt',
    activeTeam: null,
    codes: {
      blue: createDecryptoCode(randomSeed, 'blue'),
      purple: createDecryptoCode(randomSeed, 'purple'),
    },
    clues: { blue: null, purple: null },
    decoded: { blue: null, purple: null },
    intercepted: { blue: null, purple: null },
    revealSequence: [],
    revealIndex: 0,
    revealAt: null,
    history,
    interceptions,
    miscommunications,
    tiebreakGuesses: { blue: null, purple: null },
    tiebreakJudgements: { blue: null, purple: null },
    outcome: null,
  };
}
