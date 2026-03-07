/**
 * INightActionFacade — Player night-action submission
 *
 * Covers player-side action APIs: viewed role confirmation, action submit,
 * reveal ACK, group confirm ACK, and wolfRobot hunter status confirmation.
 * Does not include Host-only game control, seating, or sync.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

export interface INightActionFacade {
  markViewedRole(seat: number): Promise<{ success: boolean; reason?: string }>;
  submitAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<{ success: boolean; reason?: string }>;
  submitRevealAck(): Promise<{ success: boolean; reason?: string }>;
  submitGroupConfirmAck(seat: number): Promise<{ success: boolean; reason?: string }>;
  sendWolfRobotHunterStatusViewed(seat: number): Promise<{ success: boolean; reason?: string }>;
}
