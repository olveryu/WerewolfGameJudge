/** User-scoped persistence for immutable recent room identities. */

import { type GameType, parseGameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@werewolf/game-engine/platform/protocol/roomCode';
import { parseRoomId } from '@werewolf/game-engine/platform/protocol/roomLocator';

import { storage } from '@/services/infra/localStorage';

const STORAGE_KEY_PREFIX = '@room:recent:';
const STORAGE_VERSION = 1;
const MAX_RECENT_ROOMS = 5;

export interface RecentRoomIdentity {
  readonly roomCode: string;
  readonly roomId: string;
  readonly gameType: GameType;
}

interface StoredRecentRooms {
  readonly version: 1;
  readonly rooms: readonly RecentRoomIdentity[];
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireUserId(userId: string): string {
  if (userId.length === 0) throw new Error('Recent rooms user ID must not be empty');
  return userId;
}

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(requireUserId(userId))}`;
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

function parseRecentRoom(value: unknown, index: number): RecentRoomIdentity {
  if (!isJsonObject(value)) throw new Error(`Stored recent room ${index} must be an object`);
  assertExactKeys(value, ['roomCode', 'roomId', 'gameType'], `Stored recent room ${index}`);
  return {
    roomCode: parseRoomCode(value.roomCode),
    roomId: parseRoomId(value.roomId),
    gameType: parseGameType(value.gameType),
  };
}

function parseStoredRecentRooms(value: unknown): StoredRecentRooms {
  if (!isJsonObject(value)) throw new Error('Stored recent rooms must be an object');
  assertExactKeys(value, ['version', 'rooms'], 'Stored recent rooms');
  if (value.version !== STORAGE_VERSION || !Array.isArray(value.rooms)) {
    throw new Error('Stored recent rooms have an unsupported version or room list');
  }
  if (value.rooms.length > MAX_RECENT_ROOMS) {
    throw new Error('Stored recent rooms exceed the maximum history length');
  }
  const rooms = value.rooms.map(parseRecentRoom);
  if (new Set(rooms.map(({ roomId }) => roomId)).size !== rooms.length) {
    throw new Error('Stored recent rooms contain duplicate room IDs');
  }
  if (new Set(rooms.map(({ roomCode }) => roomCode)).size !== rooms.length) {
    throw new Error('Stored recent rooms contain duplicate room codes');
  }
  return { version: STORAGE_VERSION, rooms };
}

/** Read recent immutable room identities, newest first. */
export function getRecentRooms(userId: string): RecentRoomIdentity[] {
  const raw = storage.getString(getStorageKey(userId));
  if (raw === undefined) return [];
  const parsed: unknown = JSON.parse(raw);
  return [...parseStoredRecentRooms(parsed).rooms];
}

/** Add one room identity and replace any prior instance that used the same public code. */
export function addRecentRoom(userId: string, room: RecentRoomIdentity): void {
  const canonicalRoom = parseRecentRoom(room, 0);
  const rooms = getRecentRooms(userId).filter(
    (candidate) =>
      candidate.roomId !== canonicalRoom.roomId && candidate.roomCode !== canonicalRoom.roomCode,
  );
  rooms.unshift(canonicalRoom);
  const stored: StoredRecentRooms = {
    version: STORAGE_VERSION,
    rooms: rooms.slice(0, MAX_RECENT_ROOMS),
  };
  storage.set(getStorageKey(userId), JSON.stringify(stored));
}

/** Remove one exact room instance. */
export function removeRecentRoom(userId: string, roomId: string): void {
  const canonicalRoomId = parseRoomId(roomId);
  const stored: StoredRecentRooms = {
    version: STORAGE_VERSION,
    rooms: getRecentRooms(userId).filter((room) => room.roomId !== canonicalRoomId),
  };
  storage.set(getStorageKey(userId), JSON.stringify(stored));
}

/** Clear one user's recent room history. */
export function clearRecentRooms(userId: string): void {
  storage.remove(getStorageKey(userId));
}
