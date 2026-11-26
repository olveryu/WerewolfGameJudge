/** Team assignment and initial word-allocation commands. */

import { reject, requireHost, resolveSystemActorEffectId } from '../../../platform/engine';
import { isRoomFull } from '../../../platform/room/seating';
import type { DecryptoCommand } from '../commands/types';
import type {
  DecryptoEncryptors,
  DecryptoHumanSeat,
  DecryptoState,
  DecryptoTeam,
} from '../state/types';
import {
  commitDecrypto,
  DECRYPTO_REASONS,
  type DecryptoDecision,
  type DecryptoEffect,
  type DecryptoEvent,
  type DecryptoWordSelection,
} from './decision';
import { createDecryptoRound, randomDecryptoAssignments, randomDecryptoEncryptors } from './rules';

function isHost(state: DecryptoState, context: Parameters<typeof requireHost>[0]): boolean {
  return (
    context.actor.kind === 'user' &&
    context.actor.userId === state.hostUserId &&
    context.controlledSeat === null
  );
}

function startTeamAssignment(
  state: DecryptoState,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  const hostRejection = requireHost<DecryptoEvent, DecryptoEffect>(
    context,
    state.hostUserId,
    DECRYPTO_REASONS.notHostStart,
  );
  if (hostRejection !== null || !isHost(state, context))
    return hostRejection ?? reject(DECRYPTO_REASONS.notHostStart);
  if (state.phase.kind !== 'lobby' && state.phase.kind !== 'ended')
    return reject(DECRYPTO_REASONS.phase);
  if (!isRoomFull(state.roster, state.config.numberOfPlayers)) return reject(DECRYPTO_REASONS.full);
  const seats = Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat);
  const assignments = randomDecryptoAssignments(seats, context.randomSeed);
  return commitDecrypto([
    {
      type: 'decrypto.teams.started',
      assignments,
      encryptors: { blue: null, purple: null },
      gameSequence: state.gameSequence + 1,
    },
  ]);
}

function updateTeam(
  state: DecryptoState,
  command: Extract<DecryptoCommand, { type: 'decrypto.teams.move' }>,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  if (state.phase.kind !== 'teams') return reject(DECRYPTO_REASONS.phase);
  if (!isHost(state, context)) return reject(DECRYPTO_REASONS.notHostTeams);
  if (
    !Number.isSafeInteger(command.seat) ||
    command.seat < 0 ||
    command.seat >= state.config.numberOfPlayers
  )
    return reject(DECRYPTO_REASONS.occupied);
  const assignments = { ...state.phase.assignments };
  const existing = assignments[command.seat];
  if (existing === undefined) return reject(DECRYPTO_REASONS.occupied);
  const existingTeamSize = Object.values(assignments).filter((team) => team === existing).length;
  if (existingTeamSize <= 2) return reject(DECRYPTO_REASONS.invalidTeam);
  const team: DecryptoTeam = existing === 'blue' ? 'purple' : 'blue';
  assignments[command.seat] = team;
  const encryptors = { ...state.phase.encryptors };
  if (encryptors[existing] === command.seat) encryptors[existing] = null;
  return commitDecrypto([{ type: 'decrypto.teams.updated', assignments, encryptors }]);
}

function updateEncryptor(
  state: DecryptoState,
  command: Extract<DecryptoCommand, { type: 'decrypto.teams.encryptor' }>,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  if (state.phase.kind !== 'teams') return reject(DECRYPTO_REASONS.phase);
  if (!isHost(state, context)) return reject(DECRYPTO_REASONS.notHostTeams);
  if (state.config.encryptorMode !== 'fixed') return reject(DECRYPTO_REASONS.invalidTeam);
  if (command.team !== 'blue' && command.team !== 'purple')
    return reject(DECRYPTO_REASONS.invalidTeam);
  if (state.phase.assignments[command.seat] !== command.team)
    return reject(DECRYPTO_REASONS.invalidTeam);
  const encryptors = { ...state.phase.encryptors, [command.team]: command.seat };
  return commitDecrypto([
    { type: 'decrypto.teams.updated', assignments: state.phase.assignments, encryptors },
  ]);
}

