/** Authenticated transport for one already-prepared room command. */

import {
  type BaseGameState,
  type GameStateCodec,
  type GameType,
  newRequestId,
  parseRoomCommandResult,
  RoomCommandProtocolError,
  type RoomCommandResult,
} from '@werewolf/game-engine';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';

import { cfPost } from '@/services/cloudflare/cfFetch';
import { handleError } from '@/utils/errorPipeline';
import { isAbortError, isExpectedError, isNetworkError } from '@/utils/errorUtils';
import { facadeLog } from '@/utils/logger';

const COMMAND_PATH = '/room/command';
const BUSINESS_RETRY_DELAYS_MS = [300, 600] as const;
const EXPECTED_HTTP_STATUS_CODES = [400, 401, 403, 404, 422, 429];

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

interface SendPreparedRoomCommandOptions<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
> {
  readonly prepared: PreparedRoomCommand<TCommand>;
  readonly codec: GameStateCodec<TState>;
  readonly label: string;
}

export type RoomCommandTransportAttempt<TState extends BaseGameState<GameType>> =
  | {
      readonly kind: 'decided';
      readonly decision: RoomCommandResult<TState>;
    }
  | {
      readonly kind: 'notDecided' | 'deliveryUnknown';
      readonly result: ActionResult;
    };

function freezeCommand(value: unknown, ancestors: Set<object>): void {
  if (value === null || typeof value !== 'object') return;
  if (ancestors.has(value)) {
    throw new Error('Room command must not contain circular references');
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const item of value) freezeCommand(item, ancestors);
  } else {
    for (const item of Object.values(value)) freezeCommand(item, ancestors);
  }
  ancestors.delete(value);
  Object.freeze(value);
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

/** Prepare and deeply freeze one command envelope. */
export function prepareRoomCommand<TCommand extends object>({
  roomCode,
  command,
  controlledSeat,
}: PrepareRoomCommandOptions<TCommand>): PreparedRoomCommand<TCommand> {
  freezeCommand(command, new Set());
  return Object.freeze({
    roomCode,
    commandId: newRequestId(),
    command,
    controlledSeat,
  });
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

function mapTransportError(
  error: unknown,
  label: string,
): Exclude<RoomCommandTransportAttempt<never>, { readonly kind: 'decided' }> {
  reportTransportError(error, label);

  let result: ActionResult;
  if (isAbortError(error)) {
    result = { success: false, reason: 'TIMEOUT' };
  } else if (isNetworkError(error)) {
    result = { success: false, reason: 'NETWORK_ERROR' };
  } else {
    const reason = readErrorReason(error);
    if (reason === null) throw error;
    result = { success: false, reason };
  }

  const status = readErrorStatus(error);
  const isUnknownStatus = status !== null && status >= 500 && status <= 599;
  return {
    kind:
      isUnknownStatus || isRoomCommandDeliveryUnknown(result) ? 'deliveryUnknown' : 'notDecided',
    result,
  };
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/** Send an immutable command without applying its snapshot or changing its ID. */
export async function sendPreparedRoomCommand<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
>({
  prepared,
  codec,
  label,
}: SendPreparedRoomCommandOptions<TState, TCommand>): Promise<RoomCommandTransportAttempt<TState>> {
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
    const decision = parseRoomCommandResult(payload, codec);
    if (decision.commandId !== prepared.commandId) {
      throw new RoomCommandProtocolError(
        `RoomCommandResult commandId mismatch: expected ${prepared.commandId}, received ${decision.commandId}`,
      );
    }
    return { kind: 'decided', decision };
  } catch (error) {
    reportTransportError(error, label);
    throw error;
  }
}
