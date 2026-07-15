/**
 * useWerewolfGameActions - Game control + night-phase player actions
 *
 * Manages:
 * - Host-only game flow: updateTemplate, assignRoles, startGame, restartGame
 * - Role reveal animation and audio playing control
 * - Player night actions: viewedRole, submitAction
 * - Reveal ack and wolfRobot hunter status gates
 * - Game state queries: getLastNightInfo, hasWolfVoted
 *
 * Executes game operations via facade; uses debug/bgm sub-hook state.
 * Does not modify GameState directly and does not bypass the facade.
 */

import type { WerewolfActionInput } from '@werewolf/game-engine';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';
import { useCallback } from 'react';
import { toast } from 'sonner-native';

import { NETWORK_ERROR, SERVER_ERROR } from '@/config/errorMessages';
import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { showErrorAlert } from '@/utils/alertPresets';
import { translateReasonCode } from '@/utils/errorUtils';

import type { WerewolfBgmControlState } from './useWerewolfBgmControl';
import type { WerewolfDebugModeState } from './useWerewolfDebugMode';

/**
 * Unified mutation-result handling — tiered user notification by error type
 *
 * - Network/infrastructure errors (NETWORK_ERROR / SERVER_ERROR): request never reached server, always show alert
 * - Business rejection: delegated to onBusinessError callback
 *   - Pass toastError -> lightweight toast (unified business-error presentation)
 *   - Omit -> silent (state-driven / background operations)
 *
 * Used for user-initiated operations within useWerewolfGameActions.
 * Not used for background/system operations (audio-ack / progression, etc.).
 */
type BusinessErrorHandler = (title: string, message: string) => void;

/** Lightweight toast error — passed to handleMutationResult as the onBusinessError callback */
function toastError(title: string, message: string): void {
  toast.error(title, { description: message });
}

