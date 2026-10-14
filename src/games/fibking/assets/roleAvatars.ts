/**
 * roleAvatars — FibKing role-card image registry (native: PNG)
 *
 * Native platforms use full-size raw PNGs.
 * See roleAvatars.web.ts for the web variant (512px WebP).
 */

import type { FibRole } from '@game-judge/game-engine/games/fibking/public';

import fibber from '../../../../assets/avatars/raw/fibber.png';
import guesser from '../../../../assets/avatars/raw/guesser.png';
import honest from '../../../../assets/avatars/raw/honest.png';

const FIBKING_ROLE_IMAGE_MAP: Record<FibRole, number> = {
  fibber,
  honest,
  guesser,
};

/** Resolve FibKing role IDs to the game's hand-drawn role-card assets. */
export function getRoleAvatar(roleId: FibRole): number {
  return FIBKING_ROLE_IMAGE_MAP[roleId];
}
