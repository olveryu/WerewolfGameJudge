/** Pure Undercover configuration and victory rules; no IO or state mutation. */

export const UNDERCOVER_MIN_PLAYERS = 4;
export const UNDERCOVER_MAX_PLAYERS = 12;
export const UNDERCOVER_DEFAULT_PLAYERS = 8;
export const UNDERCOVER_BLANK_MIN_PLAYERS = 6;

export type UndercoverRole = 'civilian' | 'undercover' | 'blank';

export interface UndercoverRoleCounts {
  readonly civilian: number;
  readonly undercover: number;
  readonly blank: number;
}

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
  const undercover = numberOfPlayers <= 6 ? 1 : numberOfPlayers <= 9 ? 2 : 3;
  const blank = hasBlank ? 1 : 0;
  return { civilian: numberOfPlayers - undercover - blank, undercover, blank };
}

/** Determines victory from surviving roles, with a living blank taking priority. */
export function getUndercoverWinner(roles: readonly UndercoverRole[]): UndercoverRole | null {
  if (roles.length < 2) throw new Error('Undercover requires at least two survivors');
  const counts = { civilian: 0, undercover: 0, blank: 0 };
  for (const role of roles) counts[role] += 1;
  if (counts.blank > 1) throw new Error('Undercover supports at most one blank');
  if (counts.blank === 1) return roles.length === 2 ? 'blank' : null;
  if (counts.undercover === 0) return 'civilian';
  return counts.undercover >= counts.civilian ? 'undercover' : null;
}
