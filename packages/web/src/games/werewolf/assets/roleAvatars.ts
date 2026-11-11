/** Resolve Werewolf role IDs to the product's hand-drawn avatar assets. */

import { getRoleDisplayAs, type RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { getHandDrawnPortraitUrl } from '@/components/avatar/avatarSources';

export function getRoleAvatar(roleId: RoleId): string {
  return getHandDrawnPortraitUrl(roleId);
}

/** Portraits for the public board, including identities a disguised role can display. */
export function getBoardRolePortraits(templateRoles: readonly RoleId[]): readonly string[] {
  const candidates = new Set(templateRoles);
  for (const roleId of templateRoles) {
    const displayAs = getRoleDisplayAs(roleId);
    if (displayAs !== undefined) candidates.add(displayAs);
  }
  return [...candidates].map(getRoleAvatar);
}
