/**
 * useRecentRoles - 最近查看 & 收藏管理
 *
 * 最近查看：内存 state，最多保留 MAX_RECENT 个，退出页面后重置。
 * 收藏：AsyncStorage 持久化。
 * 纯 Hook，不含 UI 渲染。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { isValidRoleId } from '@werewolf/game-engine/models/roles';
import { useCallback, useEffect, useState } from 'react';

const FAVORITES_KEY = 'encyclopedia_favorites';
const MAX_RECENT = 5;

export function useRecentRoles() {
  const [recent, setRecent] = useState<RoleId[]>([]);
  const [favorites, setFavorites] = useState<RoleId[]>([]);

  // 启动时从 AsyncStorage 加载收藏列表
  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setFavorites(
            parsed.filter((id): id is RoleId => typeof id === 'string' && isValidRoleId(id)),
          );
        }
      } catch {
        // corrupt data — ignore
      }
    });
  }, []);

  const addRecent = useCallback((roleId: RoleId) => {
    setRecent((prev) => {
      const filtered = prev.filter((id) => id !== roleId);
      return [roleId, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  const toggleFavorite = useCallback((roleId: RoleId) => {
    setFavorites((prev) => {
      const isFav = prev.includes(roleId);
      const next = isFav ? prev.filter((id) => id !== roleId) : [...prev, roleId];
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback((roleId: RoleId) => favorites.includes(roleId), [favorites]);

  return { recent, favorites, addRecent, toggleFavorite, isFavorite };
}
