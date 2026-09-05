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
 * Executes game operations via client; uses debug/bgm sub-hook state.
 * Does not modify GameState directly and does not bypass the client.
 */

import type { WerewolfActionInput } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { GameTemplate } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { useCallback } from 'react';
import { toast } from 'sonner-native';

import { NETWORK_ERROR, SERVER_ERROR } from '@/config/errorMessages';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import type {
  WerewolfCommandDispatchOutcome,
  WerewolfGameClient,
} from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { showErrorAlert } from '@/utils/alertPresets';
import { translateReasonCode } from '@/utils/errorUtils';

import type { WerewolfBgmControlState } from './useWerewolfBgmControl';
import type { WerewolfDebugModeState } from './useWerewolfDebugMode';

/**
 * Unified mutation-result handling — tiered user notification by error type
 *
 * - Undecided delivery errors: the client has no authoritative decision, always show alert
 * - Business rejection: delegated to onBusinessError callback
 *   - Pass toastError -> lightweight toast (unified business-error presentation)
 *   - Omit -> silent (state-driven / background operations)
 *
 * Used for user-initiated operations within useWerewolfGameActions.
 * Not used for background/system operations (audio-ack / progression, etc.).
 */
type BusinessErrorHandler = (title: string, message: string) => void;

/** Lightweight toast error passed to command-outcome presentation. */
function toastError(title: string, message: string): void {
  toast.error(title, { description: message });
}

function handleCommandOutcome(
  result: WerewolfCommandDispatchOutcome,
  actionLabel: string,
  onBusinessError?: BusinessErrorHandler,
): void {
  if (isSuccessfulRoomCommand(result)) return;
  const reason = getRoomCommandFailureReason(result);

  // No authoritative Worker decision is available, so the UI must not continue the workflow.
  if (result.kind !== 'decided') {
    showErrorAlert(`${actionLabel}失败`, reason === 'NETWORK_ERROR' ? NETWORK_ERROR : SERVER_ERROR);
    return;
  }

  // Pre-commit rejection has no state-driven rejection event, so it must be presented here.
  if (result.decision.kind === 'rejected') {
    (onBusinessError ?? toastError)(`${actionLabel}失败`, translateReasonCode(reason));
    return;
  }

  // Committed domain rejection may be presented by the authoritative state consumer.
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
  clearAllSeats: () => Promise<WerewolfCommandDispatchOutcome>;
  shareNightReview: (allowedSeats: number[]) => Promise<WerewolfCommandDispatchOutcome>;
  // Player night actions
  viewedRole: () => Promise<WerewolfCommandDispatchOutcome>;
  submitAction: (input: WerewolfActionInput) => Promise<WerewolfCommandDispatchOutcome>;
  submitRevealAck: () => Promise<WerewolfCommandDispatchOutcome>;
  submitGroupConfirmAck: () => Promise<WerewolfCommandDispatchOutcome>;
  sendWolfRobotHunterStatusViewed: () => Promise<WerewolfCommandDispatchOutcome>;
  /** Host: triggers server progression after wolf vote deadline. Returns success status (used for retry guard). */
  postProgression: () => Promise<boolean>;

  // Board nomination (any connected player)
  boardNominate: (displayName: string, roles: RoleId[]) => Promise<void>;
  boardUpvote: (targetUserId: string) => Promise<void>;
  boardWithdraw: () => Promise<void>;

  // First-day sheriff election
  registerSheriffCandidate: () => Promise<WerewolfCommandDispatchOutcome>;
  cancelSheriffRegistration: () => Promise<WerewolfCommandDispatchOutcome>;
  withdrawSheriffCandidate: () => Promise<WerewolfCommandDispatchOutcome>;
  castSheriffVote: (targetSeat: number | null) => Promise<WerewolfCommandDispatchOutcome>;
  advanceSheriffElection: () => Promise<WerewolfCommandDispatchOutcome>;
  endSheriffElectionBySelfDestruct: () => Promise<WerewolfCommandDispatchOutcome>;

  // Game state queries
  getLastNightInfo: () => string;
  getCurseInfo: () => string | null;
  hasWolfVoted: (seat: number) => boolean;
}

