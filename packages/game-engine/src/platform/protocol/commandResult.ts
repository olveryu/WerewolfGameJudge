/** Public command result envelope shared by Worker and room clients. */

import type { GameType } from './gameTypes';
import {
  type BaseGameState,
  createRoomSnapshot,
  type GameStateCodec,
  parseRoomSnapshot,
  type RoomSnapshot,
} from './roomSnapshot';

export type RoomCommandResult<TState extends BaseGameState<GameType>> =
  | {
      readonly success: true;
      readonly snapshot: RoomSnapshot<TState>;
      readonly reason?: string;
    }
  | { readonly success: false; readonly reason: string };

type RoomCommandResultSource<TState extends BaseGameState<GameType>> =
  | {
      readonly success: true;
      readonly state: TState;
      readonly revision: number;
      readonly reason?: string;
    }
  | { readonly success: false; readonly reason: string };

export class RoomCommandProtocolError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'RoomCommandProtocolError';
    this.cause = cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new RoomCommandProtocolError('RoomCommandResult must be an object');
  }
  return value;
}

function assertAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new RoomCommandProtocolError(`RoomCommandResult contains unknown field: ${key}`);
    }
  }
}

function parseReason(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RoomCommandProtocolError('RoomCommandResult reason must be a non-empty string');
  }
  return value;
}

export function createRoomCommandResult<TState extends BaseGameState<GameType>>(
  result: RoomCommandResultSource<TState>,
): RoomCommandResult<TState> {
  if (!result.success) {
    return { success: false, reason: parseReason(result.reason) };
  }

  const snapshot = createRoomSnapshot(result.state, result.revision);
  return result.reason === undefined
    ? { success: true, snapshot }
    : { success: true, snapshot, reason: parseReason(result.reason) };
}

export function parseRoomCommandResult<TState extends BaseGameState<GameType>>(
  value: unknown,
  codec: GameStateCodec<TState>,
): RoomCommandResult<TState> {
  const raw = parseRecord(value);

  if (raw.success === false) {
    assertAllowedKeys(raw, ['success', 'reason']);
    return { success: false, reason: parseReason(raw.reason) };
  }

  if (raw.success !== true) {
    throw new RoomCommandProtocolError('RoomCommandResult success must be a boolean');
  }
  assertAllowedKeys(raw, ['success', 'snapshot', 'reason']);
  if (!('snapshot' in raw)) {
    throw new RoomCommandProtocolError('Successful RoomCommandResult must contain snapshot');
  }

  try {
    const snapshot = parseRoomSnapshot(raw.snapshot, codec);
    return raw.reason === undefined
      ? { success: true, snapshot }
      : { success: true, snapshot, reason: parseReason(raw.reason) };
  } catch (error) {
    if (error instanceof RoomCommandProtocolError) throw error;
    throw new RoomCommandProtocolError('RoomCommandResult contains invalid snapshot', error);
  }
}
