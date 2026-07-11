/** Canonical public room-code contract shared by HTTP, navigation, and tests. */

export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_PATTERN = /^[1-9][0-9]{3}$/;

export function isRoomCode(value: unknown): value is string {
  return typeof value === 'string' && ROOM_CODE_PATTERN.test(value);
}

export function parseRoomCode(value: unknown): string {
  if (!isRoomCode(value)) {
    throw new Error(`Invalid room code: ${String(value)}`);
  }
  return value;
}