interface WerewolfGameActionsDeps {
  client: WerewolfGameClient;
  bgm: WerewolfBgmControlState;
  debug: WerewolfDebugModeState;
  isHost: boolean;
  mySeat: number | null;
  gameState: LocalGameState;
  clearSeats: () => Promise<WerewolfCommandDispatchOutcome>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Game actions hook — wraps all interactions: start game, night action, restart, etc.
 *
 * Issues HTTP requests via the client; does not touch local state directly.
 */ export function useWerewolfGameActions(
  deps: WerewolfGameActionsDeps,
): WerewolfGameActionsState {
  const { client, bgm, debug, isHost, mySeat, gameState, clearSeats } = deps;

  // =========================================================================
  // Game control (host-only)
  // =========================================================================

  // Update template (host only)
  const updateTemplate = useCallback(
    async (template: GameTemplate): Promise<void> => {
      if (!isHost) return;
      const result = await client.updateTemplate(template);
      handleCommandOutcome(result, '更新模板', toastError);
    },
    [client, isHost],
  );

  // Assign roles (host only)
  const assignRoles = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    const result = await client.assignRoles();
    handleCommandOutcome(result, '分配角色', toastError);
  }, [client, isHost]);

  // Start game (host only)
  // BGM is driven by useWerewolfBgmControl's gameStatus->Ongoing reactive effect; not imperatively started here.
  const startGame = useCallback(async (): Promise<void> => {
    if (!isHost) return;

    const result = await client.startNight();
    handleCommandOutcome(result, '开始游戏', toastError);
  }, [client, isHost]);

  // Restart game (host only)
  const restartGame = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    // Stop BGM on restart
    bgm.stopBgm();
    // Clear controlled seat on restart
    if (debug.controlledSeat !== null) {
      debug.releaseBot();
    }
    const result = await client.restartGame();
    handleCommandOutcome(result, '重新开始', toastError);
  }, [client, bgm, debug, isHost]);

  // Clear all seats (host only)
  const clearAllSeats = useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
    if (!isHost) {
      throw new Error('[FAIL-FAST] Clearing Werewolf seats requires the host');
    }
    return clearSeats();
  }, [clearSeats, isHost]);

  // Share night review to selected seats (host only)
  const shareNightReview = useCallback(
    async (allowedSeats: number[]): Promise<WerewolfCommandDispatchOutcome> => {
      if (!isHost) {
        throw new Error('[FAIL-FAST] Sharing Werewolf night review requires the host');
      }
      const result = await client.shareNightReview(allowedSeats);
      handleCommandOutcome(result, '分享本局复盘', toastError);
      return result;
    },
    [client, isHost],
  );

  // =========================================================================
  // Player night actions
  // =========================================================================

  // Mark role as viewed (pessimistic — POST must succeed before UI shows card)
  // Debug mode: when delegating (controlledSeat !== null), mark the bot's seat as viewed
  // Normal mode: mark my own seat as viewed
  const viewedRole = useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
    const seat = debug.controlledSeat ?? mySeat;
    if (seat === null) {
      throw new Error('[FAIL-FAST] Viewing a Werewolf role requires an effective seat');
    }
    const result = await client.markViewedRole(debug.controlledSeat);
    handleCommandOutcome(result, '查看身份', toastError);
    return result;
  }, [debug.controlledSeat, mySeat, client]);

  // Submit action. effectiveSeat is a UI eligibility check; only controlledSeat crosses the wire.
  // Business rejection UX is handled by the state-driven actionRejected effect
  // in useActionOrchestrator. Network/server errors handled by handleMutationResult.
  const submitAction = useCallback(
    async (input: WerewolfActionInput): Promise<WerewolfCommandDispatchOutcome> => {
      if (debug.effectiveSeat === null) {
        throw new Error('[FAIL-FAST] Submitting a Werewolf action requires an effective seat');
      }
      const result = await client.submitAction(input, debug.controlledSeat);
      if (result.kind !== 'deliveryUnknown') handleCommandOutcome(result, '提交行动');
      return result;
    },
    [debug.controlledSeat, debug.effectiveSeat, client],
  );

  // Reveal acknowledge (seer/psychic/gargoyle/wolfRobot)
  const submitRevealAck = useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
    const result = await client.submitRevealAck(debug.controlledSeat);
    handleCommandOutcome(result, '确认揭示', toastError);
    return result;
  }, [debug.controlledSeat, client]);

  // Group confirm acknowledge (piperHypnotizedReveal)
  // Uses effectiveSeat internally to support debug bot control mode
  const submitGroupConfirmAck = useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
    const seat = debug.effectiveSeat;
    if (seat === null) {
      throw new Error('[FAIL-FAST] Confirming a Werewolf reveal requires an effective seat');
    }
    const result = await client.submitGroupConfirmAck(debug.controlledSeat);
    handleCommandOutcome(result, '确认催眠', toastError);
    return result;
  }, [debug.controlledSeat, debug.effectiveSeat, client]);

  // WolfRobot hunter status viewed gate
  const sendWolfRobotHunterStatusViewed =
    useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
      if (debug.effectiveSeat === null) {
        throw new Error('[FAIL-FAST] Confirming Hunter status requires an effective seat');
      }
      const result = await client.sendWolfRobotHunterStatusViewed(debug.controlledSeat);
      handleCommandOutcome(result, '确认猎人状态', toastError);
      return result;
    }, [debug.controlledSeat, debug.effectiveSeat, client]);

  // Post progression (host only) — triggered by client when wolf vote deadline expires
  const postProgression = useCallback(async (): Promise<boolean> => {
    if (!isHost) return false;
    const result = await client.postProgression();
    return isSuccessfulRoomCommand(result);
  }, [client, isHost]);

  // =========================================================================
  // Board Nomination (any connected player)
  // =========================================================================

  const boardNominate = useCallback(
    async (displayName: string, roles: RoleId[]): Promise<void> => {
      const result = await client.boardNominate(displayName, roles);
      if (isSuccessfulRoomCommand(result) && result.decision.outcome.reason === 'DEDUPLICATED') {
        toast.info('已有相同板子建议，已自动为你投票');
        return;
      }
      handleCommandOutcome(result, '提交建议', toastError);
    },
    [client],
  );

  const boardUpvote = useCallback(
    async (targetUserId: string): Promise<void> => {
      const result = await client.boardUpvote(targetUserId);
      handleCommandOutcome(result, '点赞', toastError);
    },
    [client],
  );

  const boardWithdraw = useCallback(async (): Promise<void> => {
    const result = await client.boardWithdraw();
    handleCommandOutcome(result, '撤回建议', toastError);
  }, [client]);

  // =========================================================================
  // First-day Sheriff Election
  // =========================================================================

  const registerSheriffCandidate =
    useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
      if (debug.effectiveSeat === null) {
        throw new Error('[FAIL-FAST] Registering as sheriff candidate requires an effective seat');
      }
      const result = await client.registerSheriffCandidate(debug.controlledSeat);
      handleCommandOutcome(result, '报名上警', toastError);
      return result;
    }, [client, debug.controlledSeat, debug.effectiveSeat]);

  const cancelSheriffRegistration =
    useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
      if (debug.effectiveSeat === null) {
        throw new Error('[FAIL-FAST] Canceling sheriff registration requires an effective seat');
      }
      const result = await client.cancelSheriffRegistration(debug.controlledSeat);
      handleCommandOutcome(result, '取消报名', toastError);
      return result;
    }, [client, debug.controlledSeat, debug.effectiveSeat]);

  const withdrawSheriffCandidate =
    useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
      if (debug.effectiveSeat === null) {
        throw new Error('[FAIL-FAST] Withdrawing from sheriff election requires an effective seat');
      }
      const result = await client.withdrawSheriffCandidate(debug.controlledSeat);
      handleCommandOutcome(result, '退水', toastError);
      return result;
    }, [client, debug.controlledSeat, debug.effectiveSeat]);

  const castSheriffVote = useCallback(
    async (targetSeat: number | null): Promise<WerewolfCommandDispatchOutcome> => {
      if (debug.effectiveSeat === null) {
        throw new Error('[FAIL-FAST] Casting a sheriff ballot requires an effective seat');
      }
      const result = await client.castSheriffVote(targetSeat, debug.controlledSeat);
      handleCommandOutcome(result, '竞选投票', toastError);
      return result;
    },
    [client, debug.controlledSeat, debug.effectiveSeat],
  );

  const advanceSheriffElection = useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
    if (!isHost) {
      throw new Error('[FAIL-FAST] Advancing sheriff election requires the host');
    }
    const result = await client.advanceSheriffElection();
    handleCommandOutcome(result, '推进竞选', toastError);
    return result;
  }, [client, isHost]);

  const endSheriffElectionBySelfDestruct =
    useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
      if (!isHost) {
        throw new Error('[FAIL-FAST] Ending sheriff election by self-destruct requires the host');
      }
      const result = await client.endSheriffElectionBySelfDestruct();
      handleCommandOutcome(result, '自爆结束竞选', toastError);
      return result;
    }, [client, isHost]);

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
    viewedRole,
    submitAction,
    submitRevealAck,
    submitGroupConfirmAck,
    sendWolfRobotHunterStatusViewed,
    postProgression,
    boardNominate,
    boardUpvote,
    boardWithdraw,
    registerSheriffCandidate,
    cancelSheriffRegistration,
    withdrawSheriffCandidate,
    castSheriffVote,
    advanceSheriffElection,
    endSheriffElectionBySelfDestruct,
    getLastNightInfo,
    getCurseInfo,
    hasWolfVoted,
  };
}
