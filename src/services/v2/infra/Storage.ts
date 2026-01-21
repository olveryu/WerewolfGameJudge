/**
 * Storage - AsyncStorage 持久化抽象层
 *
 * 职责：
 * - 游戏状态序列化/反序列化
 * - AsyncStorage 读写
 * - 状态过期检查
 *
 * 不做的事：
 * - 业务逻辑
 * - 状态管理
 * - 消息处理
 *
 * Note: This is a thin wrapper around legacy/persistence/StatePersistence
 * until we fully migrate. The API is designed for v2 architecture.
 */

import { StatePersistence } from '../../core/persistence/StatePersistence';
import type { LocalGameState } from '../types/GameState';

// =============================================================================
// Types
// =============================================================================

/** Storage configuration options */
export interface StorageConfig {
  /** State expiry time in milliseconds (default: 24 hours) */
  expiryMs?: number;
  /** Storage key prefix */
  keyPrefix?: string;
}

// =============================================================================
// Storage Implementation
// =============================================================================

export class Storage {
  private static instance: Storage;
  private readonly persistence: StatePersistence;

  private constructor(config: StorageConfig = {}) {
    this.persistence = new StatePersistence({
      expiryMs: config.expiryMs,
      keyPrefix: config.keyPrefix,
    });
  }

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  static getInstance(): Storage {
    if (!Storage.instance) {
      Storage.instance = new Storage();
    }
    return Storage.instance;
  }

  /** Create instance with custom config (for testing) */
  static createInstance(config: StorageConfig): Storage {
    return new Storage(config);
  }

  /** Reset singleton for testing */
  static resetInstance(): void {
    Storage.instance = undefined as unknown as Storage;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Save game state to storage
   *
   * @param roomCode - Room code as key
   * @param state - LocalGameState to save
   * @returns true if successful
   */
  async save(roomCode: string, state: LocalGameState): Promise<boolean> {
    return this.persistence.saveState(roomCode, state);
  }

  /**
   * Load game state from storage
   *
   * Returns null if:
   * - No state found
   * - State expired
   * - Deserialization failed
   *
   * @param roomCode - Room code to load
   * @returns LocalGameState or null
   */
  async load(roomCode: string): Promise<LocalGameState | null> {
    return this.persistence.loadState(roomCode);
  }

  /**
   * Clear saved state for a room
   *
   * @param roomCode - Room code to clear
   */
  async clear(roomCode: string): Promise<void> {
    return this.persistence.clearState(roomCode);
  }

  /**
   * Check if state exists for a room
   *
   * @param roomCode - Room code to check
   * @returns true if state exists (may be expired)
   */
  async exists(roomCode: string): Promise<boolean> {
    return this.persistence.hasState(roomCode);
  }

  /**
   * Get age of saved state
   *
   * @param roomCode - Room code to check
   * @returns Age in milliseconds, or null if no state
   */
  async getAge(roomCode: string): Promise<number | null> {
    return this.persistence.getStateAge(roomCode);
  }
}

export default Storage;
