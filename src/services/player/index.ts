/**
 * Player module exports
 *
 * PlayerCoordinator handles all Player-specific game logic including:
 * - Handling Host broadcasts
 * - Player actions (submit, vote, ACK)
 * - Seat management
 * - State synchronization
 */

export { PlayerCoordinator, type PlayerCoordinatorConfig } from './PlayerCoordinator';
