/**
 * useHostGameActions - Host game control + night-phase player actions
 *
 * Manages:
 * - Host-only game flow: updateTemplate, assignRoles, startGame, restartGame
 * - Role reveal animation and audio playing control
 * - Player night actions: viewedRole, submitAction, submitWolfVote
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
 * 公用的 API 失败通知 — 所有重试耗尽后向用户显示提示
 *
 * 用于 useHostGameActions 内用户发起的操作。
 * 不用于后台/系统操作（audio-ack / progression 等）。
 */
function notifyIfFailed(result: { success: boolean; reason?: string }, actionLabel: string): void {
  if (result.success) return;
  showAlert(`${actionLabel}失败`, result.reason ?? '请稍后重试');
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface HostGameActionsState {
  // Host game control
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
  submitWolfVote: (target: number) => Promise<void>;
  submitRevealAck: () => Promise<void>;
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;
  /** Host: wolf vote deadline 到期后触发服务端推进 */
  postProgression: () => Promise<void>;

  // Game state queries
  getLastNightInfo: () => string;
  hasWolfVoted: (seatNumber: number) => boolean;
}

interface HostGameActionsDeps {
  facade: IGameFacade;
  bgm: BgmControlState;
  debug: DebugModeState;
  mySeatNumber: number | null;
  gameState: LocalGameState | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useHostGameActions(deps: HostGameActionsDeps): HostGameActionsState {
  const { facade, bgm, debug, mySeatNumber, gameState } = deps;

  // =========================================================================
  // Host game control
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
    notifyIfFailed(result, '分配角色');
  }, [facade]);

  // Start game (host only) - uses startNight + BGM
  const startGame = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;

    // Start BGM if enabled
    bgm.startBgmIfEnabled();
    const result = await facade.startNight();
    notifyIfFailed(result, '开始游戏');
  }, [facade, bgm]);

  // Restart game (host only)
  const restartGame = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;
    // Stop BGM on restart
    bgm.stopBgm();
    // Clear controlled seat on restart
    debug.setControlledSeat(null);
    const result = await facade.restartGame();
    notifyIfFailed(result, '重新开始');
  }, [facade, bgm, debug]);

  // Clear all seats (host only)
  const clearAllSeats = useCallback(async (): Promise<void> => {
    if (!facade.isHostPlayer()) return;
    const result = await facade.clearAllSeats();
    notifyIfFailed(result, '全员起立');
  }, [facade]);

  // Share night review to selected seats (host only)
  const shareNightReview = useCallback(
    async (allowedSeats: number[]): Promise<void> => {
      if (!facade.isHostPlayer()) return;
      const result = await facade.shareNightReview(allowedSeats);
      notifyIfFailed(result, '分享详细信息');
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
    notifyIfFailed(result, '查看身份');
  }, [debug.controlledSeat, mySeatNumber, facade]);

  // Submit action (uses effectiveSeat/effectiveRole for debug bot control)
  const submitAction = useCallback(
    async (target: number | null, extra?: unknown): Promise<void> => {
      const seat = debug.effectiveSeat;
      const role = debug.effectiveRole;
      if (seat === null || !role) return;
      const result = await facade.submitAction(seat, role, target, extra);
      notifyIfFailed(result, '提交行动');
    },
    [debug.effectiveSeat, debug.effectiveRole, facade],
  );

  // Submit wolf vote (uses effectiveSeat for debug bot control)
  const submitWolfVote = useCallback(
    async (target: number): Promise<void> => {
      const seat = debug.effectiveSeat;
      if (seat === null) return;
      const result = await facade.submitWolfVote(seat, target);
      notifyIfFailed(result, '狼人投票');
    },
    [debug.effectiveSeat, facade],
  );

  // Reveal acknowledge (seer/psychic/gargoyle/wolfRobot)
  const submitRevealAck = useCallback(async (): Promise<void> => {
    const result = await facade.submitRevealAck();
    notifyIfFailed(result, '确认揭示');
  }, [facade]);

  // WolfRobot hunter status viewed gate
  // seat 参数由调用方传入 effectiveSeat，以支持 debug bot 接管模式
  const sendWolfRobotHunterStatusViewed = useCallback(
    async (seat: number): Promise<void> => {
      const result = await facade.sendWolfRobotHunterStatusViewed(seat);
      notifyIfFailed(result, '确认猎人状态');
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
    const deaths = gameState.lastNightDeaths;
    if (!deaths || deaths.length === 0) return '昨夜平安夜';
    const deathList = deaths.map((d: number) => (d + 1).toString() + '号').join(', ');
    return '昨夜死亡: ' + deathList;
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
    submitWolfVote,
    submitRevealAck,
    sendWolfRobotHunterStatusViewed,
    postProgression,
    getLastNightInfo,
    hasWolfVoted,
  };
}
