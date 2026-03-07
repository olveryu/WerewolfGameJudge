/**
 * ILifecycleFacade — Room lifecycle, identity, and state subscription
 *
 * Covers room creation / join / leave, user identity queries,
 * and state subscription APIs. Does not include seating, game control,
 * night actions, or sync/connection management.
 */

import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { FacadeStateListener } from '../IGameFacade';

export interface ILifecycleFacade {
  // === Subscriptions ===
  addListener(fn: FacadeStateListener): () => void;
  getState(): GameState | null;
  subscribe(onStoreChange: () => void): () => void;

  // === Identity ===
  isHostPlayer(): boolean;
  getMyUid(): string | null;
  getMySeatNumber(): number | null;
  getStateRevision(): number;

  // === Room Lifecycle ===
  createRoom(roomCode: string, hostUid: string, template: GameTemplate): Promise<void>;
  joinRoom(
    roomCode: string,
    uid: string,
    isHost: boolean,
  ): Promise<{ success: boolean; reason?: string }>;
  leaveRoom(): Promise<void>;
}
