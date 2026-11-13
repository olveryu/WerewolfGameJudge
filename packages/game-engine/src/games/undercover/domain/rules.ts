/** Pure Undercover configuration and victory rules; no IO or state mutation. */

export const UNDERCOVER_MIN_PLAYERS = 4;
export const UNDERCOVER_MAX_PLAYERS = 12;
export const UNDERCOVER_DEFAULT_PLAYERS = 8;
export const UNDERCOVER_BLANK_MIN_PLAYERS = 6;
/** 白板独赢的存活总人数：白板加最后一名对手。 */
export const UNDERCOVER_BLANK_WIN_TOTAL_SURVIVORS = 2;

export const UNDERCOVER_ROLES = ['civilian', 'undercover', 'blank'] as const;
export type UndercoverRole = (typeof UNDERCOVER_ROLES)[number];

/** Single source of the role display names (Chinese), shared by every client surface. */
export const UNDERCOVER_ROLE_NAMES: Readonly<Record<UndercoverRole, string>> = {
  civilian: '平民',
  undercover: '卧底',
  blank: '白板',
};

export interface UndercoverRoleCounts {
  readonly civilian: number;
  readonly undercover: number;
  readonly blank: number;
}

export interface UndercoverTier {
  /** 该档覆盖的最多人数（含）。 */
  readonly maxPlayers: number;
  /** 该档的卧底数。 */
  readonly undercover: number;
}

/**
 * 卧底数分档表：分档规则的唯一来源。`getUndercoverRoleCounts` 查表实现，
 * 玩法屏从同一张表渲染人数配置，阈值只活在这里。
 */
export const UNDERCOVER_TIERS: readonly UndercoverTier[] = [
  { maxPlayers: 6, undercover: 1 },
  { maxPlayers: 9, undercover: 2 },
  { maxPlayers: UNDERCOVER_MAX_PLAYERS, undercover: 3 },
];

/** Returns the configured distribution, rejecting invalid room sizes or blank mode. */
export function getUndercoverRoleCounts(
  numberOfPlayers: number,
  hasBlank: boolean,
): UndercoverRoleCounts {
  if (
    !Number.isSafeInteger(numberOfPlayers) ||
    numberOfPlayers < UNDERCOVER_MIN_PLAYERS ||
    numberOfPlayers > UNDERCOVER_MAX_PLAYERS ||
    (hasBlank && numberOfPlayers < UNDERCOVER_BLANK_MIN_PLAYERS)
  ) {
    throw new Error('Invalid Undercover player configuration');
  }
  const tier = UNDERCOVER_TIERS.find((candidate) => numberOfPlayers <= candidate.maxPlayers);
  if (tier === undefined) {
    throw new Error('Invalid Undercover player configuration');
  }
  const undercover = tier.undercover;
  const blank = hasBlank ? 1 : 0;
  return { civilian: numberOfPlayers - undercover - blank, undercover, blank };
}

/** Determines victory from surviving roles, with a living blank taking priority. */
export function getUndercoverWinner(roles: readonly UndercoverRole[]): UndercoverRole | null {
  if (roles.length < 2) throw new Error('Undercover requires at least two survivors');
  const counts = { civilian: 0, undercover: 0, blank: 0 };
  for (const role of roles) counts[role] += 1;
  if (counts.blank > 1) throw new Error('Undercover supports at most one blank');
  if (counts.blank === 1) {
    return roles.length === UNDERCOVER_BLANK_WIN_TOTAL_SURVIVORS ? 'blank' : null;
  }
  if (counts.undercover === 0) return 'civilian';
  return counts.undercover >= counts.civilian ? 'undercover' : null;
}
