/**
 * storageKeys - AsyncStorage key constants
 *
 * 所有跨文件使用的 AsyncStorage key 集中定义，禁止 hardcode 魔法字符串。
 * 纯常量模块，不包含业务逻辑或副作用。
 */

/** 上一次加入/创建的房间号（HomeScreen 回到上局 + signOut 清理） */
export const LAST_ROOM_NUMBER_KEY = 'lastRoomNumber';

// ── 新手引导 ─────────────────────────────────────────────────────────────

/** 新手引导 dismissed key 前缀 */
const GUIDE_DISMISSED_PREFIX = '@werewolf_guide_dismissed:';

/** 所有页面级引导的 pageKey */
export type GuidePageKey =
  | 'home'
  | 'config'
  | 'room'
  | 'room:assigned'
  | 'room:ongoing'
  | 'settings'
  | 'encyclopedia';

/** 根据 pageKey 生成 AsyncStorage key */
export const guideStorageKey = (pageKey: GuidePageKey): string =>
  `${GUIDE_DISMISSED_PREFIX}${pageKey}`;

/** 所有引导 dismissed key（用于重置） */
export const ALL_GUIDE_DISMISSED_KEYS: string[] = (
  ['home', 'config', 'room', 'room:assigned', 'room:ongoing', 'settings', 'encyclopedia'] as const
).map(guideStorageKey);
