/**
 * level — 等级系统
 *
 * 21 级（Lv.0–Lv.20），按累计 XP 升级。称号跟等级自动走。
 * 纯函数，无副作用。
 */

export const LEVEL_THRESHOLDS: readonly number[] = [
  0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250, 2750, 3500, 4400, 5500, 6800, 8500, 10500,
  13000, 16000, 20000, 25000,
] as const;

const MAX_LEVEL = LEVEL_THRESHOLDS.length - 1;

export const LEVEL_TITLES: Readonly<Record<number, string>> = {
  0: '新手',
  1: '入门',
  5: '常客',
  10: '老手',
  15: '元老',
  20: '传奇',
};

/** 根据累计 XP 计算等级 */
export function getLevel(xp: number): number {
  for (let i = MAX_LEVEL; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

/** 获取等级称号（向下取最近的有称号等级） */
export function getLevelTitle(level: number): string {
  for (let l = level; l >= 0; l--) {
    if (LEVEL_TITLES[l]) return LEVEL_TITLES[l];
  }
  return '新手';
}

/** 当前等级进度比例 0–1（满级返回 1） */
export function getLevelProgress(xp: number): number {
  const level = getLevel(xp);
  if (level >= MAX_LEVEL) return 1;
  const currentThreshold = LEVEL_THRESHOLDS[level];
  const nextThreshold = LEVEL_THRESHOLDS[level + 1];
  return (xp - currentThreshold) / (nextThreshold - currentThreshold);
}
