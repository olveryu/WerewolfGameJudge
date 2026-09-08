/** Canonical identity and storage keys for local Pictionary task drafts. */

import type {
  PictionaryState,
  PictionaryTask,
} from '@game-judge/game-engine/games/pictionary/public';

const MAX_IDENTIFIER_LENGTH = 256;

/** Identifies one user's local draft for one relay task. */
export interface PictionaryTaskDraftScope {
  readonly roomCode: string;
  readonly roundId: string;
  readonly taskId: string;
  readonly userId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

/** Parse an exact persisted task scope without accepting added fields. */
export function parsePictionaryTaskDraftScope(value: unknown): PictionaryTaskDraftScope {
  if (!isRecord(value)) throw new Error('Stored Pictionary draft scope must be an object');
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = ['roomCode', 'roundId', 'taskId', 'userId'];
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error('Stored Pictionary draft scope has unsupported fields');
  }
  return {
    roomCode: requireIdentifier(value.roomCode, 'Pictionary draft room code'),
    roundId: requireIdentifier(value.roundId, 'Pictionary draft round ID'),
    taskId: requireIdentifier(value.taskId, 'Pictionary draft task ID'),
    userId: requireIdentifier(value.userId, 'Pictionary draft user ID'),
  };
}

/** Build the local scope for a task in the current authoritative relay step. */
export function createPictionaryTaskDraftScope(
  state: PictionaryState,
  task: PictionaryTask,
  userId: string,
): PictionaryTaskDraftScope {
  if (state.roundId === null) {
    throw new Error('[FAIL-FAST] Pictionary task draft requires an active round');
  }
  return parsePictionaryTaskDraftScope({
    roomCode: state.roomCode,
    roundId: state.roundId,
    taskId: `${task.chain.id}:${state.stepIndex}`,
    userId,
  });
}

/** Build one collision-free MMKV key for a complete task scope. */
export function createPictionaryTaskDraftStorageKey(
  prefix: string,
  scope: PictionaryTaskDraftScope,
): string {
  const canonicalScope = parsePictionaryTaskDraftScope(scope);
  return `${prefix}${[
    canonicalScope.userId,
    canonicalScope.roomCode,
    canonicalScope.roundId,
    canonicalScope.taskId,
  ]
    .map((part) => encodeURIComponent(part))
    .join(':')}`;
}

/** Compare all identity fields after both scopes have passed strict parsing. */
export function hasSamePictionaryTaskDraftScope(
  first: PictionaryTaskDraftScope,
  second: PictionaryTaskDraftScope,
): boolean {
  return (
    first.roomCode === second.roomCode &&
    first.roundId === second.roundId &&
    first.taskId === second.taskId &&
    first.userId === second.userId
  );
}
