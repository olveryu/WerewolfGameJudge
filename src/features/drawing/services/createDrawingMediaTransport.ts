/**
 * Drawing media transport factory (Pictionary / DrawGuess shared).
 *
 * Both drawing games upload finished PNGs to the same Worker media routes
 * and read them back as data URIs; only the game id (URL segment and
 * command-id prefix), display name (error messages), and state codec
 * differ. This factory holds the single implementation; each game creates
 * one instance with its own parameters.
 */

import {
  parseRoomCommandResult,
  RoomCommandProtocolError,
  type RoomCommandResult,
} from '@game-judge/game-engine/platform/protocol/commandResult';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import { cfGetBinary, cfPutBinary } from '@/services/cloudflare/cfFetch';

const PNG_CONTENT_TYPE = 'image/png';

export interface DrawingMediaTransportConfig<TState extends BaseGameState<string>> {
  /** URL segment and command-id prefix, e.g. 'pictionary'. */
  readonly gameId: string;
  /** Display name used in error messages, e.g. 'Pictionary'. */
  readonly gameName: string;
  /** Authoritative state codec for the upload response. */
  readonly stateCodec: GameStateCodec<TState>;
}

export interface DrawingMediaTransport<TState extends BaseGameState<string>> {
  /**
   * Upload a reserved drawing. The returned authoritative snapshot is
   * also broadcast by the room DO.
   */
  readonly uploadDrawing: (
    roomCode: string,
    submissionId: string,
    png: Blob,
    controlledSeat: number | null,
    signal?: AbortSignal,
  ) => Promise<RoomCommandResult<TState>>;
  /** Read a protected drawing as a portable data URI for React Native Image. */
  readonly readDrawingDataUri: (
    roomCode: string,
    entryId: string,
    controlledSeat: number | null,
    signal?: AbortSignal,
  ) => Promise<string>;
}

export function createDrawingMediaTransport<TState extends BaseGameState<string>>(
  config: DrawingMediaTransportConfig<TState>,
): DrawingMediaTransport<TState> {
  const { gameId, gameName, stateCodec } = config;

  function encodePathSegment(value: string): string {
    if (value.length === 0) throw new Error(`[FAIL-FAST] ${gameName} media path segment is empty`);
    return encodeURIComponent(value);
  }

  function controlledSeatQuery(controlledSeat: number | null): string {
    if (controlledSeat === null) return '';
    if (!Number.isSafeInteger(controlledSeat) || controlledSeat < 0) {
      throw new Error(`[FAIL-FAST] Invalid controlled ${gameName} seat: ${controlledSeat}`);
    }
    return `?controlledSeat=${controlledSeat}`;
  }

  function parseUploadResponse(
    value: unknown,
    expectedCommandId: string,
  ): RoomCommandResult<TState> {
    const result = parseRoomCommandResult(value, stateCodec);
    if (result.commandId !== expectedCommandId) {
      throw new RoomCommandProtocolError(
        `${gameName} media commandId mismatch: expected ${expectedCommandId}, received ${result.commandId}`,
      );
    }
    return result;
  }

  function encodeBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 32_768;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return globalThis.btoa(binary);
  }

  return {
    async uploadDrawing(roomCode, submissionId, png, controlledSeat, signal) {
      const commandId = `${gameId}-media-commit:${submissionId}`;
      return cfPutBinary(
        `/api/games/${gameId}/rooms/${encodePathSegment(roomCode)}/submissions/${encodePathSegment(submissionId)}${controlledSeatQuery(controlledSeat)}`,
        png,
        PNG_CONTENT_TYPE,
        (value) => parseUploadResponse(value, commandId),
        { signal },
      );
    },
    async readDrawingDataUri(roomCode, entryId, controlledSeat, signal) {
      const bytes = await cfGetBinary(
        `/api/games/${gameId}/rooms/${encodePathSegment(roomCode)}/media/${encodePathSegment(entryId)}${controlledSeatQuery(controlledSeat)}`,
        PNG_CONTENT_TYPE,
        { signal },
      );
      return `data:${PNG_CONTENT_TYPE};base64,${encodeBase64(bytes)}`;
    },
  };
}
