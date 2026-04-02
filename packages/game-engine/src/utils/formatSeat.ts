/**
 * formatSeat — 0-based 座位索引 → 用户可读的 1-based 展示标签
 *
 * 全局唯一的座位号格式化入口。所有面向用户的文本（UI、弹窗、日志、
 * 错误消息）统一调用此函数，禁止散落 `seat + 1` 手写转换。
 * 引擎内部逻辑保持 0-based，不调用此函数。
 */

/** 0-based seat index → "N号" display string (1-indexed). */
export function formatSeat(seat: number): string {
  return `${seat + 1}号`;
}
