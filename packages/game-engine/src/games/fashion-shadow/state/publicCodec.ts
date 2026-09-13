// Runtime codec for the per-user Fashion Shadow state exposed to clients.

import {
  FASHION_SHADOW_GAME_TYPE,
  type FashionShadowGameType,
} from '../../../platform/protocol/gameTypes';
import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import {
  failDecode,
  finishObject,
  parseArray,
  parseBoolean,
  parseInteger,
  parseNonEmptyString,
  parseObject,
  parseOptional,
  parseSeat,
  parseString,
} from '../../../platform/protocol/runtimeDecoder';
import type { RosterEntry } from '../../../platform/room/roster';
import { FASHION_ROLE_BY_ID } from '../domain/content';
import type {
  FashionIdentityGuessResultView,
  FashionPrivateIdentityView,
  FashionPublicState,
} from '../domain/visibility';
import {
  FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH,
  FASHION_DISCUSSION_MESSAGE_MAX_LENGTH,
  FASHION_HEARING_STATEMENT_MAX_LENGTH,
  FASHION_PLAYER_COUNT,
  type FashionContract,
  type FashionContractPromise,
  type FashionContractStatus,
  type FashionCrossExamAward,
  type FashionCrossExamStatement,
  type FashionDiscussionMessage,
  type FashionHearingStatement,
  type FashionHumanSeat,
  type FashionInterrogation,
  type FashionPhase,
  type FashionRound,
  isFashionEventId,
  isFashionEvidenceId,
  isFashionRoleId,
  isFashionSecretId,
} from './types';
import { FASHION_STATE_VERSION } from './version';

function parseGameType(value: unknown, path: string): FashionShadowGameType {
  if (value !== FASHION_SHADOW_GAME_TYPE) return failDecode(path, FASHION_SHADOW_GAME_TYPE);
  return value;
}

function parseStateVersion(value: unknown, path: string): typeof FASHION_STATE_VERSION {
  const version = parseInteger(value, path);
  if (version !== FASHION_STATE_VERSION) {
    return failDecode(path, `state version ${FASHION_STATE_VERSION}`);
  }
  return version;
}

function parseFashionSeat(value: unknown, path: string): number {
  const seat = parseSeat(value, path);
  if (seat >= FASHION_PLAYER_COUNT) return failDecode(path, 'Fashion seat 0-6');
  return seat;
}

function parseRosterEntry(value: unknown, path: string): RosterEntry {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      displayName: parseNonEmptyString(raw.displayName, `${path}.displayName`),
      avatarUrl: parseOptional(raw.avatarUrl, `${path}.avatarUrl`, parseString),
      avatarFrame: parseOptional(raw.avatarFrame, `${path}.avatarFrame`, parseString),
      seatFlair: parseOptional(raw.seatFlair, `${path}.seatFlair`, parseString),
      seatAnimation: parseOptional(raw.seatAnimation, `${path}.seatAnimation`, parseString),
      nameStyle: parseOptional(raw.nameStyle, `${path}.nameStyle`, parseString),
      revealEffect: parseOptional(raw.revealEffect, `${path}.revealEffect`, parseString),
      level: parseOptional(raw.level, `${path}.level`, parseInteger),
    },
    path,
  );
}

function parseHumanSeat(value: unknown, path: string): FashionHumanSeat {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      userId: parseNonEmptyString(raw.userId, `${path}.userId`),
      seat: parseFashionSeat(raw.seat, `${path}.seat`),
      profile: parseRosterEntry(raw.profile, `${path}.profile`),
    },
    path,
  );
}

function parseSeatRecord<T>(
  value: unknown,
  path: string,
  parseValue: (entry: unknown, entryPath: string) => T,
): Readonly<Record<number, T>> {
  const raw = parseObject(value, path);
  const result: Record<number, T> = {};
  for (const [rawSeat, entry] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(rawSeat)) {
      failDecode(`${path}.${rawSeat}`, 'canonical non-negative integer key');
    }
    const seat = parseFashionSeat(Number(rawSeat), `${path}.${rawSeat}`);
    result[seat] = parseValue(entry, `${path}.${rawSeat}`);
  }
  return result;
}

function parsePhase(value: unknown, path: string): FashionPhase {
  switch (value) {
    case 'lobby':
    case 'roleReveal':
    case 'event':
    case 'crossExamination':
    case 'discussion':
    case 'vote':
    case 'roundTransition':
    case 'hearing':
    case 'ended':
      return value;
    default:
      return failDecode(path, 'valid Fashion phase');
  }
}

function parseRound(value: unknown, path: string): FashionRound {
  const round = parseInteger(value, path);
  if (round !== 1 && round !== 2 && round !== 3 && round !== 4) {
    return failDecode(path, 'Fashion round 1-4');
  }
  return round;
}

