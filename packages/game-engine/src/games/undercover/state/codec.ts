/** Strict Undercover persistence/network decoder; unknown input never crosses this boundary. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import {
  failDecode,
  finishObject,
  parseArray,
  parseBoolean,
  parseInteger,
  parseNonEmptyString,
  parseNullable,
  parseObject,
  parseOptional,
  parseSeat,
  parseString,
} from '../../../platform/protocol/runtimeDecoder';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import type { UndercoverRole } from '../domain/rules';
import { normalizeUndercoverState } from './normalize';
import {
  UNDERCOVER_CATEGORIES,
  UNDERCOVER_STATE_VERSION,
  type UndercoverCategory,
  type UndercoverConfig,
  type UndercoverHumanSeat,
  type UndercoverPendingRound,
  type UndercoverRound,
  type UndercoverState,
  type UndercoverWordPair,
} from './types';

function parseRole(value: unknown, path: string): UndercoverRole {
  if (value !== 'civilian' && value !== 'undercover' && value !== 'blank')
    return failDecode(path, 'an Undercover role');
  return value;
}

function parseCategory(value: unknown, path: string): UndercoverCategory {
  for (const category of UNDERCOVER_CATEGORIES) if (category === value) return category;
  return failDecode(path, 'an Undercover category');
}

function parseConfig(value: unknown, path: string): UndercoverConfig {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      numberOfPlayers: parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`),
      hasBlank: parseBoolean(raw.hasBlank, `${path}.hasBlank`),
      isTestMode: parseBoolean(raw.isTestMode, `${path}.isTestMode`),
      category: raw.category === 'all' ? 'all' : parseCategory(raw.category, `${path}.category`),
    },
    path,
  );
}

function parseProfile(value: unknown, path: string): RoomSeatProfile {
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

function parseSeats(value: unknown, path: string): Readonly<Record<number, UndercoverHumanSeat>> {
  const raw = parseObject(value, path);
  const seats: Record<number, UndercoverHumanSeat> = {};
  for (const [key, value] of Object.entries(raw)) {
    const seat = parseSeat(Number(key), `${path}.${key}`);
    if (String(seat) !== key) return failDecode(`${path}.${key}`, 'a canonical seat index');
    const occupant = parseObject(value, `${path}.${key}`);
    seats[seat] = finishObject(
      occupant,
      {
        seat: parseSeat(occupant.seat, `${path}.${key}.seat`),
        userId: parseNonEmptyString(occupant.userId, `${path}.${key}.userId`),
        profile: parseProfile(occupant.profile, `${path}.${key}.profile`),
      },
      `${path}.${key}`,
    );
  }
  return seats;
}

function parseWordPair(value: unknown, path: string): UndercoverWordPair {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      id: parseNonEmptyString(raw.id, `${path}.id`),
      wordA: parseNonEmptyString(raw.wordA, `${path}.wordA`),
      wordB: parseNonEmptyString(raw.wordB, `${path}.wordB`),
      category: parseCategory(raw.category, `${path}.category`),
    },
    path,
  );
}

function parsePendingRound(value: unknown, path: string): UndercoverPendingRound {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      roundId: parseNonEmptyString(raw.roundId, `${path}.roundId`),
      requestedAt: parseInteger(raw.requestedAt, `${path}.requestedAt`),
      shouldAllowRepeated: parseBoolean(raw.shouldAllowRepeated, `${path}.shouldAllowRepeated`),
    },
    path,
  );
}

function parseRound(value: unknown, path: string): UndercoverRound {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      roundId: parseNonEmptyString(raw.roundId, `${path}.roundId`),
      wordPair: parseWordPair(raw.wordPair, `${path}.wordPair`),
      civilianWord: parseNonEmptyString(raw.civilianWord, `${path}.civilianWord`),
      undercoverWord: parseNonEmptyString(raw.undercoverWord, `${path}.undercoverWord`),
      roles: parseArray(raw.roles, `${path}.roles`, parseRole),
      confirmedSeats: parseArray(raw.confirmedSeats, `${path}.confirmedSeats`, parseSeat),
      revelations: parseArray(raw.revelations, `${path}.revelations`, (value, entryPath) => {
        const entry = parseObject(value, entryPath);
        return finishObject(
          entry,
          {
            seat: parseSeat(entry.seat, `${entryPath}.seat`),
            role: parseRole(entry.role, `${entryPath}.role`),
            revealedAt: parseInteger(entry.revealedAt, `${entryPath}.revealedAt`),
          },
          entryPath,
        );
      }),
    },
    path,
  );
}

/** Decodes only current Undercover state; migrations belong at the persistence boundary. */
function parseUndercoverState(value: unknown): UndercoverState {
  const path = 'UndercoverState';
  const raw = parseObject(value, path);
  if (raw.gameType !== 'undercover') return failDecode(`${path}.gameType`, 'undercover');
  if (raw.stateVersion !== UNDERCOVER_STATE_VERSION)
    return failDecode(`${path}.stateVersion`, `version ${UNDERCOVER_STATE_VERSION}`);
  const base = {
    gameType: raw.gameType,
    stateVersion: raw.stateVersion,
    roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
    hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
    config: parseConfig(raw.config, `${path}.config`),
    realSeats: parseSeats(raw.realSeats, `${path}.realSeats`),
    botSeats: parseArray(raw.botSeats, `${path}.botSeats`, parseSeat),
    usedWordPairIds: parseArray(
      raw.usedWordPairIds,
      `${path}.usedWordPairIds`,
      parseNonEmptyString,
    ),
  } as const;
  let state: UndercoverState;
  switch (raw.phase) {
    case 'lobby':
      if (raw.round !== null) return failDecode(`${path}.round`, 'null');
      state = { ...base, phase: 'lobby', round: null };
      break;
    case 'preparing':
    case 'preparationFailed': {
      if (raw.round !== null) return failDecode(`${path}.round`, 'null');
      const pendingRound = parsePendingRound(raw.pendingRound, `${path}.pendingRound`);
      if (raw.phase === 'preparing')
        state = { ...base, phase: 'preparing', round: null, pendingRound };
      else {
        if (
          raw.failureCode !== 'selectionFailed' &&
          raw.failureCode !== 'inventoryEmpty' &&
          raw.failureCode !== 'inventoryExhausted'
        )
          return failDecode(`${path}.failureCode`, 'a preparation failure code');
        state = {
          ...base,
          phase: 'preparationFailed',
          round: null,
          pendingRound,
          failureCode: raw.failureCode,
        };
      }
      break;
    }
    case 'reading':
    case 'ongoing':
      state = { ...base, phase: raw.phase, round: parseRound(raw.round, `${path}.round`) };
      break;
    case 'ended':
      state = {
        ...base,
        phase: 'ended',
        round: parseRound(raw.round, `${path}.round`),
        winner: parseRole(raw.winner, `${path}.winner`),
      };
      break;
    case 'aborted':
      state = {
        ...base,
        phase: 'aborted',
        round: parseNullable(raw.round, `${path}.round`, parseRound),
      };
      break;
    default:
      return failDecode(`${path}.phase`, 'an Undercover phase');
  }
  return normalizeUndercoverState(finishObject(raw, state, path));
}

export const UNDERCOVER_STATE_CODEC = {
  gameType: 'undercover',
  stateVersion: UNDERCOVER_STATE_VERSION,
  parse: parseUndercoverState,
} satisfies GameStateCodec<UndercoverState>;
