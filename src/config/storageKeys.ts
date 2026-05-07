/**
 * storageKeys - MMKV key constants
 *
 * 所有跨文件使用的 MMKV key 集中定义，禁止 hardcode 魔法字符串。
 * 纯常量模块，不包含业务逻辑或副作用。
 */

/** 最近进入的房间号列表 JSON (string[], 最新在前, 最多 5 项) */
export const RECENT_ROOM_CODES_KEY = 'recentRoomCodes';

/** 用户已看过的最新公告版本号（What's New 弹窗） */
export const LAST_SEEN_VERSION_KEY = '@werewolf_last_seen_version';

/** Admin portal 密码缓存 */
export const ADMIN_PASSWORD_KEY = 'admin_password';
