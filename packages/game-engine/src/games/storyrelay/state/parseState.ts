/** Strict Story Relay persistence and transport codec. */

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
import { normalizeStoryRelayState } from './normalize';
import {
  STORY_RELAY_GALLERY_DURATIONS,
  STORY_RELAY_GAME_TYPE,
  STORY_RELAY_PHASES,
  STORY_RELAY_TRANSITION_DURATIONS,
  STORY_RELAY_WRITING_DURATIONS,
  type StoryRelayConfig,
  type StoryRelayEntry,
  type StoryRelayState,
} from './types';

/** Parses only the supported ordinary writing settings. */
export function parseStoryRelayConfig(value: unknown, path = 'StoryRelayConfig'): StoryRelayConfig {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      numberOfPlayers: parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`),
      writingDurationSeconds: parseChoice(
        raw.writingDurationSeconds,
        `${path}.writingDurationSeconds`,
        STORY_RELAY_WRITING_DURATIONS,
      ),
      transitionDurationSeconds: parseChoice(
        raw.transitionDurationSeconds,
        `${path}.transitionDurationSeconds`,
        STORY_RELAY_TRANSITION_DURATIONS,
      ),
      galleryItemDurationSeconds: parseChoice(
        raw.galleryItemDurationSeconds,
        `${path}.galleryItemDurationSeconds`,
        STORY_RELAY_GALLERY_DURATIONS,
      ),
    },
    path,
  );
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
      revealStartedAt: parseNullable(raw.revealStartedAt, `${path}.revealStartedAt`, parseInteger),
      revealDurationMs: parseInteger(raw.revealDurationMs, `${path}.revealDurationMs`),
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
        gameType: parseChoice(raw.gameType, `${path}.gameType`, [STORY_RELAY_GAME_TYPE]),
        roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
        hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
        phase: parseChoice(raw.phase, `${path}.phase`, STORY_RELAY_PHASES),
        phaseRevision: parseInteger(raw.phaseRevision, `${path}.phaseRevision`),
        config: parseStoryRelayConfig(raw.config, `${path}.config`),
        roster: parseRoomRoster(raw.roster, `${path}.roster`),
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
        revealSettlementPending: parseBoolean(
          raw.revealSettlementPending,
          `${path}.revealSettlementPending`,
        ),
        completedAt: parseNullable(raw.completedAt, `${path}.completedAt`, parseInteger),
      },
      path,
    ),
  );
}
