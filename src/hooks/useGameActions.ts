/**
 * useGameActions - Game control + night-phase player actions
 *
 * Manages:
 * - Host-only game flow: updateTemplate, assignRoles, startGame, restartGame
 * - Role reveal animation and audio playing control
 * - Player night actions: viewedRole, submitAction
 * - Reveal ack and wolfRobot hunter status gates
 * - Game state queries: getLastNightInfo, hasWolfVoted
 *
 * 通过 facade 执行游戏操作，使用 debug/bgm sub-hook state。
 * 不直接修改 GameState，不绕过 facade。
 */

import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { useCallback } from 'react';

import type { IGameFacade } from '@/services/types/IGameFacade';
import type { LocalGameState } from '@/types/GameStateTypes';
import { showAlert } from '@/utils/alert';

import type { BgmControlState } from './useBgmControl';
import type { DebugModeState } from './useDebugMode';

/**
 * Mutation 结果统一处理 — 按错误类型分层通知用户
 *
 * - 网络/基础设施错误（NETWORK_ERROR / SERVER_ERROR）：请求未到服务器，始终弹 alert
 * - 业务拒绝：按 onBusinessError 策略处理
 *   - 'alert'（默认）：弹 alert（适用于大多数 host 操作）
 *   - 'state-driven'：不弹，由 state effect 驱动 UX（如 submitAction 的 actionRejected）
 *   - 'silent'：不弹（后台操作）
 *
 * 用于 useGameActions 内用户发起的操作。
 * 不用于后台/系统操作（audio-ack / progression 等）。
 */
type ErrorStrategy = 'alert' | 'state-driven' | 'silent';

