/**
 * resolveWolfVotes - Pure function for resolving wolf voting results
 *
 * @param votes - Map of wolf seat → target seat (-1 = abstain)
 * @param options.requireUnanimity - When true, all non-abstain votes must target
 *   the same seat; any disagreement results in no kill. Used when cupid is in the template.
 */
export function resolveWolfVotes(
  votes: Map<number, number>,
  options?: { requireUnanimity?: boolean },
): number | null {
  // Convention in this codebase: -1 means “abstain / no-kill”.
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

  // Find max vote count and whether it’s unique.
  let maxCount = 0;
  let maxTarget: number | null = null;
  let maxCountTargets = 0;

  for (const [target, count] of voteCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      maxTarget = target;
      maxCountTargets = 1;
    } else if (count === maxCount) {
      maxCountTargets += 1;
    }
  }

  // Tie => no kill.
  if (maxCountTargets !== 1 || maxTarget === null) {
    return null;
  }

  // Unanimity mode (cupid board): ALL non-abstain votes must be the same target.
  if (options?.requireUnanimity) {
    return maxCount === nonAbstainVotes.length ? maxTarget : null;
  }

  // Require strict majority among *non-abstain* votes.
  // Example: [0] => majority (1/1) => kill 0.
  // Example: [0, 1] => tie (1/2) => null.
  // Example: [0, 0, 1] => majority (2/3) => kill 0.
  if (maxCount <= nonAbstainVotes.length / 2) {
    return null;
  }

  return maxTarget;
}
