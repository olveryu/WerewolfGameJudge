/** FibKing role-card image registry: the compressed 512px WebP portraits. */
import type { FibRole } from '@game-judge/game-engine/games/fibking/public';

import fibber from '../../../../../../assets/avatars/web/fibber.webp';
import guesser from '../../../../../../assets/avatars/web/guesser.webp';
import honest from '../../../../../../assets/avatars/web/honest.webp';

const FIBKING_ROLE_IMAGE_MAP: Readonly<Record<FibRole, string>> = {
  fibber,
  honest,
  guesser,
};

/** Resolve FibKing role IDs to the game's hand-drawn role-card asset URLs. */
export function getRoleAvatar(roleId: FibRole): string {
  return FIBKING_ROLE_IMAGE_MAP[roleId];
}
