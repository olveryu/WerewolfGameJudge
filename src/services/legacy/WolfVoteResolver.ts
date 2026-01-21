/**
 * WolfVoteResolver - Pure function for resolving wolf voting results
 *
 * Step 8: Extract from GameStateService.calculateWolfKillTarget()
 *
 * Rules:
 * - Unanimous: All wolves vote for same target → that target
 * - Majority: Target with most votes wins → that target
 * - Tie: Multiple targets have equal highest votes → null (空刀)
 * - All abstain: All wolves abstain (-1) → null (空刀)
 *
 * @param votes Map<number, number> - wolf seat → target seat (-1 = abstain)
 * @returns number | null - target seat or null for 空刀
 */
export function resolveWolfVotes(votes: Map<number, number>): number | null {
  // Filter out abstentions (-1)
  const validVotes: number[] = [];
  for (const target of votes.values()) {
    if (target !== -1) {
      validVotes.push(target);
    }
  }

  // All abstain → 空刀
  if (validVotes.length === 0) {
    return null;
  }

  // Count votes for each target
  const voteCount = new Map<number, number>();
  for (const target of validVotes) {
    voteCount.set(target, (voteCount.get(target) || 0) + 1);
  }

  // Find maximum vote count
  let maxCount = 0;
  for (const count of voteCount.values()) {
    if (count > maxCount) {
      maxCount = count;
    }
  }

  // Find all targets with maximum votes
  const topTargets: number[] = [];
  for (const [target, count] of voteCount.entries()) {
    if (count === maxCount) {
      topTargets.push(target);
    }
  }

  // Tie → 空刀
  if (topTargets.length > 1) {
    return null;
  }

  // Single winner (unanimous or majority)
  return topTargets[0];
}
