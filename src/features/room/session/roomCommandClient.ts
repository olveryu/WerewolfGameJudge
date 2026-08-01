/** Authenticated transport for one immutable room command envelope. */

import {
  parseRoomCommandResult,
  RoomCommandProtocolError,
} from '@game-judge/game-engine/platform/protocol/commandResult';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type {
  PreparedRoomCommand,
  RoomCommandDispatchOutcome,
} from '@/features/room/session/types';
import { cfPost, CloudflareHttpError } from '@/services/cloudflare/cfFetch';
import { handleError } from '@/utils/errorPipeline';
import { isAbortError, isExpectedError, isNetworkError } from '@/utils/errorUtils';
import { roomSessionLog } from '@/utils/logger';

const COMMAND_PATH = '/room/command';
const BUSINESS_RETRY_DELAYS_MS = [300, 600] as const;
const EXPECTED_HTTP_STATUS_CODES = [400, 401, 403, 404, 422, 429];

interface PrepareRoomCommandOptions<TCommand extends object> {
  readonly sessionEpoch: number;
  readonly roomCode: string;
  readonly roomId: string;
  readonly command: TCommand;
  readonly controlledSeat: number | null;
  readonly commandId: string;
}

interface SendPreparedRoomCommandOptions<
  TState extends BaseGameState<string>,
  TCommand extends object,
> {
  readonly prepared: PreparedRoomCommand<TCommand>;
  readonly codec: GameStateCodec<TState>;
  readonly label: string;
}

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

function isDeliveryUnknownReason(reason: string): boolean {
  switch (reason) {
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

/** Prepare and deeply freeze one session-bound command envelope. */
export function prepareRoomCommand<TCommand extends object>({
  sessionEpoch,
  roomCode,
  roomId,
  command,
  controlledSeat,
  commandId,
}: PrepareRoomCommandOptions<TCommand>): PreparedRoomCommand<TCommand> {
  if (!Number.isSafeInteger(sessionEpoch) || sessionEpoch < 1) {
    throw new Error('Prepared room command requires a positive session epoch');
  }
  if (commandId.length === 0) {
    throw new Error('Prepared room command requires a non-empty command ID');
  }
  freezeCommand(command, new Set());
  return Object.freeze({
    sessionEpoch,
    roomCode,
    roomId,
    commandId,
    command,
    controlledSeat,
  });
}

function isBusinessRetryable(error: unknown): boolean {
  if (isAbortError(error)) return true;
  if (!(error instanceof CloudflareHttpError)) return false;
  if (error.status >= 500 && error.status <= 599) return true;
  return error.reason === 'SERVER_ERROR' || error.reason === 'INTERNAL_ERROR';
}

function reportTransportError(error: unknown, label: string): void {
  handleError(error, {
    label,
    logger: roomSessionLog,
    feedback: false,
    expectedCodes: EXPECTED_HTTP_STATUS_CODES,
    isExpected: isExpectedError,
  });
}

function mapTransportError(
  error: unknown,
  label: string,
  commandId: string,
): Exclude<RoomCommandDispatchOutcome<never>, { readonly kind: 'decided' }> {
  reportTransportError(error, label);

  let reason: string;
  if (isAbortError(error)) {
    reason = 'TIMEOUT';
  } else if (isNetworkError(error)) {
    reason = 'NETWORK_ERROR';
  } else if (error instanceof CloudflareHttpError) {
    reason = error.reason;
  } else {
    throw error;
  }

  const hasUnknownServerOutcome =
    error instanceof CloudflareHttpError && error.status >= 500 && error.status <= 599;
  return {
    kind:
      hasUnknownServerOutcome || isDeliveryUnknownReason(reason) ? 'deliveryUnknown' : 'notDecided',
    commandId,
    reason,
  };
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/** Send an immutable command without applying its snapshot or changing its ID. */
export async function sendPreparedRoomCommand<
  TState extends BaseGameState<string>,
  TCommand extends object,
>({
  prepared,
  codec,
  label,
}: SendPreparedRoomCommandOptions<TState, TCommand>): Promise<RoomCommandDispatchOutcome<TState>> {
  const request = {
    roomCode: prepared.roomCode,
    roomId: prepared.roomId,
    commandId: prepared.commandId,
    command: prepared.command,
    controlledSeat: prepared.controlledSeat,
  };

  for (let attempt = 0; ; attempt += 1) {
    try {
      const decision = await cfPost(COMMAND_PATH, request, (value) => {
        const parsed = parseRoomCommandResult(value, codec);
        if (parsed.commandId !== prepared.commandId) {
          throw new RoomCommandProtocolError(
            `RoomCommandResult commandId mismatch: expected ${prepared.commandId}, received ${parsed.commandId}`,
          );
        }
        return parsed;
      });
      return { kind: 'decided', decision };
    } catch (error) {
      const retryDelay = BUSINESS_RETRY_DELAYS_MS[attempt];
      if (retryDelay !== undefined && isBusinessRetryable(error)) {
        roomSessionLog.warn('room command retrying', {
          label,
          commandId: prepared.commandId,
          commandType: 'type' in prepared.command ? prepared.command.type : null,
          attempt: attempt + 1,
        });
        await wait(retryDelay);
        continue;
      }
      return mapTransportError(error, label, prepared.commandId);
    }
  }
}
