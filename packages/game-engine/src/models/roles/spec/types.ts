/**
 * Role Types - Single Source of Truth for Faction / Team enums
 *
 * IMPORTANT: Team is different from Faction for display purposes.
 * - Faction: Wolf, God, Villager, Special (internal classification)
 * - Team: wolf, good, third (for seer check & UI display)
 *
 * SEER CHECK RULE (authoritative):
 * - team='wolf' → seer sees "狼人"
 * - team='good' OR team='third' → seer sees "好人"
 * - This is strictly binary. Third-party roles are treated as "好人" for seer checks.
 *
 * 导出 Faction / Team 枚举及 getSeerCheckResultForTeam 纯函数，不依赖 service、不含副作用。
 */

export enum Faction {
  Wolf = 'wolf',
  God = 'god',
  Villager = 'villager',
  Special = 'special',
}

/**
 * Team for display purposes (seer result, camp display)
 *
 * - wolf: 狼人 (seer sees "狼人")
 * - good: 好人 (god + villager, seer sees "好人")
 * - third: 第三方 (slacker before choosing idol, seer sees "好人")
 *
 * NOTE: For seer check, 'third' is treated same as 'good' → "好人"
 */
export type Team = 'wolf' | 'good' | 'third';

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
 * Third-party ('third') is treated as '好人'.
 */
export function getSeerCheckResultForTeam(team: Team): SeerCheckResult {
  return team === 'wolf' ? '狼人' : '好人';
}
