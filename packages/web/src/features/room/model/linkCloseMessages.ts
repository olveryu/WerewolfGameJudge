/** User-facing copy for terminal link closes; the shell and entry boundary share it. */

import type { RealtimeCloseReason } from '@game-judge/game-engine/platform/realtime/closeCodes';

const CLOSE_REASON_MESSAGES: Readonly<Record<RealtimeCloseReason, string>> = {
  roomDeleted: '房间已过期关闭',
  instanceMismatch: '房间已被重新创建，请重新进入',
  authRejected: '登录已过期，请重新登录',
  stateUnavailable: '房间状态暂不可用，请稍后重试',
  protocol: '版本已更新，请刷新页面',
  released: '已离开房间',
};

export function getLinkCloseMessage(reason: RealtimeCloseReason): string {
  return CLOSE_REASON_MESSAGES[reason];
}
