/** Authenticated client API for immutable Pictionary PNG uploads and protected reads. */

import {
  PICTIONARY_STATE_CODEC,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import {
  parseRoomCommandResult,
  RoomCommandProtocolError,
  type RoomCommandResult,
} from '@game-judge/game-engine/platform/protocol/commandResult';

import { cfGetBinary, cfPutBinary } from '@/services/cloudflare/cfFetch';

const PNG_CONTENT_TYPE = 'image/png';

function encodePathSegment(value: string): string {
  if (value.length === 0) throw new Error('[FAIL-FAST] Pictionary media path segment is empty');
  return encodeURIComponent(value);
}

function parseUploadResponse(
  value: unknown,
  expectedCommandId: string,
): RoomCommandResult<PictionaryState> {
  const result = parseRoomCommandResult(value, PICTIONARY_STATE_CODEC);
  if (result.commandId !== expectedCommandId) {
    throw new RoomCommandProtocolError(
      `Pictionary media commandId mismatch: expected ${expectedCommandId}, received ${result.commandId}`,
    );
  }
  return result;
}

/**
 * Upload a reserved drawing. The returned authoritative snapshot is also broadcast by the room DO.
 *
 * @throws {CloudflareHttpError} For expired, invalid, or failed uploads.
 */
export async function uploadPictionaryDrawing(
  roomCode: string,
  submissionId: string,
  png: Blob,
  signal?: AbortSignal,
): Promise<RoomCommandResult<PictionaryState>> {
  const commandId = `pictionary-media-commit:${submissionId}`;
  return cfPutBinary(
    `/api/games/pictionary/rooms/${encodePathSegment(roomCode)}/submissions/${encodePathSegment(submissionId)}`,
    png,
    PNG_CONTENT_TYPE,
    (value) => parseUploadResponse(value, commandId),
    { signal },
  );
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

/**
 * Read a protected drawing as a portable data URI for React Native Image.
 *
 * @throws {CloudflareHttpError} When access is denied or the media is missing.
 */
export async function readPictionaryDrawingDataUri(
  roomCode: string,
  entryId: string,
  signal?: AbortSignal,
): Promise<string> {
  const bytes = await cfGetBinary(
    `/api/games/pictionary/rooms/${encodePathSegment(roomCode)}/media/${encodePathSegment(entryId)}`,
    PNG_CONTENT_TYPE,
    { signal },
  );
  return `data:${PNG_CONTENT_TYPE};base64,${encodeBase64(bytes)}`;
}
