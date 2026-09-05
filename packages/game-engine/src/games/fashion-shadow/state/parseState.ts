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
  type FashionHumanSeat,
  type FashionInterrogation,
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

function parseVote(value: unknown, path: string) {
  if (!isFashionInvestigationVote(value)) return failDecode(path, 'Fashion investigation vote');
  return value;
}

function parseInterrogation(value: unknown, path: string): FashionInterrogation | null {
  if (value === null) return null;
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      attackerSeat: parseFashionSeat(raw.attackerSeat, `${path}.attackerSeat`),
      defenderSeat: parseFashionSeat(raw.defenderSeat, `${path}.defenderSeat`),
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
        actionTokens: parseSeatRecord(
          raw.actionTokens,
          'FashionState.actionTokens',
          parseInteger,
        ),
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
        discussionSpeakCounts: parseSeatRecord(
          raw.discussionSpeakCounts,
          'FashionState.discussionSpeakCounts',
          parseInteger,
        ),
        interrogation: parseInterrogation(raw.interrogation, 'FashionState.interrogation'),
      },
      'FashionState',
    ),
  );
}
