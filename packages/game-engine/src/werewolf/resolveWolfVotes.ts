/**
 * resolveWolfVotes - Pure function for resolving wolf voting results
 *
 * @param votes - Map of wolf seat → target seat (-1 = abstain)
 * @param options.requireUnanimity - When true, all non-abstain votes must target
 *   the same seat; any disagreement results in no kill. Used when cupid is in the template.
 * @param options.rng - Optional random number generator for tie-breaking (testing).
 */

import { randomPick, type Rng, secureRng } from '../utils/random';

export function resolveWolfVotes(
  votes: Map<number, number>,
  options?: { requireUnanimity?: boolean; rng?: Rng },
): number | null {
  // Convention in this codebase: -1 means "abstain / no-kill".
  // It should not participate in majority/tie calculations.
  const nonAbstainVotes = Array.from(votes.values()).filter((v) => v !== -1);

  // No one voted a real target => no kill.
  if (nonAbstainVotes.length === 0) {
    return null;
  }

  // Count votes for each target.
  const voteCounts = new Map<number, number>();
  for (const target of nonAbstainVotes) {
    voteCounts.set(target, (voteCounts.get(target) ?? 0) + 1);
  }

  // Find max vote count and collect all targets with that count.
  let maxCount = 0;
  let maxTargets: number[] = [];

  for (const [target, count] of voteCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      maxTargets = [target];
    } else if (count === maxCount) {
      maxTargets.push(target);
    }
  }

  if (maxTargets.length === 0) {
    return null;
  }

  // Unanimity mode (cupid board): ALL non-abstain votes must be the same target.
  // Tie or disagreement => no kill.
  if (options?.requireUnanimity) {
    if (maxTargets.length !== 1) return null;
    return maxCount === nonAbstainVotes.length ? maxTargets[0]! : null;
  }

  // Normal mode: plurality wins. On tie, randomly pick one from tied targets.
  if (maxTargets.length === 1) {
    return maxTargets[0]!;
  }
  const rng = options?.rng ?? secureRng;
  return randomPick(maxTargets, rng);
}
