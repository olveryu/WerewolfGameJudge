/**
 * resolveWolfVotes - Pure function for resolving wolf voting results
 */

export function resolveWolfVotes(votes: Map<number, number>): number | null {
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

  // Require strict majority among *non-abstain* votes.
  // Example: [0] => majority (1/1) => kill 0.
  // Example: [0, 1] => tie (1/2) => null.
  // Example: [0, 0, 1] => majority (2/3) => kill 0.
  if (maxCount <= nonAbstainVotes.length / 2) {
    return null;
  }

  return maxTarget;
}
