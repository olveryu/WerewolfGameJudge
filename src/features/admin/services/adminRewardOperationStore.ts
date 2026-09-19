/** Persist confirmed grants until their authoritative outcome is known; never stores credentials. */
import { ADMIN_REWARD_OPERATION_KEY } from '@/config/storageKeys';
import { type AdminRewardInput, adminRewardInputSchema } from '@/features/admin/model/adminRewards';
import { storage } from '@/services/infra/localStorage';

/** Restore an unresolved grant for exactly one recipient. */
export function readAdminRewardOperation(userId: string): AdminRewardInput | null {
  const value = storage.getString(`${ADMIN_REWARD_OPERATION_KEY}:${userId}`);
  return value === undefined ? null : adminRewardInputSchema.parse(JSON.parse(value));
}

/** Persist before sending so reloads cannot turn a retry into a new grant. */
export function writeAdminRewardOperation(userId: string, input: AdminRewardInput): void {
  storage.set(
    `${ADMIN_REWARD_OPERATION_KEY}:${userId}`,
    JSON.stringify(adminRewardInputSchema.parse(input)),
  );
}

/** Remove only after a successful grant or a definitive rejection. */
export function clearAdminRewardOperation(userId: string): void {
  storage.remove(`${ADMIN_REWARD_OPERATION_KEY}:${userId}`);
}
