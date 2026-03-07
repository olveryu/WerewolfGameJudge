/**
 * IGameControlFacade — Host-only game control, debug, and night flow orchestration
 *
 * Covers role assignment, template updates, night start/end, audio state,
 * progression, debug bot management, and sharing. All methods are Host-only
 * (enforced by server, not by this interface).
 * Does not include room lifecycle, seating, player actions, or sync.
 */

import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';

export interface IGameControlFacade {
  // === Game Setup ===
  assignRoles(): Promise<{ success: boolean; reason?: string }>;
  updateTemplate(template: GameTemplate): Promise<{ success: boolean; reason?: string }>;
  setRoleRevealAnimation(
    animation: RoleRevealAnimation,
  ): Promise<{ success: boolean; reason?: string }>;
  startNight(): Promise<{ success: boolean; reason?: string }>;
  restartGame(): Promise<{ success: boolean; reason?: string }>;

  // === Debug Mode ===
  fillWithBots(): Promise<{ success: boolean; reason?: string }>;
  markAllBotsViewed(): Promise<{ success: boolean; reason?: string }>;
  clearAllSeats(): Promise<{ success: boolean; reason?: string }>;
  shareNightReview(allowedSeats: number[]): Promise<{ success: boolean; reason?: string }>;

  // === Night Flow (Host-only) ===
  endNight(): Promise<{ success: boolean; reason?: string }>;
  setAudioPlaying(isPlaying: boolean): Promise<{ success: boolean; reason?: string }>;
  postProgression(): Promise<{ success: boolean; reason?: string }>;
}
