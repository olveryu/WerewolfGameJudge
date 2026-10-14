/**
 * roleAvatars — Undercover role-card image registry (native: PNG)
 *
 * Native platforms use full-size raw PNGs.
 * See roleAvatars.web.ts for the web variant (512px WebP).
 */

import type { UndercoverRole } from '@game-judge/game-engine/games/undercover/public';

import blank from '../../../../assets/avatars/raw/blank.png';
import civilian from '../../../../assets/avatars/raw/civilian.png';
import undercover from '../../../../assets/avatars/raw/undercover.png';

const UNDERCOVER_ROLE_IMAGE_MAP: Record<UndercoverRole, number> = {
  civilian,
  undercover,
  blank,
};

/** Resolve Undercover role IDs to the game's hand-drawn role-card assets. */
export function getRoleAvatar(roleId: UndercoverRole): number {
  return UNDERCOVER_ROLE_IMAGE_MAP[roleId];
}
