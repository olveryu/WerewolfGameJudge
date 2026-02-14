/**
 * HostStateCache - Host 状态本地缓存（仅用于 Host rejoin 恢复）
 *
 * 职责：
 * - Host 端本地持久化最后一次 BroadcastGameState + revision
 * - 用于 Host 断线重连后恢复其权威状态
 *
 * ✅ 允许：AsyncStorage 读写 + 结构校验 + cache key 防误命中
 * ❌ 禁止：作为权威存储使用（这只是 Host 本地缓存，DB 中也有 state 备份供 Player 读取）
 * ❌ 禁止：Player 端使用
 *
 * 防误命中策略：
 * - cache key = roomCode:hostUid（防止 roomCode 复用）
 * - 结构校验：缺字段 / 类型不对 → removeItem + return null
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BroadcastGameState } from '@/services/protocol/types';
import { log } from '@/utils/logger';

const hostCacheLog = log.extend('HostStateCache');

const CACHE_KEY_PREFIX = 'host_state_cache_';

/** Cache 版本号，结构变更时递增 */
const CACHE_VERSION = 1;

export interface CachedHostState {
  /** Cache 版本号，用于结构迁移 */
  version: number;
  state: BroadcastGameState;
  revision: number;
  cachedAt: number; // timestamp
}

/**
 * 缓存过期时间（毫秒）
 * 默认 24 小时 — 与 GitHub Actions cleanup-rooms.yml 的清理周期对齐。
 * 房间记录 24h 后被自动删除，缓存无需比房间活得更短。
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 结构校验：验证 cached 对象是否包含所有必需字段且类型正确
 */
function isValidCachedState(cached: unknown): cached is CachedHostState {
  if (typeof cached !== 'object' || cached === null) return false;
  const obj = cached as Record<string, unknown>;

  // 必需字段类型检查
  if (typeof obj.version !== 'number') return false;
  if (typeof obj.revision !== 'number') return false;
  if (typeof obj.cachedAt !== 'number') return false;
  if (typeof obj.state !== 'object' || obj.state === null) return false;

  // state 内部必需字段检查
  const state = obj.state as Record<string, unknown>;
  if (typeof state.roomCode !== 'string') return false;
  if (typeof state.hostUid !== 'string') return false;
  if (typeof state.status !== 'string') return false;

  return true;
}

export class HostStateCache {
  /**
   * 生成 cache key：roomCode:hostUid
   * 防止 roomCode 复用时误命中旧 Host 的缓存
   */
  private getCacheKey(roomCode: string, hostUid: string): string {
    return `${CACHE_KEY_PREFIX}${roomCode}:${hostUid}`;
  }

  /**
   * 保存 Host 状态到本地缓存
   */
  async saveState(
    roomCode: string,
    hostUid: string,
    state: BroadcastGameState,
    revision: number,
  ): Promise<void> {
    try {
      const cached: CachedHostState = {
        version: CACHE_VERSION,
        state,
        revision,
        cachedAt: Date.now(),
      };
      await AsyncStorage.setItem(this.getCacheKey(roomCode, hostUid), JSON.stringify(cached));
      hostCacheLog.debug('Saved host state cache', { roomCode, hostUid, revision });
    } catch (err) {
      hostCacheLog.error('Failed to save host state cache', err);
    }
  }

  /**
   * 加载 Host 状态缓存
   * 返回 null 如果：缓存不存在、已过期、结构校验失败
   */
  async loadState(roomCode: string, hostUid: string): Promise<CachedHostState | null> {
    const cacheKey = this.getCacheKey(roomCode, hostUid);
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (!raw) {
        hostCacheLog.debug('No host state cache found', { roomCode, hostUid });
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        hostCacheLog.warn('Host state cache has invalid JSON, removing', { roomCode, hostUid });
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      // 结构校验
      if (!isValidCachedState(parsed)) {
        hostCacheLog.warn('Host state cache failed structure validation, removing', {
          roomCode,
          hostUid,
        });
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      const cached = parsed;

      // 版本检查
      if (cached.version !== CACHE_VERSION) {
        hostCacheLog.warn('Host state cache version mismatch, removing', {
          roomCode,
          hostUid,
          cachedVersion: cached.version,
          expectedVersion: CACHE_VERSION,
        });
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      // 检查过期
      if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
        hostCacheLog.debug('Host state cache expired', {
          roomCode,
          hostUid,
          cachedAt: cached.cachedAt,
          ttl: CACHE_TTL_MS,
        });
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      // 二次校验：缓存内的 roomCode/hostUid 必须匹配请求参数
      if (cached.state.roomCode !== roomCode || cached.state.hostUid !== hostUid) {
        hostCacheLog.warn('Host state cache roomCode/hostUid mismatch, removing', {
          requestedRoomCode: roomCode,
          requestedHostUid: hostUid,
          cachedRoomCode: cached.state.roomCode,
          cachedHostUid: cached.state.hostUid,
        });
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      hostCacheLog.debug('Loaded host state cache', {
        roomCode,
        hostUid,
        revision: cached.revision,
      });
      return cached;
    } catch (err) {
      hostCacheLog.error('Failed to load host state cache', err);
      return null;
    }
  }

  /**
   * 清除 Host 状态缓存
   */
  async clearState(roomCode: string, hostUid: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.getCacheKey(roomCode, hostUid));
      hostCacheLog.debug('Cleared host state cache', { roomCode, hostUid });
    } catch (err) {
      hostCacheLog.error('Failed to clear host state cache', err);
    }
  }
}
