/**
 * storageKeys - AsyncStorage key constants
 *
 * 所有跨文件使用的 AsyncStorage key 集中定义，禁止 hardcode 魔法字符串。
 * 纯常量模块，不包含业务逻辑或副作用。
 */

/** 上一次加入/创建的房间号（HomeScreen 回到上局 + signOut 清理） */
export const LAST_ROOM_NUMBER_KEY = 'lastRoomNumber';
