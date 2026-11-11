/** Undercover role-card image registry: the compressed 512px WebP portraits. */
import type { UndercoverRole } from '@game-judge/game-engine/games/undercover/public';

import blank from '../../../../../../assets/avatars/web/blank.webp';
import civilian from '../../../../../../assets/avatars/web/civilian.webp';
import undercover from '../../../../../../assets/avatars/web/undercover.webp';

const UNDERCOVER_ROLE_IMAGE_MAP: Readonly<Record<UndercoverRole, string>> = {
  civilian,
  undercover,
  blank,
};

/** Resolve Undercover role IDs to the game's hand-drawn role-card asset URLs. */
export function getRoleAvatar(roleId: UndercoverRole): string {
  return UNDERCOVER_ROLE_IMAGE_MAP[roleId];
}

/** The public blank-card setting determines which portrait kinds can appear. */
export function getBoardRolePortraits(hasBlank: boolean): readonly string[] {
  return hasBlank ? [civilian, undercover, blank] : [civilian, undercover];
}
