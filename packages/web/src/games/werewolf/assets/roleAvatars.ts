/** Resolve Werewolf role IDs to the product's hand-drawn avatar assets. */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { getHandDrawnPortraitUrl } from '@/components/avatar/avatarSources';

export function getRoleAvatar(roleId: RoleId): string {
  return getHandDrawnPortraitUrl(roleId);
}