function handleMutationResult(
  result: { success: boolean; reason?: string },
  actionLabel: string,
  onBusinessError: ErrorStrategy = 'alert',
): void {
  if (result.success) return;
  const { reason } = result;

  // 网络/基础设施错误 → 请求没到服务器，始终弹 alert
  if (reason === 'NETWORK_ERROR' || reason === 'SERVER_ERROR') {
    showAlert(
      `${actionLabel}失败`,
      reason === 'NETWORK_ERROR' ? '网络错误，请稍后重试' : '服务器错误，请稍后重试',
    );
    return;
  }

  // 业务拒绝 → 按策略
  if (onBusinessError === 'alert') {
    showAlert(`${actionLabel}失败`, reason ?? '请稍后重试');
  }
  // 'state-driven' / 'silent' → 不弹
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface GameActionsState {
  // Game control (host-only)
  updateTemplate: (template: GameTemplate) => Promise<void>;
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  clearAllSeats: () => Promise<void>;
  shareNightReview: (allowedSeats: number[]) => Promise<void>;
  setRoleRevealAnimation: (animation: RoleRevealAnimation) => Promise<void>;
  setAudioPlaying: (isPlaying: boolean) => Promise<{ success: boolean; reason?: string }>;

  // Player night actions
  viewedRole: () => Promise<void>;
  submitAction: (target: number | null, extra?: unknown) => Promise<void>;
  submitRevealAck: () => Promise<void>;
  submitGroupConfirmAck: () => Promise<void>;
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;
  /** Host: wolf vote deadline 到期后触发服务端推进 */
  postProgression: () => Promise<void>;

  // Game state queries
  getLastNightInfo: () => string;
  hasWolfVoted: (seatNumber: number) => boolean;
}

interface GameActionsDeps {
  facade: IGameFacade;
  bgm: BgmControlState;
  debug: DebugModeState;
  mySeatNumber: number | null;
  gameState: LocalGameState | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useGameActions(deps: GameActionsDeps): GameActionsState {
  const { facade, bgm, debug, mySeatNumber, gameState } = deps;

  // =========================================================================
  // Game control (host-only)
  // =========================================================================

  // Update template (host only)
  const updateTemplate = useCallback(
    async (template: GameTemplate): Promise<void> => {
      if (!facade.isHostPlayer()) return;
      await facade.updateTemplate(template);
    },
    [facade],
  );

  // Assign roles (host only)
  const assignRoles = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;
    const result = await facade.assignRoles();
    handleMutationResult(result, '分配角色');
  }, [facade]);

  // Start game (host only) - uses startNight + BGM
  const startGame = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;

    // Start BGM if enabled
    bgm.startBgmIfEnabled();
    const result = await facade.startNight();
    handleMutationResult(result, '开始游戏');
  }, [facade, bgm]);

  // Restart game (host only)
  const restartGame = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;
    // Stop BGM on restart
    bgm.stopBgm();
    // Clear controlled seat on restart
    debug.setControlledSeat(null);
    const result = await facade.restartGame();
    handleMutationResult(result, '重新开始');
  }, [facade, bgm, debug]);

  // Clear all seats (host only)
  const clearAllSeats = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;
    const result = await facade.clearAllSeats();
    handleMutationResult(result, '全员起立');
  }, [facade]);

  // Share night review to selected seats (host only)
  const shareNightReview = useCallback(
    async (allowedSeats: number[]): Promise<void> => {
      if (!facade.isHostPlayer()) return;
      const result = await facade.shareNightReview(allowedSeats);
      handleMutationResult(result, '分享详细信息');
    },
    [facade],
  );

  // Set role reveal animation (host only)
  const setRoleRevealAnimation = useCallback(
    async (animation: RoleRevealAnimation): Promise<void> => {
      if (!facade.isHostPlayer()) return;
      await facade.setRoleRevealAnimation(animation);
    },
    [facade],
  );

  // Set audio playing (host only) - PR7 音频时序控制
  const setAudioPlaying = useCallback(
    async (isPlaying: boolean): Promise<{ success: boolean; reason?: string }> => {
      if (!facade.isHostPlayer()) {
        return { success: false, reason: 'host_only' };
      }
      return facade.setAudioPlaying(isPlaying);
    },
    [facade],
  );

  // =========================================================================
  // Player night actions
  // =========================================================================

  // Mark role as viewed
  // Debug mode: when delegating (controlledSeat !== null), mark the bot's seat as viewed
  // Normal mode: mark my own seat as viewed
  const viewedRole = useCallback(async (): Promise<void> => {
    const seat = debug.controlledSeat ?? mySeatNumber;
    if (seat === null) return;
    const result = await facade.markViewedRole(seat);
    handleMutationResult(result, '查看身份');
  }, [debug.controlledSeat, mySeatNumber, facade]);

  // Submit action (uses effectiveSeat/effectiveRole for debug bot control)
  // Business rejection UX is handled by the state-driven actionRejected effect
  // in useActionOrchestrator. Network/server errors handled by handleMutationResult.
  const submitAction = useCallback(
    async (target: number | null, extra?: unknown): Promise<void> => {
      const seat = debug.effectiveSeat;
      const role = debug.effectiveRole;
      if (seat === null || !role) return;
      const result = await facade.submitAction(seat, role, target, extra);
      handleMutationResult(result, '提交行动', 'state-driven');
    },
    [debug.effectiveSeat, debug.effectiveRole, facade],
  );

  // Reveal acknowledge (seer/psychic/gargoyle/wolfRobot)
  const submitRevealAck = useCallback(async (): Promise<void> => {
    const result = await facade.submitRevealAck();
    handleMutationResult(result, '确认揭示');
  }, [facade]);

  // Group confirm acknowledge (piperHypnotizedReveal)
  // Uses effectiveSeat internally to support debug bot control mode
  const submitGroupConfirmAck = useCallback(async (): Promise<void> => {
    const seat = debug.effectiveSeat;
    if (seat === null) return;
    const result = await facade.submitGroupConfirmAck(seat);
    handleMutationResult(result, '确认催眠');
  }, [debug.effectiveSeat, facade]);

  // WolfRobot hunter status viewed gate
  // seat 参数由调用方传入 effectiveSeat，以支持 debug bot 接管模式
  const sendWolfRobotHunterStatusViewed = useCallback(
    async (seat: number): Promise<void> => {
      const result = await facade.sendWolfRobotHunterStatusViewed(seat);
      handleMutationResult(result, '确认猎人状态');
    },
    [facade],
  );

  // Post progression (host only) — wolf vote deadline 到期时由客户端触发
  const postProgression = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;
    await facade.postProgression();
  }, [facade]);

  // =========================================================================
  // Game state queries
  // =========================================================================

  // Get last night info - derived from gameState
  const getLastNightInfo = useCallback((): string => {
    if (!gameState) return '无信息';
    const parts: string[] = [];

    const deaths = gameState.lastNightDeaths;
    if (!deaths || deaths.length === 0) {
      parts.push('昨夜平安夜');
    } else {
      const deathList = deaths.map((d: number) => (d + 1).toString() + '号').join(', ');
      parts.push('昨夜死亡: ' + deathList);
    }

    const nr = gameState.currentNightResults;
    if (nr.silencedSeat != null) {
      parts.push(`${nr.silencedSeat + 1}号被禁言`);
    }
    if (nr.votebannedSeat != null) {
      parts.push(`${nr.votebannedSeat + 1}号被禁票`);
    }

    return parts.join('\n');
  }, [gameState]);

  // Check if a wolf has voted
  const hasWolfVoted = useCallback(
    (seatNumber: number): boolean => {
      if (!gameState) return false;
      return gameState.wolfVotes.has(seatNumber);
    },
    [gameState],
  );

  return {
    updateTemplate,
    assignRoles,
    startGame,
    restartGame,
    clearAllSeats,
    shareNightReview,
    setRoleRevealAnimation,
    setAudioPlaying,
    viewedRole,
    submitAction,
    submitRevealAck,
    submitGroupConfirmAck,
    sendWolfRobotHunterStatusViewed,
    postProgression,
    getLastNightInfo,
    hasWolfVoted,
  };
}
