/**
 * Storage - AsyncStorage 持久化层 (完整实现)
 *
 * 职责：
 * - 游戏状态序列化/反序列化 (处理 Map 类型)
 * - AsyncStorage 读写
 * - 状态过期检查 (24 小时)
 *
 * 不做的事：
 * - 业务逻辑
 * - 状态管理
 * - 消息处理
 *
 * 这是 Host-only 功能。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { hostLog } from '../../../utils/logger';
import type { LocalGameState } from '../types/GameState';

const log = hostLog;

// =============================================================================
// Constants
// =============================================================================

/** Storage key prefix for game state */
const STORAGE_KEY_PREFIX = 'werewolf_game_state_';

/** State expiry time - 24 hours (matches Supabase room cleanup) */
const STATE_EXPIRY_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// Types
// =============================================================================

/** Serialized state format in AsyncStorage */
interface SerializedState {
  players: [number, LocalGameState['players'] extends Map<number, infer V> ? V : never][];
  actions: [string, LocalGameState['actions'] extends Map<string, infer V> ? V : never][];
  wolfVotes: [number, number][];
  _savedAt: number;
  [key: string]: unknown;
}

/** Result of deserializing state */
interface DeserializeResult {
  state: LocalGameState;
  savedAt: number;
}

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

  private readonly expiryMs: number;
  private readonly keyPrefix: string;

  private constructor(config: StorageConfig = {}) {
    this.expiryMs = config.expiryMs ?? STATE_EXPIRY_MS;
    this.keyPrefix = config.keyPrefix ?? STORAGE_KEY_PREFIX;
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
    try {
      const key = this.getStorageKey(roomCode);
      const serialized = this.serializeState(state);
      await AsyncStorage.setItem(key, serialized);
      log.debug('State saved to storage for room:', roomCode);
      return true;
    } catch (err) {
      log.error('Failed to save state to storage:', err);
      return false;
    }
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
    try {
      const key = this.getStorageKey(roomCode);
      const json = await AsyncStorage.getItem(key);

      if (!json) {
        log.debug('No saved state found for room:', roomCode);
        return null;
      }

      const result = this.deserializeState(json);
      if (!result) {
        log.warn('Failed to deserialize state for room:', roomCode);
        return null;
      }

      const { state, savedAt } = result;
      const age = Date.now() - savedAt;

      // Check if state is expired
      if (age > this.expiryMs) {
        log.warn('Saved state expired, discarding. Age:', Math.round(age / 1000 / 60), 'minutes');
        await this.clear(roomCode);
        return null;
      }

      log.info('Loaded state from storage. Age:', Math.round(age / 1000), 'seconds');
      return state;
    } catch (err) {
      log.error('Failed to load state from storage:', err);
      return null;
    }
  }

  /**
   * Clear saved state for a room
   *
   * @param roomCode - Room code to clear
   */
  async clear(roomCode: string): Promise<void> {
    try {
      const key = this.getStorageKey(roomCode);
      await AsyncStorage.removeItem(key);
      log.debug('Cleared saved state for room:', roomCode);
    } catch (err) {
      log.error('Failed to clear saved state:', err);
    }
  }

  /**
   * Check if state exists for a room
   *
   * Note: This does NOT check if state is expired
   *
   * @param roomCode - Room code to check
   * @returns true if state exists (may be expired)
   */
  async exists(roomCode: string): Promise<boolean> {
    try {
      const key = this.getStorageKey(roomCode);
      const value = await AsyncStorage.getItem(key);
      return value !== null;
    } catch (err) {
      log.error('Failed to check state existence:', err);
      return false;
    }
  }

  /**
   * Get age of saved state
   *
   * @param roomCode - Room code to check
   * @returns Age in milliseconds, or null if no state
   */
  async getAge(roomCode: string): Promise<number | null> {
    try {
      const key = this.getStorageKey(roomCode);
      const json = await AsyncStorage.getItem(key);

      if (!json) return null;

      const result = this.deserializeState(json);
      if (!result) return null;

      return Date.now() - result.savedAt;
    } catch (err) {
      log.error('Failed to get state age:', err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Serialization (private)
  // ---------------------------------------------------------------------------

  /**
   * Serialize LocalGameState to JSON string
   *
   * Maps need special handling since JSON.stringify doesn't support them directly.
   * We convert Maps to arrays of [key, value] pairs.
   */
  private serializeState(state: LocalGameState): string {
    const serializable: SerializedState = {
      ...state,
      players: Array.from(state.players.entries()),
      actions: Array.from(state.actions.entries()),
      wolfVotes: Array.from(state.wolfVotes.entries()),
      _savedAt: Date.now(),
    };
    return JSON.stringify(serializable);
  }

  /**
   * Deserialize JSON string back to LocalGameState
   *
   * Reconstructs Maps from array format.
   * Returns null if deserialization fails.
   */
  private deserializeState(json: string): DeserializeResult | null {
    try {
      const parsed = JSON.parse(json) as SerializedState;
      const savedAt = parsed._savedAt || 0;

      // Remove internal fields
      const { _savedAt: _, ...rest } = parsed;

      // Reconstruct the state with Maps
      const state: LocalGameState = {
        ...rest,
        players: new Map(parsed.players),
        actions: new Map(parsed.actions),
        wolfVotes: new Map(parsed.wolfVotes),
      } as LocalGameState;

      return { state, savedAt };
    } catch (err) {
      log.error('Failed to deserialize state:', err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Get storage key for a room code
   */
  private getStorageKey(roomCode: string): string {
    return `${this.keyPrefix}${roomCode}`;
  }
}

export default Storage;
