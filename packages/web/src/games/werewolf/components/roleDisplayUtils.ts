/** Shared role-display utilities derived from ROLE_SPECS. */
import {
  Faction,
  isWolfRole,
  ROLE_SPECS,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';

/** Get Chinese faction name from roleId */
export const getFactionName = (roleId: RoleId): string => {
  if (isWolfRole(roleId)) return '狼人阵营';
  const faction = ROLE_SPECS[roleId].faction;
  if (faction === Faction.God) return '神职阵营';
  if (faction === Faction.Special) return '第三方阵营';
  return '好人阵营';
};
