/** Runtime decoder for persisted and transported Pictionary state. */

import {
  PICTIONARY_GAME_TYPE,
  type PictionaryGameType,
} from '../../../platform/protocol/gameTypes';
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
import type { RosterEntry } from '../../../platform/room/roster';
import { normalizePictionaryState } from './normalize';
import {
  PICTIONARY_DRAWING_DURATIONS,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_WIDTH,
  PICTIONARY_GALLERY_ITEM_DURATIONS,
  PICTIONARY_GUESS_DURATIONS,
  PICTIONARY_TRANSITION_DURATIONS,
  type PictionaryChain,
  type PictionaryConfig,
  type PictionaryDrawingReservation,
  type PictionaryEntry,
  type PictionaryGalleryState,
  type PictionaryHumanSeat,
  type PictionaryMedia,
  type PictionaryPhase,
  type PictionaryState,
} from './types';
import { PICTIONARY_STATE_VERSION } from './version';

const PICTIONARY_PHASES = [
  'lobby',
  'answering',
  'settling',
  'transition',
  'gallery',
  'ended',
] as const;

function parseGameType(value: unknown, path: string): PictionaryGameType {
  if (value !== PICTIONARY_GAME_TYPE) return failDecode(path, PICTIONARY_GAME_TYPE);
  return value;
}

function parseStateVersion(value: unknown, path: string): typeof PICTIONARY_STATE_VERSION {
  const version = parseInteger(value, path);
  if (version !== PICTIONARY_STATE_VERSION) {
    return failDecode(path, `state version ${PICTIONARY_STATE_VERSION}`);
  }
  return version;
}

function parsePhase(value: unknown, path: string): PictionaryPhase {
  const phase = parseString(value, path);
  const match = PICTIONARY_PHASES.find((candidate) => candidate === phase);
  return match ?? failDecode(path, 'a valid Pictionary phase');
}

function parseDuration<T extends number | null>(
  value: unknown,
  path: string,
  options: readonly T[],
): T {
  const parsed = value === null ? null : parseInteger(value, path);
  const matchIndex = options.findIndex((option) => option === parsed);
  if (matchIndex < 0) return failDecode(path, 'a supported Pictionary duration');
  return options[matchIndex]!;
}

