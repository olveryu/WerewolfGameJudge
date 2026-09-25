/** Strict Story Relay persistence and transport codec; version one has no legacy state variants. */

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
import { normalizeStoryRelayState } from './normalize';
import {
  STORY_RELAY_GALLERY_DURATIONS,
  STORY_RELAY_GAME_TYPE,
  STORY_RELAY_PHASES,
  STORY_RELAY_STATE_VERSION,
  STORY_RELAY_TRANSITION_DURATIONS,
  STORY_RELAY_WRITING_DURATIONS,
  type StoryRelayConfig,
  type StoryRelayEntry,
  type StoryRelayHumanSeat,
  type StoryRelayState,
} from './types';

function choice<T extends string | number | null>(
  value: unknown,
  path: string,
  values: readonly T[],
): T {
  const match = values.find((candidate) => candidate === value);
  return match === undefined ? failDecode(path, 'a supported value') : match;
}

/** Parses only the supported ordinary writing settings. */
export function parseStoryRelayConfig(value: unknown, path = 'StoryRelayConfig'): StoryRelayConfig {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      numberOfPlayers: parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`),
      writingDurationSeconds: choice(
        raw.writingDurationSeconds,
        `${path}.writingDurationSeconds`,
        STORY_RELAY_WRITING_DURATIONS,
      ),
      transitionDurationSeconds: choice(
        raw.transitionDurationSeconds,
        `${path}.transitionDurationSeconds`,
        STORY_RELAY_TRANSITION_DURATIONS,
      ),
      galleryItemDurationSeconds: choice(
        raw.galleryItemDurationSeconds,
        `${path}.galleryItemDurationSeconds`,
        STORY_RELAY_GALLERY_DURATIONS,
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

function realSeats(value: unknown, path: string): StoryRelayState['realSeats'] {
  const raw = parseObject(value, path);
  const result: Record<number, StoryRelayHumanSeat> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    const rawSeat = parseObject(value, `${path}.${key}`);
    result[parseSeat(Number(key), `${path}.${key}`)] = finishObject(
      rawSeat,
      {
        seat: parseSeat(rawSeat.seat, `${path}.${key}.seat`),
        userId: parseNonEmptyString(rawSeat.userId, `${path}.${key}.userId`),
        profile: profile(rawSeat.profile, `${path}.${key}.profile`),
      },
      `${path}.${key}`,
    );
  }
  return result;
}

function entry(value: unknown, path: string): StoryRelayEntry {
  const raw = parseObject(value, path);
  const base = {
    id: parseNonEmptyString(raw.id, `${path}.id`),
    authorSeat: parseSeat(raw.authorSeat, `${path}.authorSeat`),
    submittedAt: parseInteger(raw.submittedAt, `${path}.submittedAt`),
  };
  switch (raw.kind) {
    case 'text':
      return finishObject(
        raw,
        { ...base, kind: 'text', text: parseString(raw.text, `${path}.text`) },
        path,
      );
    case 'empty':
      return finishObject(raw, { ...base, kind: 'empty' }, path);
    default:
      return failDecode(`${path}.kind`, 'text or empty');
  }
}

function chain(value: unknown, path: string): StoryRelayState['chains'][number] {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      id: parseNonEmptyString(raw.id, `${path}.id`),
      originSeat: parseSeat(raw.originSeat, `${path}.originSeat`),
      entries: parseArray(raw.entries, `${path}.entries`, entry),
    },
    path,
  );
}

function participant(value: unknown, path: string): StoryRelayState['participants'][number] {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      seat: parseSeat(raw.seat, `${path}.seat`),
      displayName: parseNonEmptyString(raw.displayName, `${path}.displayName`),
      userId: parseNullable(raw.userId, `${path}.userId`, parseNonEmptyString),
    },
    path,
  );
}

function gallery(value: unknown, path: string): NonNullable<StoryRelayState['gallery']> {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      position: parseInteger(raw.position, `${path}.position`),
      revealedPosition: parseInteger(raw.revealedPosition, `${path}.revealedPosition`),
      isPlaying: parseBoolean(raw.isPlaying, `${path}.isPlaying`),
      remainingMs: parseNullable(raw.remainingMs, `${path}.remainingMs`, parseInteger),
    },
    path,
  );
}

/** Restores the complete authoritative state and rejects unknown or malformed fields.
 * @throws If the state identity, shape or domain invariants are invalid.
 */
export function parseStoryRelayState(value: unknown): StoryRelayState {
  const path = 'StoryRelayState';
  const raw = parseObject(value, path);
  return normalizeStoryRelayState(
    finishObject(
      raw,
      {
        gameType: choice(raw.gameType, `${path}.gameType`, [STORY_RELAY_GAME_TYPE]),
        stateVersion: choice(raw.stateVersion, `${path}.stateVersion`, [STORY_RELAY_STATE_VERSION]),
        roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
        hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
        phase: choice(raw.phase, `${path}.phase`, STORY_RELAY_PHASES),
        phaseRevision: parseInteger(raw.phaseRevision, `${path}.phaseRevision`),
        config: parseStoryRelayConfig(raw.config, `${path}.config`),
        realSeats: realSeats(raw.realSeats, `${path}.realSeats`),
        botSeats: parseArray(raw.botSeats, `${path}.botSeats`, parseSeat),
        roundNumber: parseInteger(raw.roundNumber, `${path}.roundNumber`),
        roundId: parseNullable(raw.roundId, `${path}.roundId`, parseNonEmptyString),
        startedAt: parseNullable(raw.startedAt, `${path}.startedAt`, parseInteger),
        participants: parseArray(raw.participants, `${path}.participants`, participant),
        seatOrder: parseArray(raw.seatOrder, `${path}.seatOrder`, parseSeat),
        stepOffsets: parseArray(raw.stepOffsets, `${path}.stepOffsets`, parseSeat),
        stepIndex: parseInteger(raw.stepIndex, `${path}.stepIndex`),
        deadlineAt: parseNullable(raw.deadlineAt, `${path}.deadlineAt`, parseInteger),
        readySeats: parseArray(raw.readySeats, `${path}.readySeats`, parseSeat),
        chains: parseArray(raw.chains, `${path}.chains`, chain),
        gallery: parseNullable(raw.gallery, `${path}.gallery`, gallery),
        completedAt: parseNullable(raw.completedAt, `${path}.completedAt`, parseInteger),
        abortedAt: parseNullable(raw.abortedAt, `${path}.abortedAt`, parseInteger),
      },
      path,
    ),
  );
}

export const STORY_RELAY_STATE_CODEC = {
  gameType: STORY_RELAY_GAME_TYPE,
  stateVersion: STORY_RELAY_STATE_VERSION,
  parse: parseStoryRelayState,
} satisfies GameStateCodec<StoryRelayState>;
