/**
 * Reason Codes - 座位操作拒绝原因常量
 *
 * 分为两类：
 * 1. Business Reason - 业务逻辑拒绝（来自 handler）
 * 2. Transport Reason - 传输层原因（来自 Facade transport）
 */

// ============================================================
// Business Reason Codes (来自 handler)
// ============================================================

/** 未认证 */
export const REASON_NOT_AUTHENTICATED = 'not_authenticated' as const;

/** 没有游戏状态（store 未初始化） */
export const REASON_NO_STATE = 'no_state' as const;

/** 座位号无效 */
export const REASON_INVALID_SEAT = 'invalid_seat' as const;

/** 座位已被占用 */
export const REASON_SEAT_TAKEN = 'seat_taken' as const;

/** 游戏进行中，不允许操作 */
export const REASON_GAME_IN_PROGRESS = 'game_in_progress' as const;

/** 玩家未入座 */
export const REASON_NOT_SEATED = 'not_seated' as const;

/** 无效的操作类型 */
export const REASON_INVALID_ACTION = 'invalid_action' as const;

// ============================================================
// Transport Reason Codes (来自 Facade transport 层)
// ============================================================

/** 请求超时 */
export const REASON_TIMEOUT = 'timeout' as const;

/** 请求被取消（被新请求覆盖） */
export const REASON_CANCELLED = 'cancelled' as const;

// ============================================================
// Type Union
// ============================================================
