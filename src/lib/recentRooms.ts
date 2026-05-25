/**
 * recentRooms — 最近房间号管理（MMKV 本地存储）
 *
 * 维护最多 MAX_RECENT_ROOMS 个房间号，最新在前，去重。
 */

import { RECENT_ROOM_CODES_KEY } from '@/config/storageKeys';
import { storage } from '@/lib/storage';

const MAX_RECENT_ROOMS = 5;

/** 读取本地存储的最近房间号列表（最新在前）。 */
export function getRecentRooms(): string[] {
  const raw = storage.getString(RECENT_ROOM_CODES_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as string[];
}

/**
 * 将房间号添加到最近列表首位，去重并截断至 MAX_RECENT_ROOMS。
 *
 * @param roomCode - 房间号
 */
export function addRecentRoom(roomCode: string): void {
  const list = getRecentRooms().filter((c) => c !== roomCode);
  list.unshift(roomCode);
  if (list.length > MAX_RECENT_ROOMS) list.length = MAX_RECENT_ROOMS;
  storage.set(RECENT_ROOM_CODES_KEY, JSON.stringify(list));
}

/**
 * 从最近列表中移除指定房间号。
 *
 * @param roomCode - 要移除的房间号
 */
export function removeRecentRoom(roomCode: string): void {
  const list = getRecentRooms().filter((c) => c !== roomCode);
  storage.set(RECENT_ROOM_CODES_KEY, JSON.stringify(list));
}

/** 清空所有最近房间记录。 */
export function clearRecentRooms(): void {
  storage.remove(RECENT_ROOM_CODES_KEY);
}
