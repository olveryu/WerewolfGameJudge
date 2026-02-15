/**
 * Message Router - 统一 STATE_UPDATE 处理
 *
 * 服务端权威架构：所有客户端（Host + Player）平等接收服务端广播的 STATE_UPDATE。
 * 不存在 Host/Player 分叉路径。
 *
 * 职责：
 * - 处理 HostBroadcast（STATE_UPDATE）→ applySnapshot
 *
 * ✅ 允许：applySnapshot + markAsLive
 * ❌ 禁止：业务逻辑/校验规则
 * ❌ 禁止：直接修改 state
 * ❌ 禁止：Host/Player 分叉逻辑
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { HostBroadcast } from '@werewolf/game-engine/protocol/types';

import type { BroadcastService } from '@/services/transport/BroadcastService';
import { facadeLog } from '@/utils/logger';

/**
 * Message Router 依赖的上下文接口
 *
 * ✅ store / broadcastService / myUid
 * ❌ 无 broadcastCurrentState — 客户端不广播（服务端权威）
 */
export interface MessageRouterContext {
  readonly store: GameStore;
  readonly broadcastService: BroadcastService;
  myUid: string | null;
}

// =============================================================================
// 统一处理 HostBroadcast（Host + Player 共用）
// =============================================================================

/**
 * 处理服务端广播的 STATE_UPDATE
 *
 * Host 和 Player 走完全相同的路径：applySnapshot → markAsLive。
 */
export function handleStateUpdate(ctx: MessageRouterContext, msg: HostBroadcast): void {
  switch (msg.type) {
    case 'STATE_UPDATE': {
      // 双 Host 检测：如果收到的 hostUid 与已知的不同，发出告警
      const currentState = ctx.store.getState();
      if (currentState && currentState.hostUid !== msg.state.hostUid) {
        facadeLog.warn('[DUAL_HOST_DETECTED] Received STATE_UPDATE from different hostUid', {
          knownHostUid: currentState.hostUid,
          receivedHostUid: msg.state.hostUid,
          revision: msg.revision,
        });
      }
      ctx.store.applySnapshot(msg.state, msg.revision);
      ctx.broadcastService.markAsLive();
      break;
    }
  }
}