function parseCrossExamMatch(value: unknown, path: string): 1 | 2 {
  if (value === 1 || value === 2) return value;
  return failDecode(path, 'Fashion cross exam match 1-2');
}

function parseEventOrNull(value: unknown, path: string) {
  if (value === null) return null;
  if (!isFashionEventId(value)) return failDecode(path, 'Fashion event id or null');
  return value;
}

function parseNullableString(value: unknown, path: string): string | null {
  return value === null ? null : parseNonEmptyString(value, path);
}

function parseNullableFashionSeat(value: unknown, path: string): number | null {
  return value === null ? null : parseFashionSeat(value, path);
}

function parseNullableBoolean(value: unknown, path: string): boolean | null {
  return value === null ? null : parseBoolean(value, path);
}

function parseEvidence(value: unknown, path: string) {
  if (!isFashionEvidenceId(value)) return failDecode(path, 'Fashion evidence id');
  return value;
}

function parseEvidenceOrNull(value: unknown, path: string) {
  return value === null ? null : parseEvidence(value, path);
}

function parseCrossExamSide(value: unknown, path: string): 'attacker' | 'defender' {
  if (value === 'attacker' || value === 'defender') return value;
  return failDecode(path, 'Fashion cross exam side');
}

function parseContractPromise(value: unknown, path: string): FashionContractPromise {
  switch (value) {
    case 'compensation':
    case 'protection':
    case 'legalImmunity':
      return value;
    default:
      return failDecode(path, 'valid Fashion contract promise');
  }
}

function parseContractStatus(value: unknown, path: string): FashionContractStatus {
  switch (value) {
    case 'proposed':
    case 'accepted':
    case 'fulfilled':
      return value;
    default:
      return failDecode(path, 'valid Fashion contract status');
  }
}

function parseContract(value: unknown, path: string): FashionContract {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      id: parseNonEmptyString(raw.id, `${path}.id`),
      sellerSeat: parseFashionSeat(raw.sellerSeat, `${path}.sellerSeat`),
      buyerSeat: parseFashionSeat(raw.buyerSeat, `${path}.buyerSeat`),
      promise: parseContractPromise(raw.promise, `${path}.promise`),
      status: parseContractStatus(raw.status, `${path}.status`),
    },
    path,
  );
}

function parseDiscussionMessage(value: unknown, path: string): FashionDiscussionMessage {
  const raw = parseObject(value, path);
  const message = parseNonEmptyString(raw.message, `${path}.message`);
  if (message !== message.trim() || message.length > FASHION_DISCUSSION_MESSAGE_MAX_LENGTH) {
    return failDecode(`${path}.message`, 'trimmed Fashion discussion message within length limit');
  }
  return finishObject(
    raw,
    {
      round: parseRound(raw.round, `${path}.round`),
      seat: parseFashionSeat(raw.seat, `${path}.seat`),
      message,
      createdAt: parseInteger(raw.createdAt, `${path}.createdAt`),
    },
    path,
  );
}

function parseHearingStatement(value: unknown, path: string): FashionHearingStatement {
  const raw = parseObject(value, path);
  const message = parseNonEmptyString(raw.message, `${path}.message`);
  if (message !== message.trim() || message.length > FASHION_HEARING_STATEMENT_MAX_LENGTH) {
    return failDecode(`${path}.message`, 'trimmed Fashion hearing statement within length limit');
  }
  return finishObject(
    raw,
    {
      seat: parseFashionSeat(raw.seat, `${path}.seat`),
      message,
      evidenceId: parseEvidence(raw.evidenceId, `${path}.evidenceId`),
      createdAt: parseInteger(raw.createdAt, `${path}.createdAt`),
    },
    path,
  );
}

function parseCrossExamStatement(value: unknown, path: string): FashionCrossExamStatement {
  const raw = parseObject(value, path);
  const message = parseNonEmptyString(raw.message, `${path}.message`);
  if (message !== message.trim() || message.length > FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH) {
    return failDecode(
      `${path}.message`,
      'trimmed Fashion cross exam statement within length limit',
    );
  }
  return finishObject(
    raw,
    {
      round: parseRound(raw.round, `${path}.round`),
      match: parseCrossExamMatch(raw.match, `${path}.match`),
      seat: parseFashionSeat(raw.seat, `${path}.seat`),
      side: parseCrossExamSide(raw.side, `${path}.side`),
      message,
      evidenceId: parseEvidenceOrNull(raw.evidenceId, `${path}.evidenceId`),
      createdAt: parseInteger(raw.createdAt, `${path}.createdAt`),
    },
    path,
  );
}

function parseCrossExamAward(value: unknown, path: string): FashionCrossExamAward {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      round: parseRound(raw.round, `${path}.round`),
      seat: parseFashionSeat(raw.seat, `${path}.seat`),
    },
    path,
  );
}

