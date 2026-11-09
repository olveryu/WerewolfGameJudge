/**
 * useNightDraft — the actioner's in-progress night picks, kept across a
 * reload within one step.
 *
 * The draft is the magician's first seat and the multi-select set; it is
 * scoped to `{ stepId, actorSeat, roleRevealRandomNonce, seatCount }`, so a
 * step advance, a takeover switch, a redeal, or a seat-count change
 * discards it. Validation beyond shape is the engine's job at submit.
 */

import type { SchemaId } from '@game-judge/game-engine/games/werewolf/public';
import { useMemo } from 'react';

import { type ScopedDraft, useScopedDraft } from '@/features/room/hooks/useScopedDraft';

import type { NightDraft } from '../night/NightInteractionModel';

const NIGHT_DRAFT_NAMESPACE = 'werewolf:night-action';

export const EMPTY_NIGHT_DRAFT: NightDraft = { firstSwapSeat: null, multiSelectedSeats: [] };

/** A type alias (not an interface) so it satisfies the scoped-draft record shape. */
export type NightDraftScope = {
  readonly stepId: SchemaId | null;
  readonly actorSeat: number | null;
  readonly roleRevealRandomNonce: string | null;
  readonly seatCount: number;
};

function isSeat(value: unknown, seatCount: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value < seatCount
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Shape check for a stored draft; anything else is dropped as stale. */
export function parseNightDraft(value: unknown, seatCount: number): NightDraft {
  if (!isRecord(value)) {
    throw new Error('Night draft must be an object');
  }
  const first = value.firstSwapSeat;
  if (first !== null && !isSeat(first, seatCount)) {
    throw new Error(`Night draft firstSwapSeat out of range: ${JSON.stringify(first)}`);
  }
  const seats = value.multiSelectedSeats;
  if (!Array.isArray(seats) || !seats.every((seat) => isSeat(seat, seatCount))) {
    throw new Error('Night draft multiSelectedSeats must be seats in range');
  }
  return { firstSwapSeat: first, multiSelectedSeats: seats };
}

export function useNightDraft(input: {
  readonly userId: string;
  readonly roomId: string;
  readonly scope: NightDraftScope;
}): ScopedDraft<NightDraft> {
  const { seatCount } = input.scope;
  const parse = useMemo(() => (value: unknown) => parseNightDraft(value, seatCount), [seatCount]);
  return useScopedDraft<NightDraft>({
    namespace: NIGHT_DRAFT_NAMESPACE,
    userId: input.userId,
    roomId: input.roomId,
    scope: input.scope,
    initial: EMPTY_NIGHT_DRAFT,
    parse,
  });
}
