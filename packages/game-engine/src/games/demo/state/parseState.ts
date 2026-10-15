/** Strict Demo persistence and transport codec; v1 is the current version. */

import {
  failDecode,
  finishObject,
  parseArray,
  parseBoolean,
  parseChoice,
  parseInteger,
  parseNonEmptyString,
  parseObject,
  parseOptional,
  parseSeat,
  parseString,
} from '../../../platform/protocol/runtimeDecoder';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import type { BotSeatOccupant } from '../../../platform/room/seating';
import { normalizeDemoState } from './normalize';
import {
  DEMO_GAME_TYPE,
  DEMO_PHASES,
  type DemoConfig,
  type DemoHumanSeat,
  type DemoPhase,
  type DemoState,
  isValidDemoConfig,
} from './types';
import { DEMO_STATE_VERSION } from './version';

/** Parses only the supported lobby settings. */
export function parseDemoConfig(value: unknown, path = 'DemoConfig'): DemoConfig {
  const raw = parseObject(value, path);
  const config: DemoConfig = finishObject(
    raw,
    { numberOfPlayers: parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`) },
    path,
  );
  if (!isValidDemoConfig(config)) failDecode(`${path}.numberOfPlayers`, 'a supported player count');
  return config;
}

function profile(value: unknown, path: string): RoomSeatProfile {
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

function rosterSeats(value: unknown, path: string): DemoState['roster'] {
  const raw = parseObject(value, path);
  const result: Record<number, DemoHumanSeat | BotSeatOccupant> = {};
  for (const [key, seatValue] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    const rawSeat = parseObject(seatValue, `${path}.${key}`);
    const seat = parseSeat(Number(key), `${path}.${key}`);
    if (rawSeat.kind === 'bot') {
      result[seat] = finishObject(
        rawSeat,
        { seat: parseSeat(rawSeat.seat, `${path}.${key}.seat`), kind: 'bot' as const },
        `${path}.${key}`,
      );
    } else {
      result[seat] = finishObject(
        rawSeat,
        {
          seat: parseSeat(rawSeat.seat, `${path}.${key}.seat`),
          userId: parseNonEmptyString(rawSeat.userId, `${path}.${key}.userId`),
          profile: profile(rawSeat.profile, `${path}.${key}.profile`),
        },
        `${path}.${key}`,
      );
    }
  }
  return result;
}

function identities(value: unknown, path: string): Readonly<Record<number, string>> {
  const raw = parseObject(value, path);
  const result: Record<number, string> = {};
  for (const [key, identity] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    result[parseSeat(Number(key), `${path}.${key}`)] = parseNonEmptyString(
      identity,
      `${path}.${key}`,
    );
  }
  return result;
}

function phase(value: unknown, path: string): DemoPhase {
  const raw = parseObject(value, path);
  const kind = parseChoice(raw.kind, `${path}.kind`, DEMO_PHASES);
  switch (kind) {
    case 'lobby':
      return finishObject(raw, { kind: 'lobby' as const }, path);
    case 'viewing':
      return finishObject(raw, { kind: 'viewing' as const }, path);
    case 'playing':
      return finishObject(
        raw,
        {
          kind: 'playing' as const,
          deadlineAt: parseInteger(raw.deadlineAt, `${path}.deadlineAt`),
        },
        path,
      );
    case 'ended':
      return finishObject(raw, { kind: 'ended' as const }, path);
  }
}

/** Restores the complete authoritative state and rejects unknown or malformed fields. */
export function parseDemoState(value: unknown): DemoState {
  const path = 'DemoState';
  const raw = parseObject(value, path);
  return normalizeDemoState(
    finishObject(
      raw,
      {
        gameType: parseChoice(raw.gameType, `${path}.gameType`, [DEMO_GAME_TYPE]),
        stateVersion: parseChoice(raw.stateVersion, `${path}.stateVersion`, [DEMO_STATE_VERSION]),
        roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
        hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
        phase: phase(raw.phase, `${path}.phase`),
        phaseRevision: parseInteger(raw.phaseRevision, `${path}.phaseRevision`),
        config: parseDemoConfig(raw.config, `${path}.config`),
        roster: rosterSeats(raw.roster, `${path}.roster`),
        identities: identities(raw.identities, `${path}.identities`),
        roleViewedSeats: parseArray(raw.roleViewedSeats, `${path}.roleViewedSeats`, parseSeat),
        gameSequence: parseInteger(raw.gameSequence, `${path}.gameSequence`),
        xpSettled: parseBoolean(raw.xpSettled, `${path}.xpSettled`),
      },
      path,
    ),
  );
}

/**
 * Upgrades stored states to the current version. v1 is current, so this
 * is the strict parser itself; when the state version bumps, older
 * payloads are upgraded here field by field before the strict parse.
 */
export function migratePersistedDemoState(value: unknown): DemoState {
  return parseDemoState(value);
}
