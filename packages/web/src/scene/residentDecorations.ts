/**
 * Resident seat decorations: the cosmetics a seated player shows on the scene layer (avatar
 * frame, flair, pet) and the entrance that plays when the seat is shown. Pure and light, so the
 * room chunk can decide whether to load the scene at all.
 */
import {
  type FlairId,
  FRAME_IDS,
  type FrameId,
  ROLE_REVEAL_EFFECT_IDS,
  type RoleRevealEffectId,
  SEAT_ANIMATION_IDS,
  SEAT_FLAIR_IDS,
  type SeatAnimationId,
} from '@game-judge/game-engine/product/rewards';

/** A seat's resident decoration ids; at least one is set. */
export interface ResidentDecorations {
  readonly frameId: FrameId | null;
  readonly flairId: FlairId | null;
  /** The companion pet, keyed by the equipped role reveal effect as in the previous client. */
  readonly petId: RoleRevealEffectId | null;
  readonly entranceId: SeatAnimationId | null;
}

/** Equipped cosmetic ids from the seat's roster profile. */
interface EquippedCosmetics {
  readonly avatarFrame?: string;
  readonly seatFlair?: string;
  readonly seatPetId?: string;
  readonly seatAnimation?: string;
}

function catalogGuard<Id extends string>(ids: readonly Id[]) {
  const known: ReadonlySet<string> = new Set(ids);
  return (id: string | undefined): id is Id => id !== undefined && known.has(id);
}

const isFrameId = catalogGuard(FRAME_IDS);
const isFlairId = catalogGuard(SEAT_FLAIR_IDS);
const isPetId = catalogGuard(ROLE_REVEAL_EFFECT_IDS);
const isEntranceId = catalogGuard(SEAT_ANIMATION_IDS);

/** One object per distinct combination, so memoised seats and effects see stable identities. */
const residentsByKey = new Map<string, ResidentDecorations>();

/**
 * The resident decorations a seat shows, or `null` when it has none. Ids the catalog does not
 * know (a profile written by a newer client, or the `random` / `none` reveal choices) show
 * nothing, as in the previous client.
 */
export function resolveResidentDecorations(
  equipped: EquippedCosmetics,
): ResidentDecorations | null {
  const frameId = isFrameId(equipped.avatarFrame) ? equipped.avatarFrame : null;
  const flairId = isFlairId(equipped.seatFlair) ? equipped.seatFlair : null;
  const petId = isPetId(equipped.seatPetId) ? equipped.seatPetId : null;
  const entranceId = isEntranceId(equipped.seatAnimation) ? equipped.seatAnimation : null;
  if (frameId === null && flairId === null && petId === null && entranceId === null) return null;
  const key = `${frameId}|${flairId}|${petId}|${entranceId}`;
  let residents = residentsByKey.get(key);
  if (!residents) {
    residents = { frameId, flairId, petId, entranceId };
    residentsByKey.set(key, residents);
  }
  return residents;
}
