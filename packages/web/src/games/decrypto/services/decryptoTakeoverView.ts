/** Read the seat-scoped state for a host-authorized bot takeover. */
import { parseDecryptoState } from '@game-judge/game-engine/games/decrypto/public';
import { z } from 'zod';

import { apiClient } from '@/platform/http/client';

const takeoverViewSchema = z.strictObject({
  seat: z.number().int().nonnegative(),
  state: z.unknown().transform((value) => parseDecryptoState(value)),
});

export type DecryptoTakeoverView = z.infer<typeof takeoverViewSchema>;

/** Fetches the controlled seat's private view without caching it. */
export function readDecryptoTakeoverView(
  roomCode: string,
  controlledSeat: number,
  signal: AbortSignal,
): Promise<DecryptoTakeoverView> {
  return apiClient.json({
    method: 'GET',
    path: `/api/games/decrypto/rooms/${encodeURIComponent(roomCode)}/takeover-view?controlledSeat=${controlledSeat}`,
    auth: 'required',
    idempotent: true,
    signal,
    decode: (value) => takeoverViewSchema.parse(value),
  });
}
