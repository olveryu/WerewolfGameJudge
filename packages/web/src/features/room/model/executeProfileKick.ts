/**
 * Shared kick-seat execution with capability checking.
 *
 * All games must use this instead of hand-writing the isAllowed check.
 * Behavior (aligned to Werewolf):
 * - No selection → throw
 * - Not allowed → throw with reason
 * - Allowed → execute(seat)
 */

import type { RoomCapabilities } from './RoomCapabilities';

interface ProfileSelection {
  readonly target: { readonly seat: number | null };
}

export function executeProfileKick(
  capabilities: Pick<RoomCapabilities, 'canKickSeat'>,
  selection: ProfileSelection | null,
): void {
  if (selection === null) {
    throw new Error('Cannot kick without an open profile');
  }
  if (selection.target.seat === null) {
    throw new Error('Cannot kick a seatless profile from a numbered seat');
  }
  const capability = capabilities.canKickSeat;
  if (!capability.isAllowed) {
    throw new Error(`Cannot kick from profile: ${capability.reason}`);
  }
  capability.execute(selection.target.seat);
}
