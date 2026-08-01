/** Resolve Werewolf role IDs to the product's hand-drawn avatar assets. */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { AVATAR_IMAGE_MAP } from '@/utils/avatarImages';

export function getRoleAvatar(roleId: RoleId): number {
  return AVATAR_IMAGE_MAP[roleId];
}