function handleMutationResult(
  result: ActionResult,
  actionLabel: string,
  onBusinessError?: BusinessErrorHandler,
): void {
  if (result.success) return;
  const { reason } = result;

  // Network/infrastructure error -> request never reached server, always show alert
  if (reason === 'NETWORK_ERROR' || reason === 'SERVER_ERROR') {
    showErrorAlert(`${actionLabel}失败`, reason === 'NETWORK_ERROR' ? NETWORK_ERROR : SERVER_ERROR);
    return;
  }

  // Business rejection -> delegate to caller
  onBusinessError?.(`${actionLabel}失败`, translateReasonCode(reason));
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WerewolfGameActionsState {
  // Game control (host-only)
  updateTemplate: (template: GameTemplate) => Promise<void>;
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  clearAllSeats: () => Promise<RoomOperationResult>;
  shareNightReview: (allowedSeats: number[]) => Promise<void>;
  setAudioPlaying: (isPlaying: boolean) => Promise<ActionResult>;

  // Player night actions
  viewedRole: () => Promise<ActionResult>;
  submitAction: (input: WerewolfActionInput) => Promise<void>;
  submitRevealAck: () => Promise<ActionResult>;
  submitGroupConfirmAck: () => Promise<ActionResult>;
  sendWolfRobotHunterStatusViewed: () => Promise<void>;
  /** Host: triggers server progression after wolf vote deadline. Returns success status (used for retry guard). */
  postProgression: () => Promise<boolean>;

  // Board nomination (any connected player)
  boardNominate: (displayName: string, roles: RoleId[]) => Promise<void>;
  boardUpvote: (targetUserId: string) => Promise<void>;
  boardWithdraw: () => Promise<void>;

  // Game state queries
  getLastNightInfo: () => string;
  getCurseInfo: () => string | null;
  hasWolfVoted: (seat: number) => boolean;
}

interface WerewolfGameActionsDeps {
  facade: WerewolfGameClient;
  bgm: WerewolfBgmControlState;
  debug: WerewolfDebugModeState;
  isHost: boolean;
  mySeat: number | null;
  gameState: LocalGameState;
  clearSeats: () => Promise<RoomOperationResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Game actions hook — wraps all interactions: start game, night action, restart, etc.
 *
 * Issues HTTP requests via the facade; does not touch local state directly.
 */ export function useWerewolfGameActions(
  deps: WerewolfGameActionsDeps,
): WerewolfGameActionsState {
  const { facade, bgm, debug, isHost, mySeat, gameState, clearSeats } = deps;

  // =========================================================================
  // Game control (host-only)
  // =========================================================================

  // Update template (host only)
  const updateTemplate = useCallback(
    async (template: GameTemplate): Promise<void> => {
      if (!isHost) return;
      const result = await facade.updateTemplate(template);
      handleMutationResult(result, '更新模板', toastError);
    },
    [facade, isHost],
  );

  // Assign roles (host only)
  const assignRoles = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    const result = await facade.assignRoles();
    handleMutationResult(result, '分配角色', toastError);
  }, [facade, isHost]);

  // Start game (host only)
  // BGM is driven by useWerewolfBgmControl's gameStatus->Ongoing reactive effect; not imperatively started here.
  const startGame = useCallback(async (): Promise<void> => {
    if (!isHost) return;

    const result = await facade.startNight();
    handleMutationResult(result, '开始游戏', toastError);
  }, [facade, isHost]);

  // Restart game (host only)
  const restartGame = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    // Stop BGM on restart
    bgm.stopBgm();
    // Clear controlled seat on restart
    if (debug.controlledSeat !== null) {
      debug.releaseBot();
    }
    const result = await facade.restartGame();
    handleMutationResult(result, '重新开始', toastError);
  }, [facade, bgm, debug, isHost]);

  // Clear all seats (host only)
  const clearAllSeats = useCallback(async (): Promise<RoomOperationResult> => {
    if (!isHost) {
      throw new Error('[FAIL-FAST] Clearing Werewolf seats requires the host');
    }
    return clearSeats();
  }, [clearSeats, isHost]);

  // Share night review to selected seats (host only)
  const shareNightReview = useCallback(
    async (allowedSeats: number[]): Promise<void> => {
      if (!isHost) return;
      const result = await facade.shareNightReview(allowedSeats);
      handleMutationResult(result, '分享详细信息', toastError);
    },
    [facade, isHost],
  );

  // Set audio playing (host only) - PR7 audio timing control
  const setAudioPlaying = useCallback(
    async (isPlaying: boolean): Promise<ActionResult> => {
      if (!isHost) {
        return { success: false, reason: 'host_only' };
      }
      return facade.setAudioPlaying(isPlaying);
    },
    [facade, isHost],
  );

  // =========================================================================
  // Player night actions
  // =========================================================================

  // Mark role as viewed (pessimistic — POST must succeed before UI shows card)
  // Debug mode: when delegating (controlledSeat !== null), mark the bot's seat as viewed
  // Normal mode: mark my own seat as viewed
  const viewedRole = useCallback(async (): Promise<ActionResult> => {
    const seat = debug.controlledSeat ?? mySeat;
    if (seat === null) return { success: false, reason: 'NO_SEAT' };
    const result = await facade.markViewedRole(debug.controlledSeat);
    handleMutationResult(result, '查看身份', toastError);
    return result;
  }, [debug.controlledSeat, mySeat, facade]);

  // Submit action. effectiveSeat is a UI eligibility check; only controlledSeat crosses the wire.
  // Business rejection UX is handled by the state-driven actionRejected effect
  // in useActionOrchestrator. Network/server errors handled by handleMutationResult.
  const submitAction = useCallback(
    async (input: WerewolfActionInput): Promise<void> => {
      if (debug.effectiveSeat === null) return;
      const result = await facade.submitAction(input, debug.controlledSeat);
      handleMutationResult(result, '提交行动');
    },
    [debug.controlledSeat, debug.effectiveSeat, facade],
  );

  // Reveal acknowledge (seer/psychic/gargoyle/wolfRobot)
  const submitRevealAck = useCallback(async (): Promise<ActionResult> => {
    const result = await facade.submitRevealAck(debug.controlledSeat);
    handleMutationResult(result, '确认揭示', toastError);
    return result;
  }, [debug.controlledSeat, facade]);

  // Group confirm acknowledge (piperHypnotizedReveal)
  // Uses effectiveSeat internally to support debug bot control mode
  const submitGroupConfirmAck = useCallback(async (): Promise<ActionResult> => {
    const seat = debug.effectiveSeat;
    if (seat === null) return { success: false, reason: 'NO_SEAT' };
    const result = await facade.submitGroupConfirmAck(debug.controlledSeat);
    handleMutationResult(result, '确认催眠', toastError);
    return result;
  }, [debug.controlledSeat, debug.effectiveSeat, facade]);

  // WolfRobot hunter status viewed gate
  const sendWolfRobotHunterStatusViewed = useCallback(async (): Promise<void> => {
    if (debug.effectiveSeat === null) return;
    const result = await facade.sendWolfRobotHunterStatusViewed(debug.controlledSeat);
    handleMutationResult(result, '确认猎人状态', toastError);
  }, [debug.controlledSeat, debug.effectiveSeat, facade]);

  // Post progression (host only) — triggered by client when wolf vote deadline expires
  const postProgression = useCallback(async (): Promise<boolean> => {
    if (!isHost) return false;
    const result = await facade.postProgression();
    return result.success;
  }, [facade, isHost]);

  // =========================================================================
  // Board Nomination (any connected player)
  // =========================================================================

  const boardNominate = useCallback(
    async (displayName: string, roles: RoleId[]): Promise<void> => {
      const result = await facade.boardNominate(displayName, roles);
      if (result.success && result.reason === 'DEDUPLICATED') {
        toast.info('已有相同板子建议，已自动为你投票');
        return;
      }
      handleMutationResult(result, '提交建议', toastError);
    },
    [facade],
  );

  const boardUpvote = useCallback(
    async (targetUserId: string): Promise<void> => {
      const result = await facade.boardUpvote(targetUserId);
      handleMutationResult(result, '点赞', toastError);
    },
    [facade],
  );

  const boardWithdraw = useCallback(async (): Promise<void> => {
    const result = await facade.boardWithdraw();
    handleMutationResult(result, '撤回建议', toastError);
  }, [facade]);

  // =========================================================================
  // Game state queries
  // =========================================================================

  // Get last night info - derived from gameState
  const getLastNightInfo = useCallback((): string => {
    const parts: string[] = [];

    const deaths = gameState.lastNightDeaths;
    if (deaths.length === 0) {
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
    if (!gameState.template.roles.includes('crow')) return null;
    const { cursedSeat } = gameState.currentNightResults;
    if (cursedSeat == null) return '乌鸦未诅咒任何人';
    return `${formatSeat(cursedSeat)}被诅咒（放逐+1票）`;
  }, [gameState]);

  // Check if a wolf has voted
  const hasWolfVoted = useCallback(
    (seat: number): boolean => {
      return gameState.wolfVotes.has(seat);
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
    setAudioPlaying,
    viewedRole,
    submitAction,
    submitRevealAck,
    submitGroupConfirmAck,
    sendWolfRobotHunterStatusViewed,
    postProgression,
    boardNominate,
    boardUpvote,
    boardWithdraw,
    getLastNightInfo,
    getCurseInfo,
    hasWolfVoted,
  };
}