function randomizeTeams(
  state: DecryptoState,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  const hostRejection = requireHost<DecryptoEvent, DecryptoEffect>(
    context,
    state.hostUserId,
    DECRYPTO_REASONS.notHostTeams,
  );
  if (hostRejection !== null || !isHost(state, context))
    return hostRejection ?? reject(DECRYPTO_REASONS.notHostTeams);
  if (state.phase.kind !== 'teams') return reject(DECRYPTO_REASONS.phase);
  const seats = Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat);
  const assignments = randomDecryptoAssignments(seats, context.randomSeed);
  return commitDecrypto([
    { type: 'decrypto.teams.updated', assignments, encryptors: { blue: null, purple: null } },
  ]);
}

function confirmTeams(
  state: DecryptoState,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  const hostRejection = requireHost<DecryptoEvent, DecryptoEffect>(
    context,
    state.hostUserId,
    DECRYPTO_REASONS.notHostTeams,
  );
  if (hostRejection !== null || !isHost(state, context))
    return hostRejection ?? reject(DECRYPTO_REASONS.notHostTeams);
  if (state.phase.kind !== 'teams') return reject(DECRYPTO_REASONS.phase);
  if (
    !state.phase.assignments ||
    Object.values(state.phase.assignments).filter((team) => team === 'blue').length < 2 ||
    Object.values(state.phase.assignments).filter((team) => team === 'purple').length < 2 ||
    (state.config.encryptorMode === 'fixed' &&
      (state.phase.encryptors.blue === null || state.phase.encryptors.purple === null))
  )
    return reject(DECRYPTO_REASONS.invalidTeam);
  const requestId = `${context.commandId}:words`;
  const assignments = state.phase.assignments;
  let encryptors: DecryptoEncryptors;
  if (state.config.encryptorMode === 'rotating') {
    encryptors = randomDecryptoEncryptors(assignments, context.randomSeed);
  } else {
    const { blue, purple } = state.phase.encryptors;
    if (blue === null || purple === null) return reject(DECRYPTO_REASONS.invalidTeam);
    encryptors = { blue, purple };
  }
  const participantUserIds = Object.values(state.roster)
    .filter(
      (occupant): occupant is DecryptoHumanSeat =>
        occupant !== null && occupant !== undefined && 'userId' in occupant,
    )
    .map((occupant) => occupant.userId);
  return commitDecrypto(
    [{ type: 'decrypto.preparation.started', assignments, encryptors, requestId }],
    [
      {
        type: 'decrypto.words.select',
        payload: { requestId, gameSequence: state.gameSequence, participantUserIds },
      },
    ],
  );
}

function validWordSelection(words: DecryptoWordSelection): boolean {
  const allWords = [...words.blue, ...words.purple];
  return (
    allWords.every((word) => typeof word === 'string' && word.trim().length > 0) &&
    new Set(allWords.map((word) => word.trim().toLowerCase())).size === allWords.length
  );
}

function acceptWords(
  state: DecryptoState,
  command: Extract<DecryptoCommand, { type: 'decrypto.words.selected' }>,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision {
  if (context.actor.kind !== 'system') return reject(DECRYPTO_REASONS.notHostTeams);
  if (resolveSystemActorEffectId(context).kind !== 'resolved')
    return reject(DECRYPTO_REASONS.notHostTeams);
  if (state.phase.kind !== 'preparing' || state.phase.requestId !== command.requestId)
    return reject(DECRYPTO_REASONS.stale);
  if (!validWordSelection(command.keywords)) return reject(DECRYPTO_REASONS.wordsInvalid);
  const game = createDecryptoRound(
    state.phase.assignments,
    state.phase.encryptors,
    command.keywords,
    1,
    context.randomSeed,
  );
  return commitDecrypto([{ type: 'decrypto.play.started', game }]);
}

export function decideTeamCommand(
  state: DecryptoState,
  command: DecryptoCommand,
  context: Parameters<typeof requireHost>[0],
): DecryptoDecision | null {
  switch (command.type) {
    case 'decrypto.game.begin':
      return startTeamAssignment(state, context);
    case 'decrypto.teams.move':
      return updateTeam(state, command, context);
    case 'decrypto.teams.encryptor':
      return updateEncryptor(state, command, context);
    case 'decrypto.teams.randomize':
      return randomizeTeams(state, context);
    case 'decrypto.teams.confirm':
      return confirmTeams(state, context);
    case 'decrypto.words.selected':
      return acceptWords(state, command, context);
    default:
      return null;
  }
}
