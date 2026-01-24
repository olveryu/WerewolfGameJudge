/**
 * HostStateCache - Host 状态本地缓存（仅用于 Host rejoin 恢复）
 *
 * 职责：
 * - Host 端本地持久化最后一次 BroadcastGameState + revision
 * - 用于 Host 断线重连后恢复其权威状态
 *
 * 注意：
 * - 这不是权威存储，只是本地缓存
 * - Supabase 不存储游戏状态
 * - 仅 Host 使用，Player 不需要
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BroadcastGameState } from '../protocol/types';
import { log } from '../../utils/logger';

const hostCacheLog = log.extend('HostStateCache');

const CACHE_KEY_PREFIX = 'host_state_cache_';

export interface CachedHostState {
  state: BroadcastGameState;
  revision: number;
  cachedAt: number; // timestamp
}

/**
 * 缓存过期时间（毫秒）
 * 默认 2 小时 - 超过此时间的缓存视为无效
 */
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

export class HostStateCache {
  private static instance: HostStateCache | null = null;

  static getInstance(): HostStateCache {
    HostStateCache.instance ??= new HostStateCache();
    return HostStateCache.instance;
  }

  /** 测试隔离：重置 instance */
  static resetInstance(): void {
    HostStateCache.instance = null;
  }

  private getCacheKey(roomCode: string): string {
    return `${CACHE_KEY_PREFIX}${roomCode}`;
  }

  /**
   * 保存 Host 状态到本地缓存
   */
  async saveState(roomCode: string, state: BroadcastGameState, revision: number): Promise<void> {
    try {
      const cached: CachedHostState = {
        state,
        revision,
        cachedAt: Date.now(),
      };
      await AsyncStorage.setItem(this.getCacheKey(roomCode), JSON.stringify(cached));
      hostCacheLog.debug('Saved host state cache', { roomCode, revision });
    } catch (err) {
      hostCacheLog.error('Failed to save host state cache', err);
    }
  }

  /**
   * 加载 Host 状态缓存
   * 返回 null 如果：缓存不存在、已过期、或解析失败
   */
  async loadState(roomCode: string): Promise<CachedHostState | null> {
    try {
      const raw = await AsyncStorage.getItem(this.getCacheKey(roomCode));
      if (!raw) {
        hostCacheLog.debug('No host state cache found', { roomCode });
        return null;
      }

      const cached: CachedHostState = JSON.parse(raw);

      // 检查过期
      if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
        hostCacheLog.debug('Host state cache expired', {
          roomCode,
          cachedAt: cached.cachedAt,
          ttl: CACHE_TTL_MS,
        });
        await this.clearState(roomCode);
        return null;
      }

      hostCacheLog.debug('Loaded host state cache', { roomCode, revision: cached.revision });
      return cached;
    } catch (err) {
      hostCacheLog.error('Failed to load host state cache', err);
      return null;
    }
  }

  /**
   * 清除 Host 状态缓存
   */
  async clearState(roomCode: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.getCacheKey(roomCode));
      hostCacheLog.debug('Cleared host state cache', { roomCode });
    } catch (err) {
      hostCacheLog.error('Failed to clear host state cache', err);
    }
  }
}
