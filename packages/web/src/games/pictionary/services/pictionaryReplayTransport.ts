/** Bounded replay upload and cached gallery assets; PNG remains the permanent presentation path. */

import {
  PICTIONARY_DRAWING_REPLAY_SCHEMA,
  type PictionaryDrawingReplay,
} from '@game-judge/game-engine/games/pictionary/public';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '@/platform/http/client';
import { roomScreenLog } from '@/utils/logger';

import { pictionaryMediaTransport } from './pictionaryMediaTransport';

const successSchema = z.strictObject({ success: z.literal(true) });
const MAX_REPLAY_BYTES = 1024 * 1024;

/** Optional replay failures are reported by the caller and must never discard the PNG submission. */
export async function uploadPictionaryReplay(
  roomCode: string,
  submissionId: string,
  replay: PictionaryDrawingReplay,
  controlledSeat: number | null,
  signal: AbortSignal,
): Promise<void> {
  const body = new Blob([JSON.stringify(replay)], { type: 'application/json' });
  if (body.size > MAX_REPLAY_BYTES) throw new Error('Pictionary replay exceeds 1 MiB');
  const query = controlledSeat === null ? '' : `?controlledSeat=${controlledSeat}`;
  await apiClient.json({
    method: 'PUT',
    path: `/api/games/pictionary/rooms/${encodeURIComponent(roomCode)}/submissions/${encodeURIComponent(submissionId)}/replay${query}`,
    auth: 'required',
    idempotent: true,
    timeoutMs: 2_000,
    signal,
    body,
    headers: { 'Content-Type': 'application/json' },
    decode: (value) => successSchema.parse(value),
  });
}

/** Query cache shares prefetch with the active drawing and avoids storing strokes in room state. */
export function pictionaryReplayOptions(roomCode: string, entryId: string) {
  return queryOptions({
    queryKey: ['pictionary', 'replay', roomCode, entryId] as const,
    queryFn: async ({ signal }) => {
      try {
        return await apiClient.json({
          method: 'GET',
          path: `/api/games/pictionary/rooms/${encodeURIComponent(roomCode)}/media/${encodeURIComponent(entryId)}/replay`,
          auth: 'required',
          idempotent: true,
          signal,
          timeoutMs: 3_000,
          decode: (value) => PICTIONARY_DRAWING_REPLAY_SCHEMA.parse(value),
        });
      } catch (error: unknown) {
        if (!signal.aborted)
          roomScreenLog.warn('Pictionary replay unavailable; displaying PNG', { entryId, error });
        throw error;
      }
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
}

/** Prefetch the next PNG without changing the existing image component's retry behavior. */
export function pictionaryGalleryImageOptions(roomCode: string, entryId: string) {
  return queryOptions({
    queryKey: ['pictionary', 'gallery-image', roomCode, entryId] as const,
    queryFn: async ({ signal }) => {
      try {
        return await pictionaryMediaTransport.readDrawingDataUri(roomCode, entryId, null, signal);
      } catch (error: unknown) {
        if (!signal.aborted)
          roomScreenLog.warn('Pictionary gallery PNG prefetch failed', { entryId, error });
        throw error;
      }
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
}
