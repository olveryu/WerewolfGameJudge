/** Strict Spotmatch persistence and transport codec. */

import { z } from 'zod';

import {
  failDecode,
  finishObject,
  parseBoolean,
  parseChoice,
  parseInteger,
  parseNonEmptyString,
  parseObject,
} from '../../../platform/protocol/runtimeDecoder';
import { parseRoomRoster } from '../../../platform/room/roster';
import { normalizeSpotmatchState } from './normalize';
import {
  isValidSpotmatchConfig,
  SPOTMATCH_GAME_TYPE,
  SPOTMATCH_PHASES,
  type SpotmatchConfig,
  type SpotmatchPhase,
  type SpotmatchState,
} from './types';

const cardSchema = z.strictObject({
  instanceId: z.string().min(1),
  typeId: z.int().min(0).max(56),
  layoutSeed: z.int().nonnegative(),
  symbols: z.array(z.int().min(0).max(199)).length(8),
});
const roundSchema = z
  .strictObject({
    roundId: z.string().min(1),
    central: cardSchema,
    symbolMap: z.array(z.int().min(0).max(199)).length(57),
    serial: z.int().positive(),
    isTest: z.boolean(),
    winnerSeat: z.int().nonnegative().nullable(),
    lastPlayedSeat: z.int().nonnegative().nullable(),
    success: z
      .strictObject({
        seat: z.int().nonnegative(),
        symbolId: z.int().min(0).max(199),
        previousCentral: cardSchema,
        until: z.int().positive(),
      })
      .nullable(),
    players: z
      .array(
        z.strictObject({
          seat: z.int().nonnegative(),
          userId: z.string().min(1).nullable(),
          isBot: z.boolean(),
          remaining: z.int().nonnegative(),
          correct: z.int().nonnegative(),
          mistakes: z.int().nonnegative(),
          lockedUntil: z.int().nonnegative(),
          lastMistake: z
            .strictObject({
              centralInstanceId: z.string().min(1),
              topInstanceId: z.string().min(1),
              symbolId: z.int().min(0).max(199),
            })
            .nullable(),
          top: cardSchema.nullable(),
        }),
      )
      .min(2)
      .max(20),
  })
  .nullable();

/** Parses only the supported lobby settings. */
export function parseSpotmatchConfig(value: unknown, path = 'SpotmatchConfig'): SpotmatchConfig {
  const raw = parseObject(value, path);
  const config: SpotmatchConfig = finishObject(
    raw,
    {
      numberOfPlayers: parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`),
      cardsPerPlayer: parseInteger(raw.cardsPerPlayer, `${path}.cardsPerPlayer`),
    },
    path,
  );
  if (!isValidSpotmatchConfig(config))
    failDecode(`${path}.numberOfPlayers`, 'a supported player count');
  return config;
}

function phase(value: unknown, path: string): SpotmatchPhase {
  const raw = parseObject(value, path);
  const kind = parseChoice(raw.kind, `${path}.kind`, SPOTMATCH_PHASES);
  switch (kind) {
    case 'lobby':
      return finishObject(raw, { kind: 'lobby' as const }, path);
    case 'playing':
      return finishObject(raw, { kind: 'playing' as const }, path);
    case 'ended':
      return finishObject(raw, { kind: 'ended' as const }, path);
  }
}

/** Restores the complete authoritative state and rejects unknown or malformed fields. */
export function parseSpotmatchState(value: unknown): SpotmatchState {
  const path = 'SpotmatchState';
  const raw = parseObject(value, path);
  return normalizeSpotmatchState(
    finishObject(
      raw,
      {
        gameType: parseChoice(raw.gameType, `${path}.gameType`, [SPOTMATCH_GAME_TYPE]),
        roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
        hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
        phase: phase(raw.phase, `${path}.phase`),
        phaseRevision: parseInteger(raw.phaseRevision, `${path}.phaseRevision`),
        config: parseSpotmatchConfig(raw.config, `${path}.config`),
        roster: parseRoomRoster(raw.roster, `${path}.roster`),
        gameSequence: parseInteger(raw.gameSequence, `${path}.gameSequence`),
        xpSettled: parseBoolean(raw.xpSettled, `${path}.xpSettled`),
        round: roundSchema.parse(raw.round),
      },
      path,
    ),
  );
}
