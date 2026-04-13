/**
 * level — 等级系统
 *
 * 52 级（Lv.0–Lv.51），按累计 XP 升级。每级解锁 1 个头像或头像框。
 * XP/局: 50 + random(0~20)，期望 ~60。前期 1 局/级，后期 2 局/级。
 * 纯函数，无副作用。
 */

/** XP 基础值 */
export const XP_BASE = 50;

/** XP 随机范围上限（含） */
export const XP_RANDOM_MAX = 20;

/**
 * 累计 XP 阈值表。index = 等级。
 *
 * Lv.0 = 0（免费），Lv.1–20 每级 +60，Lv.21–40 每级 +90，Lv.41–51 每级 +120。
 */
export const LEVEL_THRESHOLDS: readonly number[] = /* @__PURE__ */ (() => {
  const t = [0];
  for (let lv = 1; lv <= 51; lv++) {
    const delta = lv <= 20 ? 60 : lv <= 40 ? 90 : 120;
    t.push(t[lv - 1] + delta);
  }
  return t;
})() as readonly number[];

const MAX_LEVEL = LEVEL_THRESHOLDS.length - 1;

/** 根据累计 XP 计算等级 */
export function getLevel(xp: number): number {
  for (let i = MAX_LEVEL; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

/** 当前等级进度比例 0–1（满级返回 1） */
export function getLevelProgress(xp: number): number {
  const level = getLevel(xp);
  if (level >= MAX_LEVEL) return 1;
  const currentThreshold = LEVEL_THRESHOLDS[level];
  const nextThreshold = LEVEL_THRESHOLDS[level + 1];
  return (xp - currentThreshold) / (nextThreshold - currentThreshold);
}

/** 等级称号（按等级段位划分） */
const LEVEL_TITLES = [
  { min: 0, max: 5, title: '新手' },
  { min: 6, max: 10, title: '入门' },
  { min: 11, max: 20, title: '常客' },
  { min: 21, max: 30, title: '老手' },
  { min: 31, max: 40, title: '元老' },
  { min: 41, max: 51, title: '传奇' },
] as const;

/** 根据等级返回中文称号 */
export function getLevelTitle(level: number): string {
  for (const { min, max, title } of LEVEL_TITLES) {
    if (level >= min && level <= max) return title;
  }
  return '传奇';
}

/** 掷一次经验值（服务端调用）。50 + random(0~20)。 */
export function rollXp(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return XP_BASE + (array[0] % (XP_RANDOM_MAX + 1));
}
