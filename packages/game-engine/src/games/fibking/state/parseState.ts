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
import type { BotSeatOccupant } from '../../../platform/room/seating';
import { normalizeFibState } from './normalize';
import type {
  FibHumanSeat,
  FibPreparationFailure,
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

function parseRoster(value: unknown, path: string): FibState['roster'] {
  const raw = parseObject(value, path);
  const seats: Record<number, FibHumanSeat | BotSeatOccupant> = {};
  for (const [key, occupant] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) {
      failDecode(`${path}.${key}`, 'a canonical non-negative integer key');
    }
    const seat = parseSeat(Number(key), `${path}.${key}`);
    const rawOccupant = parseObject(occupant, `${path}.${key}`);
    if (rawOccupant.kind === 'bot') {
      seats[seat] = finishObject(
        rawOccupant,
        { seat: parseSeat(rawOccupant.seat, `${path}.${key}.seat`), kind: 'bot' as const },
        `${path}.${key}`,
      );
    } else {
      seats[seat] = parseHumanSeat(occupant, `${path}.${key}`);
    }
  }
  return seats;
}

function parseLegacyRealSeats(
  value: unknown,
  path: string,
): Readonly<Record<number, FibHumanSeat>> {
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
    roster: parseRoster(raw.roster, 'FibState.roster'),
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

/**
 * Materializes the unified roster for a pre-v7 document: bot seats are
 * exactly the seats the retired implicit derivation would have named
 * (fill enabled, no human seated, not excluded).
 */
function withMaterializedRoster(raw: Record<string, unknown>): Record<string, unknown> {
  const playerCount = raw.numberOfPlayers;
  if (typeof playerCount !== 'number' || !Number.isSafeInteger(playerCount)) {
    return failDecode('FibState.numberOfPlayers', 'a safe integer');
  }
  const humans = parseLegacyRealSeats(raw.realSeats, 'FibState.realSeats');
  const fill = parseBoolean(raw.fillEmptySeatsWithBots, 'FibState.fillEmptySeatsWithBots');
  const excluded = parseArray(raw.excludedBotSeats, 'FibState.excludedBotSeats', parseSeat);
  const roster: Record<number, FibHumanSeat | BotSeatOccupant> = { ...humans };
  if (fill) {
    for (let seat = 0; seat < playerCount; seat += 1) {
      if (roster[seat] === undefined && !excluded.includes(seat)) {
        roster[seat] = { seat, kind: 'bot' };
      }
    }
  }
  const {
    realSeats: _legacyRealSeats,
    fillEmptySeatsWithBots: _legacyFill,
    excludedBotSeats: _legacyExcluded,
    ...rest
  } = raw;
  return { ...rest, roster };
}

/**
 * Upgrades stored v5/v6 rooms. v5 predates role viewing: a round already
 * in flight keeps playing uninterrupted — every seat counts as having
 * viewed (the viewing gate only applies to rounds dealt under v6). v6
 * stored the implicit-bot derivation inputs; v7 materializes them into
 * the unified roster.
 * @throws When the stored state is malformed or invalid after migration.
 */
export function migratePersistedFibState(value: unknown): FibState {
  const raw = parseObject(value, 'FibState');
  if (raw.stateVersion !== 5 && raw.stateVersion !== 6) return parseFibState(raw);
  let upgraded: Record<string, unknown> = { ...raw, stateVersion: FIB_STATE_VERSION };
  if (raw.stateVersion === 5 && raw.round !== null && raw.round !== undefined) {
    const round = parseObject(raw.round, 'FibState.round');
    if ('viewedSeats' in round) {
      return failDecode('FibState.round.viewedSeats', 'absent from version 5 states');
    }
    const playerCount = raw.numberOfPlayers;
    if (typeof playerCount !== 'number' || !Number.isSafeInteger(playerCount)) {
      return failDecode('FibState.numberOfPlayers', 'a safe integer');
    }
    const viewedSeats = Array.from({ length: playerCount }, (_, seat) => seat);
    upgraded = { ...upgraded, round: { ...round, viewedSeats } };
  }
  return parseFibState(withMaterializedRoster(upgraded));
}
