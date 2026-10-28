/**
 * commandTransport — one POST /room/command and its classification.
 *
 * No retry here: delivery policy belongs to `CommandOutbox`. The response command ID must
 * equal the request's; a mismatch is a protocol violation and throws.
 */
import {
  parseRoomCommandResult,
  RoomCommandProtocolError,
} from '@game-judge/game-engine/platform/protocol/commandResult';
import { REASON_NO_STATE } from '@game-judge/game-engine/platform/protocol/reasons';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { ApiClient } from '@/platform/http/ApiClient';
import { ApiError } from '@/platform/http/ApiError';

import type { DispatchOutcome, PreparedCommand } from './types';

export const ROOM_COMMAND_PATH = '/room/command';

export interface CommandTransport<TState extends BaseGameState<string>> {
  send(prepared: PreparedCommand<object>, signal: AbortSignal): Promise<DispatchOutcome<TState>>;
}

export function createCommandTransport<TState extends BaseGameState<string>>(
  api: ApiClient,
  codec: GameStateCodec<TState>,
): CommandTransport<TState> {
  return {
    async send(prepared, signal) {
      try {
        const decision = await api.json({
          method: 'POST',
          path: ROOM_COMMAND_PATH,
          auth: 'required',
          // The DO command receipt replays the same decision for the same commandId + body.
          idempotent: true,
          body: {
            roomCode: prepared.roomCode,
            roomId: prepared.roomId,
            commandId: prepared.commandId,
            command: prepared.command,
            controlledSeat: prepared.controlledSeat,
          },
          decode: (value) => {
            const parsed = parseRoomCommandResult(value, codec);
            if (parsed.commandId !== prepared.commandId) {
              throw new RoomCommandProtocolError(
                `RoomCommandResult commandId mismatch: expected ${prepared.commandId}, received ${parsed.commandId}`,
              );
            }
            return parsed;
          },
          signal,
        });
        if (decision.kind === 'rejected') {
          return { kind: 'rejected', commandId: decision.commandId, reason: decision.reason };
        }
        return {
          kind: 'committed',
          commandId: decision.commandId,
          snapshot: decision.snapshot,
          outcome: decision.outcome,
        };
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        return classify(error, prepared.commandId);
      }
    },
  };
}

function classify<TState extends BaseGameState<string>>(
  error: ApiError,
  commandId: string,
): DispatchOutcome<TState> {
  switch (error.kind) {
    case 'aborted':
      return { kind: 'cancelled', commandId };
    case 'network':
      return { kind: 'undelivered', commandId, cause: 'network' };
    case 'timeout':
      return { kind: 'undelivered', commandId, cause: 'timeout' };
    case 'http':
      if (error.status === 404 && error.reason === REASON_NO_STATE) {
        return { kind: 'unavailable', commandId };
      }
      if (error.status !== null && error.status >= 500) {
        return { kind: 'undelivered', commandId, cause: 'server' };
      }
      // 400/401/403/409/422/429: the server answered; a client-side bug or auth state, not a decision.
      throw error;
    case 'contract':
      throw error;
  }
}
