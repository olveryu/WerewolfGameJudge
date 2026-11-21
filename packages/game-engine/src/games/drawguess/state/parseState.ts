/** Strict DrawGuess persistence and transport codec. */

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
  parseString,
} from '../../../platform/protocol/runtimeDecoder';
import { parseRoomRoster } from '../../../platform/room/roster';
import { normalizeDrawGuessState } from './normalize';
import {
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_GAME_TYPE,
  DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS,
  DRAWGUESS_PHASES,
  DRAWGUESS_REACTIONS,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessConfig,
  type DrawGuessDrawingReservation,
  type DrawGuessGuessLogEntry,
  type DrawGuessMedia,
  type DrawGuessPhase,
  type DrawGuessReaction,
  type DrawGuessState,
  type DrawGuessStroke,
  type DrawGuessTurnRecord,
  type DrawGuessWordChoice,
} from './types';

/** Parses only the supported lobby settings. */
export function parseDrawGuessConfig(value: unknown, path = 'DrawGuessConfig'): DrawGuessConfig {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      numberOfPlayers: parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`),
      drawingDurationSeconds: parseChoice(
        raw.drawingDurationSeconds,
        `${path}.drawingDurationSeconds`,
        [DRAWGUESS_DRAWING_DURATION_SECONDS] as const,
      ),
      roundsPerDrawer: parseChoice(raw.roundsPerDrawer, `${path}.roundsPerDrawer`, [
        DRAWGUESS_ROUNDS_PER_DRAWER,
      ] as const),
      wordSelectSeconds: parseChoice(raw.wordSelectSeconds, `${path}.wordSelectSeconds`, [
        DRAWGUESS_WORD_SELECT_SECONDS,
      ] as const),
      roundEndSeconds: parseChoice(raw.roundEndSeconds, `${path}.roundEndSeconds`, [
        DRAWGUESS_ROUND_END_SECONDS,
      ] as const),
      hintRevealIntervalSeconds: parseChoice(
        raw.hintRevealIntervalSeconds,
        `${path}.hintRevealIntervalSeconds`,
        [DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS] as const,
      ),
    },
    path,
  );
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
      contentType: parseChoice(raw.contentType, `${path}.contentType`, ['image/png'] as const),
      width: parseChoice(raw.width, `${path}.width`, [1024] as const),
      height: parseChoice(raw.height, `${path}.height`, [768] as const),
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

function nonnegativeSeatCounts(value: unknown, path: string): Readonly<Record<number, number>> {
  const raw = parseObject(value, path);
  const result: Record<number, number> = {};
  for (const [key, count] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    const parsedCount = parseInteger(count, `${path}.${key}`);
    if (parsedCount < 0) failDecode(`${path}.${key}`, 'a non-negative integer');
    result[parseSeat(Number(key), `${path}.${key}`)] = parsedCount;
  }
  return result;
}

function reactionsBySeat(
  value: unknown,
  path: string,
): Readonly<Record<number, DrawGuessReaction>> {
  const raw = parseObject(value, path);
  const result: Record<number, DrawGuessReaction> = {};
  for (const [key, reaction] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    result[parseSeat(Number(key), `${path}.${key}`)] = parseChoice(
      reaction,
      `${path}.${key}`,
      DRAWGUESS_REACTIONS,
    );
  }
  return result;
}

function phase(value: unknown, path: string): DrawGuessPhase {
  const raw = parseObject(value, path);
  const kind = parseChoice(raw.kind, `${path}.kind`, DRAWGUESS_PHASES);
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
          reactionsBySeat: reactionsBySeat(raw.reactionsBySeat, `${path}.reactionsBySeat`),
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
          guessedSeats: parseArray(raw.guessedSeats, `${path}.guessedSeats`, parseSeat),
          roundScores: scores(raw.roundScores, `${path}.roundScores`),
          drawerZeroed: parseBoolean(raw.drawerZeroed, `${path}.drawerZeroed`),
          reactionsBySeat: reactionsBySeat(raw.reactionsBySeat, `${path}.reactionsBySeat`),
          guessAttemptsBySeat: nonnegativeSeatCounts(
            raw.guessAttemptsBySeat,
            `${path}.guessAttemptsBySeat`,
          ),
          guessTimeMsBySeat: nonnegativeSeatCounts(
            raw.guessTimeMsBySeat,
            `${path}.guessTimeMsBySeat`,
          ),
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

function turnRecord(value: unknown, path: string): DrawGuessTurnRecord {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      turnIndex: parseInteger(raw.turnIndex, `${path}.turnIndex`),
      drawerSeat: parseSeat(raw.drawerSeat, `${path}.drawerSeat`),
      word: parseNonEmptyString(raw.word, `${path}.word`),
      guessedSeats: parseArray(raw.guessedSeats, `${path}.guessedSeats`, parseSeat),
      roundScores: scores(raw.roundScores, `${path}.roundScores`),
      drawerZeroed: parseBoolean(raw.drawerZeroed, `${path}.drawerZeroed`),
      reactionsBySeat: reactionsBySeat(raw.reactionsBySeat, `${path}.reactionsBySeat`),
      guessAttemptsBySeat: nonnegativeSeatCounts(
        raw.guessAttemptsBySeat,
        `${path}.guessAttemptsBySeat`,
      ),
      guessTimeMsBySeat: nonnegativeSeatCounts(raw.guessTimeMsBySeat, `${path}.guessTimeMsBySeat`),
      entryId: parseNullable(raw.entryId, `${path}.entryId`, parseNonEmptyString),
      pngEntry: parseNullable(raw.pngEntry, `${path}.pngEntry`, pngEntry),
    },
    path,
  );
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
        gameType: parseChoice(raw.gameType, `${path}.gameType`, [DRAWGUESS_GAME_TYPE]),
        roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
        hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
        phase: phase(raw.phase, `${path}.phase`),
        phaseRevision: parseInteger(raw.phaseRevision, `${path}.phaseRevision`),
        config: parseDrawGuessConfig(raw.config, `${path}.config`),
        roster: parseRoomRoster(raw.roster, `${path}.roster`),
        drawerQueue: parseArray(raw.drawerQueue, `${path}.drawerQueue`, parseSeat),
        turnIndex: parseInteger(raw.turnIndex, `${path}.turnIndex`),
        scores: scores(raw.scores, `${path}.scores`),
        usedWords: parseArray(raw.usedWords, `${path}.usedWords`, parseString),
        gameSequence: parseInteger(raw.gameSequence, `${path}.gameSequence`),
        turnHistory: parseArray(raw.turnHistory, `${path}.turnHistory`, turnRecord),
      },
      path,
    ),
  );
}
