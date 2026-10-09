/** Strict DrawGuess persistence and transport codec; version one has no legacy state variants. */

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
import type { BotSeatOccupant } from '../../../platform/room/seating';
import { normalizeDrawGuessState } from './normalize';
import {
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_GAME_TYPE,
  DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS,
  DRAWGUESS_PHASES,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_STATE_VERSION,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessConfig,
  type DrawGuessDrawingReservation,
  type DrawGuessGuessLogEntry,
  type DrawGuessHumanSeat,
  type DrawGuessMedia,
  type DrawGuessPhase,
  type DrawGuessState,
  type DrawGuessStroke,
  type DrawGuessWordChoice,
} from './types';

function choice<T extends string | number>(value: unknown, path: string, values: readonly T[]): T {
  const match = values.find((candidate) => candidate === value);
  return match === undefined ? failDecode(path, 'a supported value') : match;
}

/** Parses only the supported lobby settings. */
export function parseDrawGuessConfig(value: unknown, path = 'DrawGuessConfig'): DrawGuessConfig {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      numberOfPlayers: parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`),
      drawingDurationSeconds: choice(raw.drawingDurationSeconds, `${path}.drawingDurationSeconds`, [
        DRAWGUESS_DRAWING_DURATION_SECONDS,
      ] as const),
      roundsPerDrawer: choice(raw.roundsPerDrawer, `${path}.roundsPerDrawer`, [
        DRAWGUESS_ROUNDS_PER_DRAWER,
      ] as const),
      wordSelectSeconds: choice(raw.wordSelectSeconds, `${path}.wordSelectSeconds`, [
        DRAWGUESS_WORD_SELECT_SECONDS,
      ] as const),
      roundEndSeconds: choice(raw.roundEndSeconds, `${path}.roundEndSeconds`, [
        DRAWGUESS_ROUND_END_SECONDS,
      ] as const),
      hintRevealIntervalSeconds: choice(
        raw.hintRevealIntervalSeconds,
        `${path}.hintRevealIntervalSeconds`,
        [DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS] as const,
      ),
    },
    path,
  );
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

function humanSeat(value: unknown, path: string): DrawGuessHumanSeat {
  const rawSeat = parseObject(value, path);
  return finishObject(
    rawSeat,
    {
      seat: parseSeat(rawSeat.seat, `${path}.seat`),
      userId: parseNonEmptyString(rawSeat.userId, `${path}.userId`),
      profile: profile(rawSeat.profile, `${path}.profile`),
    },
    path,
  );
}

function roster(value: unknown, path: string): DrawGuessState['roster'] {
  const raw = parseObject(value, path);
  const result: Record<number, DrawGuessHumanSeat | BotSeatOccupant> = {};
  for (const [key, occupant] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    const seat = parseSeat(Number(key), `${path}.${key}`);
    const rawOccupant = parseObject(occupant, `${path}.${key}`);
    result[seat] =
      rawOccupant.kind === 'bot'
        ? finishObject(
            rawOccupant,
            { seat: parseSeat(rawOccupant.seat, `${path}.${key}.seat`), kind: 'bot' as const },
            `${path}.${key}`,
          )
        : humanSeat(occupant, `${path}.${key}`);
  }
  return result;
}

function legacyRealSeats(value: unknown, path: string): Record<number, DrawGuessHumanSeat> {
  const raw = parseObject(value, path);
  const result: Record<number, DrawGuessHumanSeat> = {};
  for (const [key, occupant] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    result[parseSeat(Number(key), `${path}.${key}`)] = humanSeat(occupant, `${path}.${key}`);
  }
  return result;
}

function wordChoice(value: unknown, path: string): DrawGuessWordChoice {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      word: parseNonEmptyString(raw.word, `${path}.word`),
      pinyinInitials: parseNonEmptyString(raw.pinyinInitials, `${path}.pinyinInitials`),
    },
    path,
  );
}

function point(value: unknown, path: string): { readonly x: number; readonly y: number } {
  const raw = parseObject(value, path);
  const x = raw.x;
  const y = raw.y;
  if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x > 1 || y < 0 || y > 1)
    return failDecode(path, 'normalized 0–1 coordinates');
  return finishObject(raw, { x, y }, path);
}

function strokeColor(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value))
    return failDecode(path, 'a #rrggbb color');
  return value;
}

function stroke(value: unknown, path: string): DrawGuessStroke {
  const raw = parseObject(value, path);
  const base = {
    id: parseNonEmptyString(raw.id, `${path}.id`),
    color: strokeColor(raw.color, `${path}.color`),
    width: parseInteger(raw.width, `${path}.width`),
    authorSeat: parseSeat(raw.authorSeat, `${path}.authorSeat`),
  };
  switch (raw.kind) {
    case 'brush':
    case 'eraser':
      return finishObject(
        raw,
        {
          ...base,
          kind: raw.kind,
          points: parseArray(raw.points, `${path}.points`, (item, itemPath) =>
            point(item, itemPath),
          ),
        },
        path,
      );
    case 'line':
    case 'rectangle':
    case 'ellipse':
      return finishObject(
        raw,
        {
          ...base,
          kind: raw.kind,
          start: point(raw.start, `${path}.start`),
          end: point(raw.end, `${path}.end`),
        },
        path,
      );
    case 'fill': {
      const rectangles = parseArray(raw.rectangles, `${path}.rectangles`, (item, itemPath) => {
        const rect = parseObject(item, itemPath);
        return finishObject(
          rect,
          {
            x: parseInteger(rect.x, `${itemPath}.x`),
            y: parseInteger(rect.y, `${itemPath}.y`),
            width: parseInteger(rect.width, `${itemPath}.width`),
            height: parseInteger(rect.height, `${itemPath}.height`),
          },
          itemPath,
        );
      });
      return finishObject(raw, { ...base, kind: 'fill' as const, rectangles }, path);
    }
    default:
      return failDecode(`${path}.kind`, 'a stroke kind');
  }
}

function guessLogEntry(value: unknown, path: string): DrawGuessGuessLogEntry {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      seat: parseSeat(raw.seat, `${path}.seat`),
      text: parseString(raw.text, `${path}.text`),
      correct: parseBoolean(raw.correct, `${path}.correct`),
      at: parseInteger(raw.at, `${path}.at`),
    },
    path,
  );
}

function pngEntry(value: unknown, path: string): DrawGuessMedia {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      objectKey: parseNonEmptyString(raw.objectKey, `${path}.objectKey`),
      contentType: choice(raw.contentType, `${path}.contentType`, ['image/png'] as const),
      width: choice(raw.width, `${path}.width`, [1024] as const),
      height: choice(raw.height, `${path}.height`, [768] as const),
      byteLength: parseInteger(raw.byteLength, `${path}.byteLength`),
      sha256: parseNonEmptyString(raw.sha256, `${path}.sha256`),
    },
    path,
  );
}

function reservation(value: unknown, path: string): DrawGuessDrawingReservation {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      submissionId: parseNonEmptyString(raw.submissionId, `${path}.submissionId`),
      entryId: parseNonEmptyString(raw.entryId, `${path}.entryId`),
      authorSeat: parseSeat(raw.authorSeat, `${path}.authorSeat`),
      turnIndex: parseInteger(raw.turnIndex, `${path}.turnIndex`),
      reservedAt: parseInteger(raw.reservedAt, `${path}.reservedAt`),
    },
    path,
  );
}

function scores(value: unknown, path: string): Readonly<Record<number, number>> {
  const raw = parseObject(value, path);
  const result: Record<number, number> = {};
  for (const [key, amount] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    result[parseSeat(Number(key), `${path}.${key}`)] = parseInteger(amount, `${path}.${key}`);
  }
  return result;
}

function phase(value: unknown, path: string): DrawGuessPhase {
  const raw = parseObject(value, path);
  const kind = choice(raw.kind, `${path}.kind`, DRAWGUESS_PHASES);
  switch (kind) {
    case 'lobby':
      return finishObject(raw, { kind: 'lobby' as const }, path);
    case 'wordSelect':
      return finishObject(
        raw,
        {
          kind: 'wordSelect' as const,
          drawerSeat: parseSeat(raw.drawerSeat, `${path}.drawerSeat`),
          choices: parseArray(raw.choices, `${path}.choices`, wordChoice),
          deadlineAt: parseNullable(raw.deadlineAt, `${path}.deadlineAt`, parseInteger),
        },
        path,
      );
    case 'drawing':
      return finishObject(
        raw,
        {
          kind: 'drawing' as const,
          drawerSeat: parseSeat(raw.drawerSeat, `${path}.drawerSeat`),
          word: parseNonEmptyString(raw.word, `${path}.word`),
          pinyinInitials: parseNonEmptyString(raw.pinyinInitials, `${path}.pinyinInitials`),
          revealOrder: parseArray(raw.revealOrder, `${path}.revealOrder`, parseInteger),
          strokes: parseArray(raw.strokes, `${path}.strokes`, stroke),
          guessedSeats: parseArray(raw.guessedSeats, `${path}.guessedSeats`, parseSeat),
          guessLog: parseArray(raw.guessLog, `${path}.guessLog`, guessLogEntry),
          turnScores: scores(raw.turnScores, `${path}.turnScores`),
          phaseStartAt: parseInteger(raw.phaseStartAt, `${path}.phaseStartAt`),
          deadlineAt: parseInteger(raw.deadlineAt, `${path}.deadlineAt`),
        },
        path,
      );
    case 'roundEnd':
      return finishObject(
        raw,
        {
          kind: 'roundEnd' as const,
          drawerSeat: parseSeat(raw.drawerSeat, `${path}.drawerSeat`),
          word: parseNonEmptyString(raw.word, `${path}.word`),
          strokes: parseArray(raw.strokes, `${path}.strokes`, stroke),
          roundScores: scores(raw.roundScores, `${path}.roundScores`),
          pngEntry: parseNullable(raw.pngEntry, `${path}.pngEntry`, pngEntry),
          reservation: parseNullable(raw.reservation, `${path}.reservation`, reservation),
          deadlineAt: parseInteger(raw.deadlineAt, `${path}.deadlineAt`),
        },
        path,
      );
    case 'ended':
      return finishObject(
        raw,
        {
          kind: 'ended' as const,
          totalScores: scores(raw.totalScores, `${path}.totalScores`),
        },
        path,
      );
  }
}

/** Restores the complete authoritative state and rejects unknown or malformed fields.
 * @throws If the state identity, shape or domain invariants are invalid.
 */
export function parseDrawGuessState(value: unknown): DrawGuessState {
  const path = 'DrawGuessState';
  const raw = parseObject(value, path);
  return normalizeDrawGuessState(
    finishObject(
      raw,
      {
        gameType: choice(raw.gameType, `${path}.gameType`, [DRAWGUESS_GAME_TYPE]),
        stateVersion: choice(raw.stateVersion, `${path}.stateVersion`, [DRAWGUESS_STATE_VERSION]),
        roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
        hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
        phase: phase(raw.phase, `${path}.phase`),
        phaseRevision: parseInteger(raw.phaseRevision, `${path}.phaseRevision`),
        config: parseDrawGuessConfig(raw.config, `${path}.config`),
        roster: roster(raw.roster, `${path}.roster`),
        drawerQueue: parseArray(raw.drawerQueue, `${path}.drawerQueue`, parseSeat),
        turnIndex: parseInteger(raw.turnIndex, `${path}.turnIndex`),
        scores: scores(raw.scores, `${path}.scores`),
        usedWords: parseArray(raw.usedWords, `${path}.usedWords`, parseString),
        gameSequence: parseInteger(raw.gameSequence, `${path}.gameSequence`),
      },
      path,
    ),
  );
}

export const DRAWGUESS_STATE_CODEC = {
  gameType: DRAWGUESS_GAME_TYPE,
  stateVersion: DRAWGUESS_STATE_VERSION,
  parse: parseDrawGuessState,
} satisfies GameStateCodec<DrawGuessState>;

/**
 * Upgrades stored v1 rooms: v1 stored the roster as realSeats plus an
 * excluded-seat list, with the bot-fill flag inside the config; the v2
 * roster materializes exactly the seats the old derivation called bots
 * and the config flag retires.
 * @throws When the stored state is malformed or invalid after migration.
 */
export function migratePersistedDrawGuessState(value: unknown): DrawGuessState {
  const path = 'DrawGuessState';
  const raw = parseObject(value, path);
  if (raw.stateVersion !== 1) return parseDrawGuessState(raw);
  const rawConfig = parseObject(raw.config, `${path}.config`);
  const fill = parseBoolean(
    rawConfig.fillEmptySeatsWithBots,
    `${path}.config.fillEmptySeatsWithBots`,
  );
  const { fillEmptySeatsWithBots: _legacyFill, ...configRest } = rawConfig;
  const config = parseDrawGuessConfig(configRest, `${path}.config`);
  const humans = legacyRealSeats(raw.realSeats, `${path}.realSeats`);
  const excluded = parseArray(raw.excludedBotSeats, `${path}.excludedBotSeats`, parseSeat);
  const nextRoster: Record<number, DrawGuessHumanSeat | BotSeatOccupant> = { ...humans };
  if (fill) {
    for (let seat = 0; seat < config.numberOfPlayers; seat += 1) {
      if (nextRoster[seat] === undefined && !excluded.includes(seat)) {
        nextRoster[seat] = { seat, kind: 'bot' };
      }
    }
  }
  const { realSeats: _legacySeats, excludedBotSeats: _legacyExcluded, ...rest } = raw;
  return parseDrawGuessState({
    ...rest,
    stateVersion: DRAWGUESS_STATE_VERSION,
    config,
    roster: nextRoster,
  });
}
