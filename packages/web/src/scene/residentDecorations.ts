/**
 * Resident seat decorations: the cosmetics a seated player shows on the scene layer. Frames and
 * flairs today; pets join as a further field. Pure and light, so the room chunk can decide
 * whether to load the scene at all.
 */
import {
  type FlairId,
  FRAME_IDS,
  type FrameId,
  SEAT_FLAIR_IDS,
} from '@game-judge/game-engine/product/rewards';

/** A seat's resident decoration ids; at least one is set. */
export interface ResidentDecorations {
  readonly frameId: FrameId | null;
  readonly flairId: FlairId | null;
}

/** Equipped cosmetic ids from the seat's roster profile. */
interface EquippedCosmetics {
  readonly avatarFrame?: string;
  readonly seatFlair?: string;
}

const FRAME_ID_SET: ReadonlySet<string> = new Set(FRAME_IDS);
const FLAIR_ID_SET: ReadonlySet<string> = new Set(SEAT_FLAIR_IDS);

function isFrameId(id: string | undefined): id is FrameId {
  return id !== undefined && FRAME_ID_SET.has(id);
}

function isFlairId(id: string | undefined): id is FlairId {
  return id !== undefined && FLAIR_ID_SET.has(id);
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
  const frameId = isFrameId(equipped.avatarFrame) ? equipped.avatarFrame : null;
  const flairId = isFlairId(equipped.seatFlair) ? equipped.seatFlair : null;
  if (frameId === null && flairId === null) return null;
  const key = `${frameId}|${flairId}`;
  let residents = residentsByKey.get(key);
  if (!residents) {
    residents = { frameId, flairId };
    residentsByKey.set(key, residents);
  }
  return residents;
}
