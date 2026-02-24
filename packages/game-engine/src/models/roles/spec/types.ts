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
 * 导出 Faction / Team 枚举及 getSeerCheckResultForTeam 纯函数，不依赖 service、不含副作用。
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
 * - Wolf: 狼人 (seer sees "狼人")
 * - Good: 好人 (god + villager, seer sees "好人")
 * - Third: 第三方 (slacker before choosing idol, seer sees "好人")
 *
 * NOTE: For seer check, Third is treated same as Good → "好人"
 */
export enum Team {
  Wolf = 'Wolf',
  Good = 'Good',
  Third = 'Third',
}

/**
 * Seer check result type - strictly binary
 *
 * RULE: Seer can only see binary '好人' or '狼人'.
 * - All wolf-faction roles (wolf, gargoyle, wolfQueen, etc.) → '狼人'
 * - All other roles (villager, god, third-party) → '好人'
 */
export type SeerCheckResult = '好人' | '狼人';

/**
 * Get seer check result for a team.
 *
 * This is the authoritative function for computing seer results.
 * Third-party (Team.Third) is treated as '好人'.
 */
export function getSeerCheckResultForTeam(team: Team): SeerCheckResult {
  return team === Team.Wolf ? '狼人' : '好人';
}
