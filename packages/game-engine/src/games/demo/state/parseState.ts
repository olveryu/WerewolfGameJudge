/** Strict Demo persistence and transport codec; v1 is the current version. */

import {
  failDecode,
  finishObject,
  parseArray,
  parseBoolean,
  parseChoice,
  parseInteger,
  parseNonEmptyString,
  parseNullable,
  parseObject,
  parseSeat,
} from '../../../platform/protocol/runtimeDecoder';
import { parseRoomRoster } from '../../../platform/room/roster';
import { normalizeDemoState } from './normalize';
import {
  DEMO_GAME_TYPE,
  DEMO_PHASES,
  type DemoConfig,
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
    // TODO(gameplay): playing 阶段加字段时在这里逐字段严格解析。
    case 'playing':
      return finishObject(
        raw,
        {
          kind: 'playing' as const,
          deadlineAt:
            raw.deadlineAt === undefined
              ? null
              : parseNullable(raw.deadlineAt, `${path}.deadlineAt`, parseInteger),
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
        roster: parseRoomRoster(raw.roster, `${path}.roster`),
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
