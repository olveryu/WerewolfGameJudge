/** Immutable locator for one concrete room instance behind a reusable public code. */

import { parseRoomCode } from './roomCode';

export interface RoomLocator {
  readonly roomCode: string;
  readonly roomId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseRoomId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Room ID must be a non-empty string');
  }
  return value;
}

export function parseRoomLocator(value: unknown): RoomLocator {
  if (!isRecord(value)) {
    throw new Error('Room locator must be an object');
  }
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes('roomCode') || !keys.includes('roomId')) {
    throw new Error('Room locator has unsupported fields');
  }
  return {
    roomCode: parseRoomCode(value.roomCode),
    roomId: parseRoomId(value.roomId),
  };
}
