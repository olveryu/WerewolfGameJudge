/**
 * GameFacade - V2 Unified Game Service Facade
 *
 * Phase 2: Thin wrapper delegating to legacy GameStateService
 * Phase 3: Will gradually replace with v2 engines
 *
 * This is the ONLY public API for game state management.
 * All external code should import from this facade.
 *
 * @see /docs/architecture/SERVICE_REWRITE_PLAN.md
 */

import { GameStateService } from '../../legacy/GameStateService';
import type { RoleId } from '../../../models/roles';
import type { GameTemplate } from '../../../models/Template';
import type { LocalGameState, GameStateListener } from '../types';

// Re-export types for external consumers
export type { LocalGameState, LocalPlayer, GameStateListener } from '../types';
export { GameStatus } from '../types';

/**
 * GameFacade - Unified game service facade
 *
 * Phase 2: Delegates all calls to legacy GameStateService
 */
export class GameFacade {
  private static instance: GameFacade;

  // Legacy service (will be replaced in Phase 3)
  private readonly legacy: GameStateService;

  private constructor() {
    this.legacy = GameStateService.getInstance();
  }

  static getInstance(): GameFacade {
    if (!GameFacade.instance) {
      GameFacade.instance = new GameFacade();
    }
    return GameFacade.instance;
  }

  /**
   * Reset singleton for testing
   * @internal
   */
  static resetForTesting(): void {
    GameFacade.instance = undefined as unknown as GameFacade;
  }

  // ===========================================================================
  // State Accessors
  // ===========================================================================

  getState(): LocalGameState | null {
    return this.legacy.getState();
  }

  isHostPlayer(): boolean {
    return this.legacy.isHostPlayer();
  }

  getMyUid(): string | null {
    return this.legacy.getMyUid();
  }

  getMySeatNumber(): number | null {
    return this.legacy.getMySeatNumber();
  }

  getMyRole(): RoleId | null {
    return this.legacy.getMyRole();
  }

  getLastSeatError(): { seat: number; reason: 'seat_taken' } | null {
    return this.legacy.getLastSeatError();
  }

  clearLastSeatError(): void {
    return this.legacy.clearLastSeatError();
  }

  getStateRevision(): number {
    return this.legacy.getStateRevision();
  }

  getLastNightInfo(): string {
    return this.legacy.getLastNightInfo();
  }

  // ===========================================================================
  // Listeners
  // ===========================================================================

  addListener(listener: GameStateListener): () => void {
    return this.legacy.addListener(listener);
  }

  // ===========================================================================
  // Host Operations
  // ===========================================================================

  async initializeAsHost(
    roomCode: string,
    hostUid: string,
    template: GameTemplate,
  ): Promise<void> {
    return this.legacy.initializeAsHost(roomCode, hostUid, template);
  }

  async rejoinAsHost(roomCode: string, hostUid: string): Promise<void> {
    return this.legacy.rejoinAsHost(roomCode, hostUid);
  }

  async assignRoles(): Promise<void> {
    return this.legacy.assignRoles();
  }

  async startGame(): Promise<void> {
    return this.legacy.startGame();
  }

  async restartGame(): Promise<boolean> {
    return this.legacy.restartGame();
  }

  async updateTemplate(newTemplate: GameTemplate): Promise<void> {
    return this.legacy.updateTemplate(newTemplate);
  }

  async clearSavedState(roomCode: string): Promise<void> {
    return this.legacy.clearSavedState(roomCode);
  }

  // ===========================================================================
  // Player Operations
  // ===========================================================================

  async joinAsPlayer(
    roomCode: string,
    playerUid: string,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<void> {
    return this.legacy.joinAsPlayer(roomCode, playerUid, displayName, avatarUrl);
  }

  async leaveRoom(): Promise<void> {
    return this.legacy.leaveRoom();
  }

  async takeSeat(
    seat: number,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<boolean> {
    return this.legacy.takeSeat(seat, displayName, avatarUrl);
  }

  async leaveSeat(): Promise<boolean> {
    return this.legacy.leaveSeat();
  }

  async takeSeatWithAck(
    seat: number,
    displayName?: string,
    avatarUrl?: string,
    timeoutMs?: number,
  ): Promise<{ success: boolean; reason?: string }> {
    return this.legacy.takeSeatWithAck(seat, displayName, avatarUrl, timeoutMs);
  }

  async leaveSeatWithAck(
    timeoutMs?: number,
  ): Promise<{ success: boolean; reason?: string }> {
    return this.legacy.leaveSeatWithAck(timeoutMs);
  }

  async requestSnapshot(timeoutMs?: number): Promise<boolean> {
    return this.legacy.requestSnapshot(timeoutMs);
  }

  async playerViewedRole(): Promise<void> {
    return this.legacy.playerViewedRole();
  }

  // ===========================================================================
  // Game Actions
  // ===========================================================================

  async submitAction(target: number | null, extra?: unknown): Promise<void> {
    return this.legacy.submitAction(target, extra);
  }

  async submitWolfVote(target: number): Promise<void> {
    return this.legacy.submitWolfVote(target);
  }

  async submitRevealAck(role: RoleId): Promise<void> {
    return this.legacy.submitRevealAck(role);
  }

  // ===========================================================================
  // Test Helpers (internal use only)
  // ===========================================================================

  /** @internal */
  __testGetLegacyService(): GameStateService {
    return this.legacy;
  }
}

export default GameFacade;
