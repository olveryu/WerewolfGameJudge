/**
 * Resident seat decorations: the looping cosmetics a seated player shows on the scene layer.
 * Flairs today; frames and pets join as further fields. Pure and light, so the room chunk can
 * decide whether to load the scene at all.
 */
import { type FlairId, SEAT_FLAIR_IDS } from '@game-judge/game-engine/product/rewards';

/** A seat's resident decoration ids; at least one is set. */
export interface ResidentDecorations {
  readonly flairId: FlairId | null;
}

/** Equipped cosmetic ids from the seat's roster profile. */
interface EquippedCosmetics {
  readonly seatFlair?: string;
}

const FLAIR_IDS: ReadonlySet<string> = new Set(SEAT_FLAIR_IDS);

function isFlairId(id: string): id is FlairId {
  return FLAIR_IDS.has(id);
}

/** One object per distinct combination, so memoised seats and effects see stable identities. */
const residentsByKey = new Map<string, ResidentDecorations>();

/**
 * The resident decorations a seat shows, or `null` when it has none. Ids the catalog does not
 * know (a profile written by a newer client) show nothing, as in the previous client.
 */
export function resolveResidentDecorations(
  equipped: EquippedCosmetics,
): ResidentDecorations | null {
  const flairId =
    equipped.seatFlair !== undefined && isFlairId(equipped.seatFlair) ? equipped.seatFlair : null;
  if (flairId === null) return null;
  let residents = residentsByKey.get(flairId);
  if (!residents) {
    residents = { flairId };
    residentsByKey.set(flairId, residents);
  }
  return residents;
}
