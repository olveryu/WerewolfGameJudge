/**
 * Camp bucket — the 4-way camp partition used for per-user camp statistics.
 *
 * Mirrors the Faction enum 1:1 (Wolf / God / Villager / Special), matching the
 * encyclopedia's FACTION_SECTIONS grouping. Camp is derived from a role's Faction,
 * NOT its Team (Team exists only for seer-check binary logic).
 *
 * Pure type + ordering constant + mapping. No side effects or platform deps.
 */

import { getRoleSpec, type RoleId } from './spec';
import { Faction } from './spec/types';

/** The 4 camp buckets a player can belong to in a finished game. */
export type CampBucket = 'wolf' | 'god' | 'villager' | 'third';

/** Fixed display order for camp buckets: 狼人 → 神 → 平民 → 第三方. */
export const CAMP_ORDER: readonly CampBucket[] = ['wolf', 'god', 'villager', 'third'] as const;

/**
 * Derive a role's camp bucket from its Faction.
 *
 * Total mapping over the 4 Faction values — fails fast (throws) on an unknown faction
 * rather than silently bucketing. Faction.Special covers all third-party roles
 * (slacker / cupid / thief / etc.), consistent with FACTION_SECTIONS.
 */
export function getRoleCamp(roleId: RoleId): CampBucket {
  const faction = getRoleSpec(roleId).faction;
  switch (faction) {
    case Faction.Wolf:
      return 'wolf';
    case Faction.God:
      return 'god';
    case Faction.Villager:
      return 'villager';
    case Faction.Special:
      return 'third';
    default: {
      const exhaustive: never = faction;
      throw new Error(`getRoleCamp: unknown faction ${String(exhaustive)} for role ${roleId}`);
    }
  }
}