function parseConfig(value: unknown, path: string): PictionaryConfig {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      numberOfPlayers: parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`),
      drawingDurationSeconds: parseDuration(
        raw.drawingDurationSeconds,
        `${path}.drawingDurationSeconds`,
        PICTIONARY_DRAWING_DURATIONS,
      ),
      guessDurationSeconds: parseDuration(
        raw.guessDurationSeconds,
        `${path}.guessDurationSeconds`,
        PICTIONARY_GUESS_DURATIONS,
      ),
      transitionDurationSeconds: parseDuration(
        raw.transitionDurationSeconds,
        `${path}.transitionDurationSeconds`,
        PICTIONARY_TRANSITION_DURATIONS,
      ),
      galleryItemDurationSeconds: parseDuration(
        raw.galleryItemDurationSeconds,
        `${path}.galleryItemDurationSeconds`,
        PICTIONARY_GALLERY_ITEM_DURATIONS,
      ),
    },
    path,
  );
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

function parseHumanSeat(value: unknown, path: string): PictionaryHumanSeat {
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

function parseRealSeats(
  value: unknown,
  path: string,
): Readonly<Record<number, PictionaryHumanSeat>> {
  const raw = parseObject(value, path);
  const seats: Record<number, PictionaryHumanSeat> = {};
  for (const [key, occupant] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) {
      failDecode(`${path}.${key}`, 'a canonical non-negative integer key');
    }
    const seat = parseSeat(Number(key), `${path}.${key}`);
    seats[seat] = parseHumanSeat(occupant, `${path}.${key}`);
  }
  return seats;
}

function parseExactInteger<T extends number>(value: unknown, path: string, expected: T): T {
  if (parseInteger(value, path) !== expected) return failDecode(path, String(expected));
  return expected;
}

function parseMedia(value: unknown, path: string): PictionaryMedia {
  const raw = parseObject(value, path);
  if (raw.contentType !== 'image/png') return failDecode(`${path}.contentType`, 'image/png');
  return finishObject(
    raw,
    {
      objectKey: parseNonEmptyString(raw.objectKey, `${path}.objectKey`),
      contentType: 'image/png',
      width: parseExactInteger(raw.width, `${path}.width`, PICTIONARY_DRAWING_WIDTH),
      height: parseExactInteger(raw.height, `${path}.height`, PICTIONARY_DRAWING_HEIGHT),
      byteLength: parseInteger(raw.byteLength, `${path}.byteLength`),
      sha256: parseNonEmptyString(raw.sha256, `${path}.sha256`),
    },
    path,
  );
}

function parseEntry(value: unknown, path: string): PictionaryEntry {
  const raw = parseObject(value, path);
  const base = {
    id: parseNonEmptyString(raw.id, `${path}.id`),
    authorSeat: parseSeat(raw.authorSeat, `${path}.authorSeat`),
  };
  switch (raw.kind) {
    case 'text':
      return finishObject(
        raw,
        {
          kind: 'text',
          ...base,
          text: parseNonEmptyString(raw.text, `${path}.text`),
          submittedAt: parseInteger(raw.submittedAt, `${path}.submittedAt`),
        },
        path,
      );
    case 'drawing':
      return finishObject(
        raw,
        {
          kind: 'drawing',
          ...base,
          media: parseMedia(raw.media, `${path}.media`),
          submittedAt: parseInteger(raw.submittedAt, `${path}.submittedAt`),
        },
        path,
      );
    case 'missed':
      if (raw.expectedKind !== 'text' && raw.expectedKind !== 'drawing') {
        return failDecode(`${path}.expectedKind`, 'text or drawing');
      }
      return finishObject(raw, { kind: 'missed', ...base, expectedKind: raw.expectedKind }, path);
    default:
      return failDecode(`${path}.kind`, 'a valid Pictionary entry kind');
  }
}

function parseChain(value: unknown, path: string): PictionaryChain {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      id: parseNonEmptyString(raw.id, `${path}.id`),
      originSeat: parseSeat(raw.originSeat, `${path}.originSeat`),
      entries: parseArray(raw.entries, `${path}.entries`, parseEntry),
    },
    path,
  );
}

function parseReservation(value: unknown, path: string): PictionaryDrawingReservation {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      submissionId: parseNonEmptyString(raw.submissionId, `${path}.submissionId`),
      entryId: parseNonEmptyString(raw.entryId, `${path}.entryId`),
      chainId: parseNonEmptyString(raw.chainId, `${path}.chainId`),
      authorSeat: parseSeat(raw.authorSeat, `${path}.authorSeat`),
      reservedAt: parseInteger(raw.reservedAt, `${path}.reservedAt`),
      uploadDeadlineAt: parseInteger(raw.uploadDeadlineAt, `${path}.uploadDeadlineAt`),
    },
    path,
  );
}

function parseGallery(value: unknown, path: string): PictionaryGalleryState {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      chainIndex: parseInteger(raw.chainIndex, `${path}.chainIndex`),
      entryIndex: parseInteger(raw.entryIndex, `${path}.entryIndex`),
      isPlaying: parseBoolean(raw.isPlaying, `${path}.isPlaying`),
    },
    path,
  );
}

export function parsePictionaryState(value: unknown): PictionaryState {
  const raw = parseObject(value, 'PictionaryState');
  return normalizePictionaryState(
    finishObject(
      raw,
      {
        gameType: parseGameType(raw.gameType, 'PictionaryState.gameType'),
        stateVersion: parseStateVersion(raw.stateVersion, 'PictionaryState.stateVersion'),
        roomCode: parseNonEmptyString(raw.roomCode, 'PictionaryState.roomCode'),
        hostUserId: parseNonEmptyString(raw.hostUserId, 'PictionaryState.hostUserId'),
        phase: parsePhase(raw.phase, 'PictionaryState.phase'),
        phaseRevision: parseInteger(raw.phaseRevision, 'PictionaryState.phaseRevision'),
        config: parseConfig(raw.config, 'PictionaryState.config'),
        realSeats: parseRealSeats(raw.realSeats, 'PictionaryState.realSeats'),
        fillEmptySeatsWithBots: parseBoolean(
          raw.fillEmptySeatsWithBots,
          'PictionaryState.fillEmptySeatsWithBots',
        ),
        excludedBotSeats: parseArray(
          raw.excludedBotSeats,
          'PictionaryState.excludedBotSeats',
          parseSeat,
        ),
        roundNumber: parseInteger(raw.roundNumber, 'PictionaryState.roundNumber'),
        roundId: parseNullable(raw.roundId, 'PictionaryState.roundId', parseNonEmptyString),
        seatOrder: parseArray(raw.seatOrder, 'PictionaryState.seatOrder', parseSeat),
        stepIndex: parseInteger(raw.stepIndex, 'PictionaryState.stepIndex'),
        deadlineAt: parseNullable(raw.deadlineAt, 'PictionaryState.deadlineAt', parseInteger),
        readySeats: parseArray(raw.readySeats, 'PictionaryState.readySeats', parseSeat),
        reservations: parseArray(
          raw.reservations,
          'PictionaryState.reservations',
          parseReservation,
        ),
        chains: parseArray(raw.chains, 'PictionaryState.chains', parseChain),
        gallery: parseNullable(raw.gallery, 'PictionaryState.gallery', parseGallery),
      },
      'PictionaryState',
    ),
  );
}
