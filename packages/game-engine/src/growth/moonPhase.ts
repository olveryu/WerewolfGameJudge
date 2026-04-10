/**
 * moonPhase — 月相经验值系统
 *
 * 每有效局结算时，服务端为每个注册玩家独立抽取一个月相，决定 XP 奖励。
 * 纯函数，使用 Web Crypto API 的随机数。
 */

export interface MoonPhase {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly xp: number;
  readonly weight: number;
}

export const MOON_PHASES: readonly MoonPhase[] = [
  { id: 'newMoon', name: '新月', icon: '🌑', xp: 40, weight: 15 },
  { id: 'waxCrescent', name: '蛾眉月', icon: '🌒', xp: 45, weight: 25 },
  { id: 'firstQuarter', name: '上弦月', icon: '🌓', xp: 50, weight: 25 },
  { id: 'waxGibbous', name: '盈凸月', icon: '🌔', xp: 55, weight: 20 },
  { id: 'fullMoon', name: '满月', icon: '🌕', xp: 65, weight: 12 },
  { id: 'bloodMoon', name: '血月', icon: '🩸', xp: 90, weight: 3 },
] as const;

const TOTAL_WEIGHT = MOON_PHASES.reduce((sum, p) => sum + p.weight, 0);

/** 加权随机抽取一个月相 */
export function rollMoonPhase(): MoonPhase {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  let roll = (array[0] / 0xffffffff) * TOTAL_WEIGHT;
  for (const phase of MOON_PHASES) {
    roll -= phase.weight;
    if (roll <= 0) return phase;
  }
  return MOON_PHASES[0];
}
