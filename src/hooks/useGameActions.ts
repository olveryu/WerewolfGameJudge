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

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';
import { useCallback } from 'react';
import { toast } from 'sonner-native';

import { NETWORK_ERROR, SERVER_ERROR } from '@/config/errorMessages';
import type { IGameFacade } from '@/services/types/IGameFacade';
import type { LocalGameState } from '@/types/GameStateTypes';
import { showErrorAlert } from '@/utils/alertPresets';
import { translateReasonCode } from '@/utils/errorUtils';

import type { BgmControlState } from './useBgmControl';
import type { DebugModeState } from './useDebugMode';

/**
 * Mutation 结果统一处理 — 按错误类型分层通知用户
 *
 * - 网络/基础设施错误（NETWORK_ERROR / SERVER_ERROR）：请求未到服务器，始终弹 alert
 * - 业务拒绝：交给 onBusinessError 回调处理
 *   - 传 toastError → 轻量 toast（业务错误统一展示方式）
 *   - 不传 → 静默（state-driven / 后台操作）
 *
 * 用于 useGameActions 内用户发起的操作。
 * 不用于后台/系统操作（audio-ack / progression 等）。
 */
type BusinessErrorHandler = (title: string, message: string) => void;

/** 轻量 toast 错误提示 — 作为 onBusinessError 回调传入 handleMutationResult */
function toastError(title: string, message: string): void {
  toast.error(title, { description: message });
}

function handleMutationResult(
  result: { success: boolean; reason?: string },
  actionLabel: string,
  onBusinessError?: BusinessErrorHandler,
): void {
  if (result.success) return;
  const { reason } = result;

  // 网络/基础设施错误 → 请求没到服务器，始终弹 alert
  if (reason === 'NETWORK_ERROR' || reason === 'SERVER_ERROR') {
    showErrorAlert(`${actionLabel}失败`, reason === 'NETWORK_ERROR' ? NETWORK_ERROR : SERVER_ERROR);
    return;
  }

  // 业务拒绝 → 交给调用方
  onBusinessError?.(`${actionLabel}失败`, translateReasonCode(reason));
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
  viewedRole: () => Promise<{ success: boolean; reason?: string }>;
  submitAction: (target: number | null, extra?: unknown) => Promise<void>;
  submitRevealAck: () => Promise<void>;
  submitGroupConfirmAck: () => Promise<void>;
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;
  /** Host: wolf vote deadline 到期后触发服务端推进。返回是否成功（用于 retry guard）。 */
  postProgression: () => Promise<boolean>;

  // Game state queries
  getLastNightInfo: () => string;
  getCurseInfo: () => string | null;
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
    handleMutationResult(result, '分配角色', toastError);
  }, [facade]);

  // Start game (host only) - uses startNight + BGM
  const startGame = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;

    // Start BGM if enabled
    bgm.startBgmIfEnabled();
    const result = await facade.startNight();
    handleMutationResult(result, '开始游戏', toastError);
  }, [facade, bgm]);

  // Restart game (host only)
  const restartGame = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;
    // Stop BGM on restart
    bgm.stopBgm();
    // Clear controlled seat on restart
    debug.setControlledSeat(null);
    const result = await facade.restartGame();
    handleMutationResult(result, '重新开始', toastError);
  }, [facade, bgm, debug]);

  // Clear all seats (host only)
  const clearAllSeats = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;
    const result = await facade.clearAllSeats();
    handleMutationResult(result, '全员起立', toastError);
  }, [facade]);

  // Share night review to selected seats (host only)
  const shareNightReview = useCallback(
    async (allowedSeats: number[]): Promise<void> => {
      if (!facade.isHostPlayer()) return;
      const result = await facade.shareNightReview(allowedSeats);
      handleMutationResult(result, '分享详细信息', toastError);
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

  // Mark role as viewed (pessimistic — POST must succeed before UI shows card)
  // Debug mode: when delegating (controlledSeat !== null), mark the bot's seat as viewed
  // Normal mode: mark my own seat as viewed
  const viewedRole = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    const seat = debug.controlledSeat ?? mySeatNumber;
    if (seat === null) return { success: false, reason: 'NO_SEAT' };
    const result = await facade.markViewedRole(seat);
    handleMutationResult(result, '查看身份', toastError);
    return result;
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
      handleMutationResult(result, '提交行动');
    },
    [debug.effectiveSeat, debug.effectiveRole, facade],
  );

  // Reveal acknowledge (seer/psychic/gargoyle/wolfRobot)
  const submitRevealAck = useCallback(async (): Promise<void> => {
    const result = await facade.submitRevealAck();
    handleMutationResult(result, '确认揭示', toastError);
  }, [facade]);

  // Group confirm acknowledge (piperHypnotizedReveal)
  // Uses effectiveSeat internally to support debug bot control mode
  const submitGroupConfirmAck = useCallback(async (): Promise<void> => {
    const seat = debug.effectiveSeat;
    if (seat === null) return;
    const result = await facade.submitGroupConfirmAck(seat);
    handleMutationResult(result, '确认催眠', toastError);
  }, [debug.effectiveSeat, facade]);

  // WolfRobot hunter status viewed gate
  // seat 参数由调用方传入 effectiveSeat，以支持 debug bot 接管模式
  const sendWolfRobotHunterStatusViewed = useCallback(
    async (seat: number): Promise<void> => {
      const result = await facade.sendWolfRobotHunterStatusViewed(seat);
      handleMutationResult(result, '确认猎人状态', toastError);
    },
    [facade],
  );

  // Post progression (host only) — wolf vote deadline 到期时由客户端触发
  const postProgression = useCallback(async (): Promise<boolean> => {
    if (!facade.isHostPlayer()) return false;
    const result = await facade.postProgression();
    return result.success;
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
      const deathList = deaths.map((d: number) => formatSeat(d)).join(', ');
      parts.push('昨夜死亡: ' + deathList);
    }

    const nr = gameState.currentNightResults;
    if (nr.silencedSeat != null) {
      parts.push(`${formatSeat(nr.silencedSeat)}被禁言`);
    }
    if (nr.votebannedSeat != null) {
      parts.push(`${formatSeat(nr.votebannedSeat)}被禁票`);
    }

    return parts.join('\n');
  }, [gameState]);

  // Get curse info — separate from lastNightInfo; returns null when crow is not in template
  const getCurseInfo = useCallback((): string | null => {
    if (!gameState) return null;
    if (!gameState.template.roles.includes('crow' as RoleId)) return null;
    const { cursedSeat } = gameState.currentNightResults;
    if (cursedSeat == null) return '乌鸦未诅咒任何人';
    return `${formatSeat(cursedSeat)}被诅咒（放逐+1票）`;
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
    getCurseInfo,
    hasWolfVoted,
  };
}
