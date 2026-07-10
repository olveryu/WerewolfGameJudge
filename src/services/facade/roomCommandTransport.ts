/**
 * Authenticated room-command transport.
 *
 * Owns command idempotency, transport retries, protocol parsing, and committed
 * snapshot application. Game-specific callers supply a codec and command type.
 */

import {
  type BaseGameState,
  type GameStateCodec,
  type GameType,
  newRequestId,
  parseRoomCommandResult,
  RoomCommandProtocolError,
} from '@werewolf/game-engine';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';

import { cfPost } from '@/services/cloudflare/cfFetch';
import { handleError } from '@/utils/errorPipeline';
import { isAbortError, isExpectedError, isNetworkError } from '@/utils/errorUtils';
import { facadeLog } from '@/utils/logger';

const COMMAND_PATH = '/room/command';
const BUSINESS_RETRY_DELAYS_MS = [300, 600] as const;
const EXPECTED_HTTP_STATUS_CODES = [400, 401, 403, 404, 409, 422, 429];

export interface RoomSnapshotStore<TState> {
  applySnapshot(state: TState, revision: number): void;
}

export interface PreparedRoomCommand<TCommand extends object> extends Record<string, unknown> {
  readonly roomCode: string;
  readonly commandId: string;
  readonly command: Readonly<TCommand>;
  readonly controlledSeat: number | null;
}

interface PrepareRoomCommandOptions<TCommand extends object> {
  readonly roomCode: string;
  readonly command: TCommand;
  readonly controlledSeat: number | null;
}

interface DispatchPreparedRoomCommandOptions<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
> {
  readonly prepared: PreparedRoomCommand<TCommand>;
  readonly codec: GameStateCodec<TState>;
  readonly store: RoomSnapshotStore<TState>;
  readonly label: string;
}

interface DispatchRoomCommandOptions<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
> extends PrepareRoomCommandOptions<TCommand> {
  readonly codec: GameStateCodec<TState>;
  readonly store: RoomSnapshotStore<TState>;
  readonly label: string;
}

/** Whether the client cannot know if the server committed this command. */
export function isRoomCommandDeliveryUnknown(result: ActionResult): boolean {
  if (result.success) return false;

  switch (result.reason) {
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
    case 'SERVER_ERROR':
    case 'INTERNAL_ERROR':
    case 'SERVICE_UNAVAILABLE':
    case 'OVERLOADED':
      return true;
    default:
      return false;
  }
}

/** Prepare one immutable command envelope for one or more dispatch attempts. */
export function prepareRoomCommand<TCommand extends object>({
  roomCode,
  command,
  controlledSeat,
}: PrepareRoomCommandOptions<TCommand>): PreparedRoomCommand<TCommand> {
  const envelope: PreparedRoomCommand<TCommand> = {
    roomCode,
    commandId: newRequestId(),
    command: Object.freeze(command),
    controlledSeat,
  };
  return Object.freeze(envelope);
}

function readErrorStatus(error: unknown): number | null {
  if (error === null || typeof error !== 'object' || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
}

function readErrorReason(error: unknown): string | null {
  if (error === null || typeof error !== 'object' || !('reason' in error)) return null;
  return typeof error.reason === 'string' && error.reason.length > 0 ? error.reason : null;
}

function isBusinessRetryable(error: unknown): boolean {
  if (isAbortError(error)) return true;
  const status = readErrorStatus(error);
  if (status !== null && status >= 500 && status <= 599) return true;
  const reason = readErrorReason(error);
  return reason === 'SERVER_ERROR' || reason === 'INTERNAL_ERROR';
}

function reportTransportError(error: unknown, label: string): void {
  handleError(error, {
    label,
    logger: facadeLog,
    feedback: false,
    expectedCodes: EXPECTED_HTTP_STATUS_CODES,
    isExpected: isExpectedError,
  });
}

function mapTransportError(error: unknown, label: string): ActionResult {
  reportTransportError(error, label);

  if (isAbortError(error)) return { success: false, reason: 'TIMEOUT' };
  if (isNetworkError(error)) return { success: false, reason: 'NETWORK_ERROR' };

  const reason = readErrorReason(error);
  if (reason !== null) return { success: false, reason };

  throw error;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/** Dispatch an already-prepared command without changing its commandId. */
export async function dispatchPreparedRoomCommand<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
>({
  prepared,
  codec,
  store,
  label,
}: DispatchPreparedRoomCommandOptions<TState, TCommand>): Promise<ActionResult> {
  let payload: unknown;
  for (let attempt = 0; ; attempt += 1) {
    try {
      payload = await cfPost<unknown>(COMMAND_PATH, prepared);
      break;
    } catch (error) {
      const retryDelay = BUSINESS_RETRY_DELAYS_MS[attempt];
      if (retryDelay !== undefined && isBusinessRetryable(error)) {
        facadeLog.warn('room command retrying', {
          label,
          commandId: prepared.commandId,
          commandType: 'type' in prepared.command ? prepared.command.type : null,
          attempt: attempt + 1,
        });
        await wait(retryDelay);
        continue;
      }
      return mapTransportError(error, label);
    }
  }

  try {
    const result = parseRoomCommandResult(payload, codec);
    if (result.commandId !== prepared.commandId) {
      throw new RoomCommandProtocolError(
        `RoomCommandResult commandId mismatch: expected ${prepared.commandId}, received ${result.commandId}`,
      );
    }

    if (result.kind === 'rejected') {
      return { success: false, reason: result.reason };
    }

    store.applySnapshot(result.snapshot.state, result.snapshot.revision);
    return result.outcome.kind === 'domainRejected'
      ? { success: false, reason: result.outcome.reason }
      : result.outcome.reason === undefined
        ? { success: true }
        : { success: true, reason: result.outcome.reason };
  } catch (error) {
    reportTransportError(error, label);
    throw error;
  }
}

/** Prepare and dispatch one ordinary room command. */
export function dispatchRoomCommand<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
>({
  roomCode,
  command,
  controlledSeat,
  codec,
  store,
  label,
}: DispatchRoomCommandOptions<TState, TCommand>): Promise<ActionResult> {
  return dispatchPreparedRoomCommand({
    prepared: prepareRoomCommand({ roomCode, command, controlledSeat }),
    codec,
    store,
    label,
  });
}
