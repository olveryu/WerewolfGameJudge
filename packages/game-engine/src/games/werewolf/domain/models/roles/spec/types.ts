/**
 * Role Types - Single Source of Truth for Faction / Team enums
 *
 * IMPORTANT: Team is different from Faction for display purposes.
 * - Faction: Wolf, God, Villager, Special (internal classification)
 * - Team: Wolf, Good, Third (for seer check & UI display)
 *
 * SEER CHECK RULE (authoritative):
 * - Team.Wolf → seer sees "狼人"
 * - Team.Good OR Team.Third → seer sees "好人"
 * - This is strictly binary. Third-party roles are treated as "好人" for seer checks.
 *
 * Exports Faction / Team enums. No service deps, no side effects.
 */

export enum Faction {
  Wolf = 'Wolf',
  God = 'God',
  Villager = 'Villager',
  Special = 'Special',
}

/**
 * Team for display purposes (seer result, camp display)
 *
 * - Wolf: Wolf (seer sees "狼人")
 * - Good: Good (god + villager, seer sees "好人")
 * - Third: Third party (slacker before choosing idol, seer sees "好人")
 *
 * NOTE: For seer check, Third is treated same as Good → "好人"
 */
export enum Team {
  Wolf = 'Wolf',
  Good = 'Good',
  Third = 'Third',
}
