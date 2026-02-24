/**
 * GameStatus - 游戏状态枚举
 *
 * 定义游戏生命周期的所有阶段：unseated → seated → assigned → ready → ongoing → ended。
 * 仅包含枚举值定义，不依赖 service、不含副作用或业务逻辑。
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
