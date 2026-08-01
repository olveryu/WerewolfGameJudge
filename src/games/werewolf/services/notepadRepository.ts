/** Strict persistence for one user, room instance, and Werewolf round. */

import { isValidRoleId, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { parseRoomId } from '@game-judge/game-engine/platform/protocol/roomLocator';

import type { WerewolfNotepadState } from '@/games/werewolf/state/WerewolfNotepadState';
import { storage } from '@/services/infra/localStorage';

const STORAGE_KEY_PREFIX = '@werewolf:notepad:';
const STORAGE_VERSION = 1;
const SEAT_KEY_PATTERN = /^[1-9][0-9]*$/;
const FIRST_ROUND_ID = 'first-round';
const RESTARTED_ROUND_PREFIX = 'restart:';
const STATE_FIELDS = [
  'playerNotes',
  'handStates',
  'roleGuesses',
  'publicNoteLeft',
  'publicNoteRight',
] as const;

export type WerewolfNotepadRoundId =
  | typeof FIRST_ROUND_ID
  | `${typeof RESTARTED_ROUND_PREFIX}${string}`;

export interface WerewolfNotepadOwner {
  readonly userId: string;
  readonly roomId: string;
}

export type WerewolfNotepadReadResult =
  | { readonly kind: 'missing' | 'stale' }
  | { readonly kind: 'found'; readonly state: WerewolfNotepadState };

interface StoredNotepad {
  readonly version: 1;
  readonly roundId: WerewolfNotepadRoundId;
  readonly state: WerewolfNotepadState;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): JsonObject {
  if (!isJsonObject(value)) throw new Error(`${label} must be an object`);
  return value;
}

function assertExactKeys(value: JsonObject, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const canonicalExpected = [...expected].sort();
  if (
    actual.length !== canonicalExpected.length ||
    actual.some((key, index) => key !== canonicalExpected[index])
  ) {
    throw new Error(`${label} has unsupported fields`);
  }
}

function requireUserId(userId: string): string {
  if (userId.length === 0) throw new Error('Werewolf notepad user ID must not be empty');
  return userId;
}

function requireSeatCount(seatCount: number): number {
  if (!Number.isSafeInteger(seatCount) || seatCount <= 0) {
    throw new Error('Werewolf notepad seat count must be a positive safe integer');
  }
  return seatCount;
}

function parseSeat(key: string, label: string, seatCount: number): number {
  if (!SEAT_KEY_PATTERN.test(key)) {
    throw new Error(`${label} contains invalid seat key ${key}`);
  }
  const seat = Number(key);
  if (!Number.isSafeInteger(seat) || seat > seatCount) {
    throw new Error(`${label} contains out-of-range seat key ${key}`);
  }
  return seat;
}

function parseSeatRecord<T>(
  value: unknown,
  label: string,
  seatCount: number,
  parseValue: (candidate: unknown, entryLabel: string) => T,
): Record<number, T> {
  const object = requireObject(value, label);
  const parsed: Record<number, T> = {};
  for (const [key, candidate] of Object.entries(object)) {
    const seat = parseSeat(key, label, seatCount);
    parsed[seat] = parseValue(candidate, `${label}.${key}`);
  }
  return parsed;
}

function parseString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  return value;
}

function parseBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  return value;
}

function parseRoleGuess(value: unknown, label: string): RoleId | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !isValidRoleId(value)) {
    throw new Error(`${label} must be a canonical Werewolf role ID or null`);
  }
  return value;
}

function isRestartedRoundId(value: string): value is `${typeof RESTARTED_ROUND_PREFIX}${string}` {
  return value.startsWith(RESTARTED_ROUND_PREFIX) && value.length > RESTARTED_ROUND_PREFIX.length;
}

function requireRoundId(value: unknown): WerewolfNotepadRoundId {
  if (value === FIRST_ROUND_ID) return value;
  if (typeof value !== 'string' || !isRestartedRoundId(value)) {
    throw new Error('Werewolf notepad round ID is invalid');
  }
  return value;
}

function parseNotepadState(value: unknown, seatCount: number): WerewolfNotepadState {
  const object = requireObject(value, 'Stored Werewolf notepad state');
  assertExactKeys(object, STATE_FIELDS, 'Stored Werewolf notepad state');
  return {
    playerNotes: parseSeatRecord(object.playerNotes, 'playerNotes', seatCount, parseString),
    handStates: parseSeatRecord(object.handStates, 'handStates', seatCount, parseBoolean),
    roleGuesses: parseSeatRecord(object.roleGuesses, 'roleGuesses', seatCount, parseRoleGuess),
    publicNoteLeft: parseString(object.publicNoteLeft, 'publicNoteLeft'),
    publicNoteRight: parseString(object.publicNoteRight, 'publicNoteRight'),
  };
}

function parseStoredNotepad(value: unknown, seatCount: number): StoredNotepad {
  const object = requireObject(value, 'Stored Werewolf notepad');
  assertExactKeys(object, ['version', 'roundId', 'state'], 'Stored Werewolf notepad');
  if (object.version !== STORAGE_VERSION) {
    throw new Error('Stored Werewolf notepad has an unsupported version');
  }
  return {
    version: STORAGE_VERSION,
    roundId: requireRoundId(object.roundId),
    state: parseNotepadState(object.state, seatCount),
  };
}

export function getWerewolfNotepadRoundId(
  restartNonce: string | undefined,
): WerewolfNotepadRoundId {
  if (restartNonce === undefined) return FIRST_ROUND_ID;
  if (restartNonce.length === 0) throw new Error('Werewolf restart nonce must not be empty');
  return `${RESTARTED_ROUND_PREFIX}${restartNonce}`;
}

export function getWerewolfNotepadStorageKey(owner: WerewolfNotepadOwner): string {
  const userId = encodeURIComponent(requireUserId(owner.userId));
  const roomId = encodeURIComponent(parseRoomId(owner.roomId));
  return `${STORAGE_KEY_PREFIX}${userId}:${roomId}`;
}

export function readWerewolfNotepad(
  owner: WerewolfNotepadOwner,
  roundId: WerewolfNotepadRoundId,
  seatCount: number,
): WerewolfNotepadReadResult {
  const storageKey = getWerewolfNotepadStorageKey(owner);
  const canonicalRoundId = requireRoundId(roundId);
  const canonicalSeatCount = requireSeatCount(seatCount);
  const raw = storage.getString(storageKey);
  if (raw === undefined) return { kind: 'missing' };
  const parsed: unknown = JSON.parse(raw);
  const stored = parseStoredNotepad(parsed, canonicalSeatCount);
  return stored.roundId === canonicalRoundId
    ? { kind: 'found', state: stored.state }
    : { kind: 'stale' };
}

export function writeWerewolfNotepad(
  owner: WerewolfNotepadOwner,
  roundId: WerewolfNotepadRoundId,
  seatCount: number,
  state: WerewolfNotepadState,
): void {
  const storageKey = getWerewolfNotepadStorageKey(owner);
  const stored: StoredNotepad = {
    version: STORAGE_VERSION,
    roundId: requireRoundId(roundId),
    state: parseNotepadState(state, requireSeatCount(seatCount)),
  };
  storage.set(storageKey, JSON.stringify(stored));
}

export function clearWerewolfNotepad(owner: WerewolfNotepadOwner): void {
  storage.remove(getWerewolfNotepadStorageKey(owner));
}