function parseInterrogation(value: unknown, path: string): FashionInterrogation | null {
  if (value === null) return null;
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      match: parseCrossExamMatch(raw.match, `${path}.match`),
      attackerSeat: parseFashionSeat(raw.attackerSeat, `${path}.attackerSeat`),
      defenderSeat: parseFashionSeat(raw.defenderSeat, `${path}.defenderSeat`),
      participantSeats:
        raw.participantSeats === undefined
          ? Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => seat)
          : parseArray(raw.participantSeats, `${path}.participantSeats`, parseFashionSeat),
      startedAt: parseInteger(raw.startedAt, `${path}.startedAt`),
      endsAt: parseInteger(raw.endsAt, `${path}.endsAt`),
    },
    path,
  );
}

function parseIdentityGuessResult(
  value: unknown,
  path: string,
): FashionIdentityGuessResultView | null {
  if (value === null) return null;
  const raw = parseObject(value, path);
  if (!isFashionRoleId(raw.guessedRoleId)) {
    return failDecode(`${path}.guessedRoleId`, 'Fashion role id');
  }
  return finishObject(
    raw,
    {
      targetSeat: parseFashionSeat(raw.targetSeat, `${path}.targetSeat`),
      guessedRoleId: raw.guessedRoleId,
      success: parseBoolean(raw.success, `${path}.success`),
      blockedNextRound: parseBoolean(raw.blockedNextRound, `${path}.blockedNextRound`),
    },
    path,
  );
}

function parsePrivateIdentity(value: unknown, path: string): FashionPrivateIdentityView | null {
  if (value === null) return null;
  const raw = parseObject(value, path);
  if (!isFashionRoleId(raw.roleId)) return failDecode(`${path}.roleId`, 'Fashion role id');
  if (!isFashionSecretId(raw.secretId)) return failDecode(`${path}.secretId`, 'Fashion secret id');
  const role = FASHION_ROLE_BY_ID[raw.roleId];
  if (role.secretId !== raw.secretId) {
    return failDecode(path, 'matching Fashion role and secret');
  }
  return finishObject(
    raw,
    {
      seat: parseFashionSeat(raw.seat, `${path}.seat`),
      roleId: raw.roleId,
      roleName: parseNonEmptyString(raw.roleName, `${path}.roleName`),
      publicStance: parseNonEmptyString(raw.publicStance, `${path}.publicStance`),
      secretId: raw.secretId,
      secret: parseNonEmptyString(raw.secret, `${path}.secret`),
      victoryCondition: parseNonEmptyString(raw.victoryCondition, `${path}.victoryCondition`),
    },
    path,
  );
}

function assertUniqueAscendingSeats(seats: readonly number[], label: string): void {
  let previous = -1;
  for (const seat of seats) {
    if (seat <= previous) throw new Error(`${label} must be unique and ascending`);
    previous = seat;
  }
}

