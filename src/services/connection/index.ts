/**
 * Connection module barrel export
 *
 * 统一导出连接状态机、管理器和类型。
 */

export { calculateBackoff } from './backoff';
export { createInitialContext, transition } from './ConnectionFSM';
export type { ConnectionManagerDeps, ConnectionStateListener } from './ConnectionManager';
export { ConnectionManager } from './ConnectionManager';
export type { ConnectionEvent, FSMContext, SideEffect, TransitionResult } from './types';
export {
  ConnectionState,
  DEFAULT_MAX_ATTEMPTS,
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  REVISION_POLL_INTERVAL_MS,
} from './types';
