/**
 * GameStatus - Game status enum
 *
 * Defines all phases of the game lifecycle: unseated → seated → assigned → ready → ongoing → ended.
 * Contains only enum value definitions. No service dependency, no side effects or business logic.
 */

// =============================================================================
// Game Status Enum
// =============================================================================

export enum GameStatus {
  Unseated = 'Unseated', // Waiting for players to join
  Seated = 'Seated', // All seats filled, waiting for host to assign roles
  Assigned = 'Assigned', // Roles assigned, players viewing their cards
  Ready = 'Ready', // All players have viewed cards, ready to start
  Ongoing = 'Ongoing', // Night phase in progress
  /**
   * Night-1 complete (results ready).
   *
   * IMPORTANT: This app does not decide winners. "ended" only means the app's
   * Night-1 flow is complete and players can view the summary/deaths.
   */
  Ended = 'Ended',
}