export function parseFashionPublicState(value: unknown): FashionPublicState {
  const raw = parseObject(value, 'FashionPublicState');
  const numberOfPlayers = parseInteger(raw.numberOfPlayers, 'FashionPublicState.numberOfPlayers');
  if (numberOfPlayers !== FASHION_PLAYER_COUNT) {
    return failDecode('FashionPublicState.numberOfPlayers', '7');
  }
  const roleConfirmedSeats = parseArray(
    raw.roleConfirmedSeats,
    'FashionPublicState.roleConfirmedSeats',
    parseFashionSeat,
  );
  const votedSeats = parseArray(raw.votedSeats, 'FashionPublicState.votedSeats', parseFashionSeat);
  const finalVotedSeats = parseArray(
    raw.finalVotedSeats,
    'FashionPublicState.finalVotedSeats',
    parseFashionSeat,
  );
  const crossExamParticipantSeats = parseArray(
    raw.crossExamParticipantSeats,
    'FashionPublicState.crossExamParticipantSeats',
    parseFashionSeat,
  );
  const crossExamAwardVotedSeats = parseArray(
    raw.crossExamAwardVotedSeats,
    'FashionPublicState.crossExamAwardVotedSeats',
    parseFashionSeat,
  );
  assertUniqueAscendingSeats(roleConfirmedSeats, 'FashionPublicState.roleConfirmedSeats');
  assertUniqueAscendingSeats(votedSeats, 'FashionPublicState.votedSeats');
  assertUniqueAscendingSeats(finalVotedSeats, 'FashionPublicState.finalVotedSeats');
  assertUniqueAscendingSeats(
    crossExamParticipantSeats,
    'FashionPublicState.crossExamParticipantSeats',
  );
  assertUniqueAscendingSeats(
    crossExamAwardVotedSeats,
    'FashionPublicState.crossExamAwardVotedSeats',
  );

  const result = finishObject(
    raw,
    {
      gameType: parseGameType(raw.gameType, 'FashionPublicState.gameType'),
      stateVersion: parseStateVersion(raw.stateVersion, 'FashionPublicState.stateVersion'),
      roomCode: parseNonEmptyString(raw.roomCode, 'FashionPublicState.roomCode'),
      hostUserId: parseNonEmptyString(raw.hostUserId, 'FashionPublicState.hostUserId'),
      phase: parsePhase(raw.phase, 'FashionPublicState.phase'),
      currentRound: parseRound(raw.currentRound, 'FashionPublicState.currentRound'),
      numberOfPlayers,
      realSeats: parseSeatRecord(raw.realSeats, 'FashionPublicState.realSeats', parseHumanSeat),
      roleConfirmedSeats,
      actionTokens: parseSeatRecord(
        raw.actionTokens,
        'FashionPublicState.actionTokens',
        parseInteger,
      ),
      currentEvent: parseEventOrNull(raw.currentEvent, 'FashionPublicState.currentEvent'),
      currentEventTitle: parseNullableString(
        raw.currentEventTitle,
        'FashionPublicState.currentEventTitle',
      ),
      voteQuestion: parseNullableString(raw.voteQuestion, 'FashionPublicState.voteQuestion'),
      publicEvidence: parseArray(
        raw.publicEvidence,
        'FashionPublicState.publicEvidence',
        parseEvidence,
      ),
      destroyedEvidence: parseArray(
        raw.destroyedEvidence,
        'FashionPublicState.destroyedEvidence',
        parseEvidence,
      ),
      revealedSecrets: parseSeatRecord(
        raw.revealedSecrets,
        'FashionPublicState.revealedSecrets',
        (entry, path) => {
          if (!isFashionSecretId(entry)) return failDecode(path, 'Fashion secret id');
          return entry;
        },
      ),
      revealedRoles: parseSeatRecord(
        raw.revealedRoles,
        'FashionPublicState.revealedRoles',
        (entry, path) => {
          if (!isFashionRoleId(entry)) return failDecode(path, 'Fashion role id');
          return entry;
        },
      ),
      crossExamAwards: parseArray(
        raw.crossExamAwards,
        'FashionPublicState.crossExamAwards',
        parseCrossExamAward,
      ),
      crossExamParticipantSeats,
      crossExamAwardVotedSeats,
      votedSeats,
      finalVotedSeats,
      finalVoteTally: parseSeatRecord(
        raw.finalVoteTally,
        'FashionPublicState.finalVoteTally',
        parseInteger,
      ),
      finalAccusedSeat: parseNullableFashionSeat(
        raw.finalAccusedSeat,
        'FashionPublicState.finalAccusedSeat',
      ),
      villainConvicted: parseNullableBoolean(
        raw.villainConvicted,
        'FashionPublicState.villainConvicted',
      ),
      discussionSpeakCounts: parseSeatRecord(
        raw.discussionSpeakCounts,
        'FashionPublicState.discussionSpeakCounts',
        parseInteger,
      ),
      discussionMessages: parseArray(
        raw.discussionMessages,
        'FashionPublicState.discussionMessages',
        parseDiscussionMessage,
      ),
      crossExamStatements: parseArray(
        raw.crossExamStatements,
        'FashionPublicState.crossExamStatements',
        parseCrossExamStatement,
      ),
      hearingStatements: parseArray(
        raw.hearingStatements,
        'FashionPublicState.hearingStatements',
        parseHearingStatement,
      ),
      interrogation: parseInterrogation(raw.interrogation, 'FashionPublicState.interrogation'),
      hasGuessedThisRound:
        typeof raw.hasGuessedThisRound === 'boolean'
          ? raw.hasGuessedThisRound
          : failDecode('FashionPublicState.hasGuessedThisRound', 'boolean'),
      myIdentityGuessResult: parseIdentityGuessResult(
        raw.myIdentityGuessResult,
        'FashionPublicState.myIdentityGuessResult',
      ),
      myContracts: parseArray(raw.myContracts, 'FashionPublicState.myContracts', parseContract),
      winners: parseArray(raw.winners, 'FashionPublicState.winners', parseFashionSeat),
      privateIdentity: parsePrivateIdentity(
        raw.privateIdentity,
        'FashionPublicState.privateIdentity',
      ),
    },
    'FashionPublicState',
  );

  if (result.privateIdentity !== null) {
    const occupant = result.realSeats[result.privateIdentity.seat];
    if (occupant === undefined) {
      throw new Error('FashionPublicState private identity must belong to an occupied seat');
    }
  }
  return result;
}

export const FASHION_PUBLIC_STATE_CODEC = {
  gameType: FASHION_SHADOW_GAME_TYPE,
  stateVersion: FASHION_STATE_VERSION,
  parse: parseFashionPublicState,
} satisfies GameStateCodec<FashionPublicState>;
