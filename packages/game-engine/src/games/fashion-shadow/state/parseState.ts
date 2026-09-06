// Runtime decoder for persisted authoritative Fashion Shadow state.

import {
  FASHION_SHADOW_GAME_TYPE,
  type FashionShadowGameType,
} from '../../../platform/protocol/gameTypes';
import {
  failDecode,
  finishObject,
  parseArray,
  parseInteger,
  parseNonEmptyString,
  parseObject,
  parseOptional,
  parseSeat,
  parseString,
} from '../../../platform/protocol/runtimeDecoder';
import type { RosterEntry } from '../../../platform/room/roster';
import { normalizeFashionState } from './normalize';
import {
  FASHION_PLAYER_COUNT,
  type FashionContract,
  type FashionContractPromise,
  type FashionContractStatus,
  type FashionCrossExamAward,
  type FashionHumanSeat,
  type FashionIdentityGuessHistory,
  type FashionIdentityGuessPenalty,
  type FashionInterrogation,
  type FashionInvestigationVoteRecord,
  type FashionPhase,
  type FashionRound,
  type FashionState,
  isFashionEventId,
  isFashionEvidenceId,
  isFashionInvestigationVote,
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

function parseFashionSeat(value: unknown, path: string): number {
  const seat = parseSeat(value, path);
  if (seat >= FASHION_PLAYER_COUNT) return failDecode(path, 'Fashion seat 0-6');
  return seat;
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

function parseRole(value: unknown, path: string) {
  if (!isFashionRoleId(value)) return failDecode(path, 'Fashion role id');
  return value;
}

function parseSecret(value: unknown, path: string) {
  if (!isFashionSecretId(value)) return failDecode(path, 'Fashion secret id');
  return value;
}

function parseEventOrNull(value: unknown, path: string) {
  if (value === null) return null;
  if (!isFashionEventId(value)) return failDecode(path, 'Fashion event id or null');
  return value;
}

function parseEvidence(value: unknown, path: string) {
  if (!isFashionEvidenceId(value)) return failDecode(path, 'Fashion evidence id');
  return value;
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

function parseIdentityGuessPenalty(value: unknown, path: string): FashionIdentityGuessPenalty {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      seat: parseFashionSeat(raw.seat, `${path}.seat`),
      blockedRound: parseRound(raw.blockedRound, `${path}.blockedRound`),
    },
    path,
  );
}

function parseIdentityGuessHistory(value: unknown, path: string): FashionIdentityGuessHistory {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      guesserSeat: parseFashionSeat(raw.guesserSeat, `${path}.guesserSeat`),
      targetSeat: parseFashionSeat(raw.targetSeat, `${path}.targetSeat`),
      round: parseRound(raw.round, `${path}.round`),
    },
    path,
  );
}

function parseVote(value: unknown, path: string) {
  if (!isFashionInvestigationVote(value)) return failDecode(path, 'Fashion investigation vote');
  return value;
}

function parseInvestigationVoteRecord(
  value: unknown,
  path: string,
): FashionInvestigationVoteRecord {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      round: parseRound(raw.round, `${path}.round`),
      seat: parseFashionSeat(raw.seat, `${path}.seat`),
      vote: parseVote(raw.vote, `${path}.vote`),
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
      match: raw.match === undefined ? 1 : parseCrossExamMatch(raw.match, `${path}.match`),
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

export function parseFashionState(value: unknown): FashionState {
  const raw = parseObject(value, 'FashionState');
  const numberOfPlayers = parseInteger(raw.numberOfPlayers, 'FashionState.numberOfPlayers');
  if (numberOfPlayers !== FASHION_PLAYER_COUNT) {
    return failDecode('FashionState.numberOfPlayers', '7');
  }
  return normalizeFashionState(
    finishObject(
      raw,
      {
        gameType: parseGameType(raw.gameType, 'FashionState.gameType'),
        stateVersion: parseStateVersion(raw.stateVersion, 'FashionState.stateVersion'),
        roomCode: parseNonEmptyString(raw.roomCode, 'FashionState.roomCode'),
        hostUserId: parseNonEmptyString(raw.hostUserId, 'FashionState.hostUserId'),
        phase: parsePhase(raw.phase, 'FashionState.phase'),
        currentRound: parseRound(raw.currentRound, 'FashionState.currentRound'),
        numberOfPlayers,
        realSeats: parseSeatRecord(raw.realSeats, 'FashionState.realSeats', parseHumanSeat),
        roles: parseSeatRecord(raw.roles, 'FashionState.roles', parseRole),
        secrets: parseSeatRecord(raw.secrets, 'FashionState.secrets', parseSecret),
        roleConfirmedSeats: parseArray(
          raw.roleConfirmedSeats,
          'FashionState.roleConfirmedSeats',
          parseFashionSeat,
        ),
        actionTokens: parseSeatRecord(raw.actionTokens, 'FashionState.actionTokens', parseInteger),
        currentEvent: parseEventOrNull(raw.currentEvent, 'FashionState.currentEvent'),
        publicEvidence: parseArray(
          raw.publicEvidence,
          'FashionState.publicEvidence',
          parseEvidence,
        ),
        destroyedEvidence: parseArray(
          raw.destroyedEvidence,
          'FashionState.destroyedEvidence',
          parseEvidence,
        ),
        votes: parseSeatRecord(raw.votes, 'FashionState.votes', parseVote),
        investigationVoteHistory:
          raw.investigationVoteHistory === undefined
            ? []
            : parseArray(
                raw.investigationVoteHistory,
                'FashionState.investigationVoteHistory',
                parseInvestigationVoteRecord,
              ),
        discussionSpeakCounts: parseSeatRecord(
          raw.discussionSpeakCounts,
          'FashionState.discussionSpeakCounts',
          parseInteger,
        ),
        interrogation: parseInterrogation(raw.interrogation, 'FashionState.interrogation'),
        crossExamParticipantSeats:
          raw.crossExamParticipantSeats === undefined
            ? []
            : parseArray(
                raw.crossExamParticipantSeats,
                'FashionState.crossExamParticipantSeats',
                parseFashionSeat,
              ),
        crossExamAwardVotes:
          raw.crossExamAwardVotes === undefined
            ? {}
            : parseSeatRecord(
                raw.crossExamAwardVotes,
                'FashionState.crossExamAwardVotes',
                parseFashionSeat,
              ),
        contracts: parseArray(raw.contracts, 'FashionState.contracts', parseContract),
        identityGuessPenalties: parseArray(
          raw.identityGuessPenalties,
          'FashionState.identityGuessPenalties',
          parseIdentityGuessPenalty,
        ),
        identityGuessHistory: parseArray(
          raw.identityGuessHistory,
          'FashionState.identityGuessHistory',
          parseIdentityGuessHistory,
        ),
        revealedSecrets: parseSeatRecord(
          raw.revealedSecrets,
          'FashionState.revealedSecrets',
          parseSecret,
        ),
        crossExamAwards:
          raw.crossExamAwards === undefined
            ? []
            : parseArray(raw.crossExamAwards, 'FashionState.crossExamAwards', parseCrossExamAward),
        finalVotes: parseSeatRecord(raw.finalVotes, 'FashionState.finalVotes', parseFashionSeat),
        winners: parseArray(raw.winners, 'FashionState.winners', parseFashionSeat),
      },
      'FashionState',
    ),
  );
}
