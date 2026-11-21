/** Runtime decoder for persisted and transported FibKing state. */

import { FIBKING_GAME_TYPE, type FibKingGameType } from '../../../platform/protocol/gameTypes';
import {
  failDecode,
  finishObject,
  parseArray,
  parseInteger,
  parseNonEmptyString,
  parseObject,
  parseSeat,
} from '../../../platform/protocol/runtimeDecoder';
import { parseRoomRoster } from '../../../platform/room/roster';
import { normalizeFibState } from './normalize';
import type {
  FibPreparationFailure,
  FibRole,
  FibRoleAssignment,
  FibRound,
  FibState,
  FibWordDefinition,
  PendingFibRound,
} from './types';
import {
  type FibWordSource,
  isFibPreparationFailureCode,
  isFibPreparationStage,
  isFibWordSource,
} from './types';

function parseGameType(value: unknown, path: string): FibKingGameType {
  if (value !== FIBKING_GAME_TYPE) return failDecode(path, FIBKING_GAME_TYPE);
  return value;
}

function parseNull(value: unknown, path: string): null {
  if (value !== null) return failDecode(path, 'null');
  return null;
}

function parsePendingRound(value: unknown, path: string): PendingFibRound {
  const raw = parseObject(value, path);
  if (!isFibPreparationStage(raw.stage)) {
    return failDecode(`${path}.stage`, 'a valid Fib preparation stage');
  }
  return finishObject(
    raw,
    {
      roundId: parseNonEmptyString(raw.roundId, `${path}.roundId`),
      requestedAt: parseInteger(raw.requestedAt, `${path}.requestedAt`),
      stage: raw.stage,
    },
    path,
  );
}

function parsePreparationFailure(value: unknown, path: string): FibPreparationFailure {
  const raw = parseObject(value, path);
  if (!isFibPreparationFailureCode(raw.failureCode)) {
    return failDecode(`${path}.failureCode`, 'a valid Fib preparation failure code');
  }
  return finishObject(
    raw,
    {
      roundId: parseNonEmptyString(raw.roundId, `${path}.roundId`),
      requestedAt: parseInteger(raw.requestedAt, `${path}.requestedAt`),
      failedAt: parseInteger(raw.failedAt, `${path}.failedAt`),
      failureCode: raw.failureCode,
    },
    path,
  );
}

function parseWordSource(value: unknown, path: string): FibWordSource {
  if (!isFibWordSource(value)) return failDecode(path, 'a registered Fib word source');
  return value;
}

function parseRoles(value: unknown, path: string): FibRoleAssignment {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      guesserSeat: parseSeat(raw.guesserSeat, `${path}.guesserSeat`),
      honestSeat: parseSeat(raw.honestSeat, `${path}.honestSeat`),
    },
    path,
  );
}

function parseDefinition(value: unknown, path: string): FibWordDefinition {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      coreMeaning: parseNonEmptyString(raw.coreMeaning, `${path}.coreMeaning`),
      usageNote: parseNonEmptyString(raw.usageNote, `${path}.usageNote`),
    },
    path,
  );
}

function parseFibRole(value: unknown, path: string): FibRole {
  if (value !== 'guesser' && value !== 'honest' && value !== 'fibber') {
    return failDecode(path, 'a valid Fib role');
  }
  return value;
}

function parseRound(value: unknown, path: string): FibRound {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      roundId: parseNonEmptyString(raw.roundId, `${path}.roundId`),
      word: parseNonEmptyString(raw.word, `${path}.word`),
      definition: parseDefinition(raw.definition, `${path}.definition`),
      source: parseWordSource(raw.source, `${path}.source`),
      roles: parseRoles(raw.roles, `${path}.roles`),
      viewedSeats: parseArray(raw.viewedSeats, `${path}.viewedSeats`, parseSeat),
      guesses: parseArray(raw.guesses, `${path}.guesses`, (entry, entryPath) => {
        const rawGuess = parseObject(entry, entryPath);
        return finishObject(
          rawGuess,
          {
            seat: parseSeat(rawGuess.seat, `${entryPath}.seat`),
            role: parseFibRole(rawGuess.role, `${entryPath}.role`),
            revealedAt: parseInteger(rawGuess.revealedAt, `${entryPath}.revealedAt`),
          },
          entryPath,
        );
      }),
    },
    path,
  );
}

export function parseFibState(value: unknown): FibState {
  const raw = parseObject(value, 'FibState');
  const base = {
    gameType: parseGameType(raw.gameType, 'FibState.gameType'),
    roomCode: parseNonEmptyString(raw.roomCode, 'FibState.roomCode'),
    hostUserId: parseNonEmptyString(raw.hostUserId, 'FibState.hostUserId'),
    numberOfPlayers: parseInteger(raw.numberOfPlayers, 'FibState.numberOfPlayers'),
    roster: parseRoomRoster(raw.roster, 'FibState.roster'),
    usedWords: parseArray(raw.usedWords, 'FibState.usedWords', parseNonEmptyString),
    reviewCompletedUserIds: parseArray(
      raw.reviewCompletedUserIds,
      'FibState.reviewCompletedUserIds',
      parseNonEmptyString,
    ),
  };

  switch (raw.phase) {
    case 'lobby':
      return normalizeFibState(
        finishObject(
          raw,
          {
            ...base,
            phase: 'lobby',
            pendingRound: parseNull(raw.pendingRound, 'FibState.pendingRound'),
            preparationFailure: parseNull(raw.preparationFailure, 'FibState.preparationFailure'),
            round: parseNull(raw.round, 'FibState.round'),
          },
          'FibState',
        ),
      );
    case 'preparing':
      return normalizeFibState(
        finishObject(
          raw,
          {
            ...base,
            phase: 'preparing',
            pendingRound: parsePendingRound(raw.pendingRound, 'FibState.pendingRound'),
            preparationFailure: parseNull(raw.preparationFailure, 'FibState.preparationFailure'),
            round: parseNull(raw.round, 'FibState.round'),
          },
          'FibState',
        ),
      );
    case 'preparationFailed':
      return normalizeFibState(
        finishObject(
          raw,
          {
            ...base,
            phase: 'preparationFailed',
            pendingRound: parseNull(raw.pendingRound, 'FibState.pendingRound'),
            preparationFailure: parsePreparationFailure(
              raw.preparationFailure,
              'FibState.preparationFailure',
            ),
            round: parseNull(raw.round, 'FibState.round'),
          },
          'FibState',
        ),
      );
    case 'viewing':
    case 'ongoing':
    case 'ended':
      return normalizeFibState(
        finishObject(
          raw,
          {
            ...base,
            phase: raw.phase,
            pendingRound: parseNull(raw.pendingRound, 'FibState.pendingRound'),
            preparationFailure: parseNull(raw.preparationFailure, 'FibState.preparationFailure'),
            round: parseRound(raw.round, 'FibState.round'),
          },
          'FibState',
        ),
      );
    default:
      return failDecode('FibState.phase', 'a valid Fib phase');
  }
}
