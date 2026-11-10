/**
 * DailyRewardHost — claims the daily login reward for the signed-in account. Renders nothing;
 * AppRoot loads it lazily so the claim stays off the start-up chunk.
 */
import { useAutoClaimDailyReward } from './queries/useAutoClaimDailyReward';

export function DailyRewardHost() {
  useAutoClaimDailyReward();
  return null;
}
