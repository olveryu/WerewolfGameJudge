// =============================================================================
// Game Status Enum
// =============================================================================

export enum GameStatus {
  unseated = 'unseated', // Waiting for players to join
  seated = 'seated', // All seats filled, waiting for host to assign roles
  assigned = 'assigned', // Roles assigned, players viewing their cards
  ready = 'ready', // All players have viewed cards, ready to start
  ongoing = 'ongoing', // Night phase in progress
  /**
   * Night-1 complete (results ready).
   *
   * IMPORTANT: This app does not decide winners. "ended" only means the app's
   * Night-1 flow is complete and players can view the summary/deaths.
   */
  ended = 'ended',
}
