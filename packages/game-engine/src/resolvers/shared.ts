/**
 * Shared Resolver Utilities — DRY extractions
 *
 * Provides common constants, eliminating duplicated logic across resolvers.
 * Contains only pure functions and constants; no IO.
 */

/**
 * Invert a Seer check result: '好人' → '狼人', '狼人' → '好人'
 *
 * Used by both mirrorSeer (fixed inversion) and drunkSeer (random inversion).
 */
export function invertCheckResult(result: '好人' | '狼人'): '好人' | '狼人' {
  return result === '好人' ? '狼人' : '好人';
}
