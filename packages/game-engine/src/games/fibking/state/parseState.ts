/** Runtime decoder for persisted and transported FibKing state. */

import { FIBKING_GAME_TYPE, type FibKingGameType } from '../../../platform/protocol/gameTypes';
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
import { normalizeFibState } from './normalize';
import type { FibHumanSeat, FibRoleAssignment, FibRound, FibState, PendingFibRound } from './types';
import { type FibWordSource, isFibWordSource } from './types';
import { FIB_STATE_VERSION } from './version';

function parseGameType(value: unknown, path: string): FibKingGameType {
  if (value !== FIBKING_GAME_TYPE) return failDecode(path, FIBKING_GAME_TYPE);
  return value;
}

function parseStateVersion(value: unknown, path: string): typeof FIB_STATE_VERSION {
  const version = parseInteger(value, path);
  if (version !== FIB_STATE_VERSION) {
    return failDecode(path, `state version ${FIB_STATE_VERSION}`);
  }
  return version;
}

function parseNull(value: unknown, path: string): null {
  if (value !== null) return failDecode(path, 'null');
  return null;
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

function parseHumanSeat(value: unknown, path: string): FibHumanSeat {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      userId: parseNonEmptyString(raw.userId, `${path}.userId`),
      seat: parseSeat(raw.seat, `${path}.seat`),
      profile: parseRosterEntry(raw.profile, `${path}.profile`),
    },
    path,
  );
}

function parseRealSeats(value: unknown, path: string): Readonly<Record<number, FibHumanSeat>> {
  const raw = parseObject(value, path);
  const seats: Record<number, FibHumanSeat> = {};
  for (const [key, occupant] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) {
      failDecode(`${path}.${key}`, 'a canonical non-negative integer key');
    }
    const seat = parseSeat(Number(key), `${path}.${key}`);
    seats[seat] = parseHumanSeat(occupant, `${path}.${key}`);
  }
  return seats;
}

function parsePendingRound(value: unknown, path: string): PendingFibRound {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      roundId: parseNonEmptyString(raw.roundId, `${path}.roundId`),
      requestedAt: parseInteger(raw.requestedAt, `${path}.requestedAt`),
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

function parseRound(value: unknown, path: string): FibRound {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      roundId: parseNonEmptyString(raw.roundId, `${path}.roundId`),
      word: parseNonEmptyString(raw.word, `${path}.word`),
      definition: parseNonEmptyString(raw.definition, `${path}.definition`),
      source: parseWordSource(raw.source, `${path}.source`),
      roles: parseRoles(raw.roles, `${path}.roles`),
    },
    path,
  );
}

export function parseFibState(value: unknown): FibState {
  const raw = parseObject(value, 'FibState');
  const base = {
    gameType: parseGameType(raw.gameType, 'FibState.gameType'),
    stateVersion: parseStateVersion(raw.stateVersion, 'FibState.stateVersion'),
    roomCode: parseNonEmptyString(raw.roomCode, 'FibState.roomCode'),
    hostUserId: parseNonEmptyString(raw.hostUserId, 'FibState.hostUserId'),
    numberOfPlayers: parseInteger(raw.numberOfPlayers, 'FibState.numberOfPlayers'),
    realSeats: parseRealSeats(raw.realSeats, 'FibState.realSeats'),
    fillEmptySeatsWithBots: parseBoolean(
      raw.fillEmptySeatsWithBots,
      'FibState.fillEmptySeatsWithBots',
    ),
    excludedBotSeats: parseArray(raw.excludedBotSeats, 'FibState.excludedBotSeats', parseSeat),
    usedWords: parseArray(raw.usedWords, 'FibState.usedWords', parseNonEmptyString),
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
            round: parseNull(raw.round, 'FibState.round'),
          },
          'FibState',
        ),
      );
    case 'ongoing':
    case 'ended':
      return normalizeFibState(
        finishObject(
          raw,
          {
            ...base,
            phase: raw.phase,
            pendingRound: parseNull(raw.pendingRound, 'FibState.pendingRound'),
            round: parseRound(raw.round, 'FibState.round'),
          },
          'FibState',
        ),
      );
    default:
      return failDecode('FibState.phase', 'a valid Fib phase');
  }
}
