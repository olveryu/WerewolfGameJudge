/** Public command result envelope shared by Worker and room clients. */

import {
  type BaseGameState,
  createRoomSnapshot,
  type GameStateCodec,
  parseRoomSnapshot,
  type RoomSnapshot,
} from './roomSnapshot';

export type CommittedCommandOutcome =
  | { readonly kind: 'success'; readonly reason?: string }
  | { readonly kind: 'domainRejected'; readonly reason: string };

export type RoomCommandResult<TState extends BaseGameState<string>> =
  | {
      readonly kind: 'committed';
      readonly commandId: string;
      readonly snapshot: RoomSnapshot<TState>;
      readonly outcome: CommittedCommandOutcome;
    }
  | {
      readonly kind: 'rejected';
      readonly commandId: string;
      readonly reason: string;
    };

type RoomCommandResultSource<TState extends BaseGameState<string>> =
  | {
      readonly kind: 'committed';
      readonly commandId: string;
      readonly state: TState;
      readonly revision: number;
      readonly outcome: CommittedCommandOutcome;
    }
  | {
      readonly kind: 'rejected';
      readonly commandId: string;
      readonly reason: string;
    };

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

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  subject: string,
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new RoomCommandProtocolError(`${subject} contains unknown field: ${key}`);
    }
  }
}

function parseReason(value: unknown, subject = 'RoomCommandResult reason'): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RoomCommandProtocolError(`${subject} must be a non-empty string`);
  }
  return value;
}

function parseCommandId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) {
    throw new RoomCommandProtocolError(
      'RoomCommandResult commandId must contain between 1 and 200 characters',
    );
  }
  return value;
}

function parseCommittedCommandOutcome(value: unknown): CommittedCommandOutcome {
  if (!isRecord(value)) {
    throw new RoomCommandProtocolError('RoomCommandResult outcome must be an object');
  }

  switch (value.kind) {
    case 'success':
      assertAllowedKeys(value, ['kind', 'reason'], 'RoomCommandResult outcome');
      return 'reason' in value
        ? {
            kind: 'success',
            reason: parseReason(value.reason, 'RoomCommandResult outcome reason'),
          }
        : { kind: 'success' };
    case 'domainRejected':
      assertAllowedKeys(value, ['kind', 'reason'], 'RoomCommandResult outcome');
      return {
        kind: 'domainRejected',
        reason: parseReason(value.reason, 'RoomCommandResult outcome reason'),
      };
    default:
      throw new RoomCommandProtocolError(
        'RoomCommandResult outcome kind must be success or domainRejected',
      );
  }
}

export function createRoomCommandResult<TState extends BaseGameState<string>>(
  result: RoomCommandResultSource<TState>,
): RoomCommandResult<TState> {
  const commandId = parseCommandId(result.commandId);
  if (result.kind === 'rejected') {
    return { kind: 'rejected', commandId, reason: parseReason(result.reason) };
  }

  const snapshot = createRoomSnapshot(result.state, result.revision);
  return {
    kind: 'committed',
    commandId,
    snapshot,
    outcome: parseCommittedCommandOutcome(result.outcome),
  };
}

export function parseRoomCommandResult<TState extends BaseGameState<string>>(
  value: unknown,
  codec: GameStateCodec<TState>,
): RoomCommandResult<TState> {
  const raw = parseRecord(value);

  if (raw.kind === 'rejected') {
    assertAllowedKeys(raw, ['kind', 'commandId', 'reason'], 'RoomCommandResult');
    return {
      kind: 'rejected',
      commandId: parseCommandId(raw.commandId),
      reason: parseReason(raw.reason),
    };
  }

  if (raw.kind !== 'committed') {
    throw new RoomCommandProtocolError('RoomCommandResult kind must be committed or rejected');
  }
  assertAllowedKeys(raw, ['kind', 'commandId', 'snapshot', 'outcome'], 'RoomCommandResult');
  if (!('snapshot' in raw)) {
    throw new RoomCommandProtocolError('Committed RoomCommandResult must contain snapshot');
  }
  if (!('outcome' in raw)) {
    throw new RoomCommandProtocolError('Committed RoomCommandResult must contain outcome');
  }

  const commandId = parseCommandId(raw.commandId);
  const outcome = parseCommittedCommandOutcome(raw.outcome);

  try {
    const snapshot = parseRoomSnapshot(raw.snapshot, codec);
    return { kind: 'committed', commandId, snapshot, outcome };
  } catch (error) {
    if (error instanceof RoomCommandProtocolError) throw error;
    throw new RoomCommandProtocolError('RoomCommandResult contains invalid snapshot', error);
  }
}
