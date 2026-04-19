/**
 * useActionOrchestrator.ts - Night action intent handler & auto-trigger orchestrator
 *
 * Dispatches ActionIntent to the executor registry, manages action submission
 * helpers (proceedWithAction, confirmThenAct), runs auto-trigger effect
 * (idempotent intent auto-fire on step changes), surfaces Host ACTION_REJECTED
 * via alert, and owns pendingRevealDialog / pendingHunterStatusViewed gate state.
 * Does not import services directly (all actions come via params), does not contain policy /
 * interaction dispatch logic (that's useInteractionDispatcher), does not render UI or hold JSX,
 * does not own seat tap / interaction context / dispatchInteraction, and does not modify
 * GameState directly.
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RevealKind, RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema } from '@werewolf/game-engine/models/roles/spec';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ActionIntent } from '@/screens/RoomScreen/policy/types';
import type { UseRoomActionDialogsResult } from '@/screens/RoomScreen/useRoomActionDialogs';
import type { LocalGameState } from '@/types/GameStateTypes';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { ExecutorContext } from '../executors';
import { dispatchIntent } from '../executors';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseActionOrchestratorParams {
  // ── Game state ──
  gameState: LocalGameState | null;
  roomStatus: GameStatus;
  currentActionRole: RoleId | null;
  currentSchema: ActionSchema | null;

  // ── Identity (effective* = submission, actor* = UI decision) ──
  effectiveSeat: number | null;
  effectiveRole: RoleId | null;
  controlledSeat: number | null;
  actorSeatForUi: number | null;
  imActioner: boolean;
  isAudioPlaying: boolean;
  myUid: string | null;

  // ── Rejoin overlay ──
  /** When true, ContinueGameOverlay is visible — suppress auto-trigger to avoid z-order conflict. */
  needsContinueOverlay: boolean;

  // ── Magician state (owned by RoomScreen, passed in + out) ──
  firstSwapSeat: number | null;
  setFirstSwapSeat: (v: number | null) => void;
  setSecondSeat: (v: number | null) => void;

  // ── Submission callbacks ──
  submitAction: (targetSeat: number | null, extra?: unknown) => Promise<void>;
  submitRevealAckSafe: (role: RevealKind) => void;
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;
  submitGroupConfirmAck: () => void;

  // ── Multi-select state (owned by RoomScreen, passed in + out) ──
  multiSelectedSeats: readonly number[];
  setMultiSelectedSeats: (v: readonly number[]) => void;

  // ── Intent helpers (from useRoomActions) ──
  getAutoTriggerIntent: () => ActionIntent | null;

  // ── Dialog layer ──
  actionDialogs: UseRoomActionDialogsResult;

  // ── Choose card modal (treasureMaster) ──
  openChooseCardModal?: () => void;
}

interface UseActionOrchestratorResult {
  /** Process an ActionIntent (the big switch). Called by dispatchInteraction and auto-trigger. */
  handleActionIntent: (intent: ActionIntent) => Promise<void>;
  /** Whether a reveal dialog is pending (gates night-end speak order dialog). */
  pendingRevealDialog: boolean;
  /** Setter for pendingRevealDialog (needed by interaction dispatcher for REVEAL_ACK). */
  setPendingRevealDialog: (v: boolean) => void;
  /** Whether wolfRobot hunter status viewed is pending submission. */
  pendingHunterStatusViewed: boolean;
  /** Whether a night action is currently being submitted (disables seat taps). */
  isActionSubmitting: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useActionOrchestrator({
  gameState,
  roomStatus,
  currentActionRole,
  currentSchema,
  effectiveSeat,
  effectiveRole,
  controlledSeat,
  actorSeatForUi,
  imActioner,
  isAudioPlaying,
  myUid,
  needsContinueOverlay,
  firstSwapSeat,
  setFirstSwapSeat,
  setSecondSeat,
  submitAction,
  submitRevealAckSafe,
  sendWolfRobotHunterStatusViewed,
  submitGroupConfirmAck,
  multiSelectedSeats,
  setMultiSelectedSeats,
  getAutoTriggerIntent,
  actionDialogs,
  openChooseCardModal,
}: UseActionOrchestratorParams): UseActionOrchestratorResult {
  // ─── Local state ─────────────────────────────────────────────────────────
  // P0-FIX: 追踪"正在等待/显示查验结果弹窗"的状态
  // 这样天亮弹窗（发言顺序）会等待查验结果弹窗关闭后再显示
  const [pendingRevealDialog, setPendingRevealDialog] = useState(false);

  // P1-FIX: 追踪"机械狼猎人状态确认正在提交"的状态
  // 防止 sendWolfRobotHunterStatusViewed 在 state 更新前被重复触发
  const [pendingHunterStatusViewed, setPendingHunterStatusViewed] = useState(false);

  // ─── Refs ────────────────────────────────────────────────────────────────
  const gameStateRef = useRef<LocalGameState | null>(null);
  const lastAutoIntentKeyRef = useRef<string | null>(null);
  const lastRejectedKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Clear mountedRef on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Keep gameStateRef in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // ─── Submission helpers ──────────────────────────────────────────────────

  const actionSubmittingRef = useRef(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const markActionSubmitting = useCallback((v: boolean) => {
    actionSubmittingRef.current = v;
    setIsActionSubmitting(v);
  }, []);

  const proceedWithAction = useCallback(
    async (targetSeat: number | null, extra?: unknown): Promise<boolean> => {
      if (actionSubmittingRef.current) {
        roomScreenLog.debug('proceedWithAction Skipped: already submitting');
        return false;
      }
      markActionSubmitting(true);
      roomScreenLog.debug('proceedWithAction Submitting', { targetSeat });
      try {
        // Only pass extra when defined to preserve call-site arity for consumers
        // that distinguish submitAction(seat) from submitAction(seat, undefined).
        if (extra !== undefined) {
          await submitAction(targetSeat, extra);
        } else {
          await submitAction(targetSeat);
        }
        // Submission success/failure UX is handled by the state-driven
        // `gameState.actionRejected` effect below.
        return true;
      } finally {
        markActionSubmitting(false);
      }
    },
    [submitAction, markActionSubmitting],
  );

  const confirmThenAct = useCallback(
    (
      targetSeat: number,
      onAccepted: () => Promise<void> | void,
      opts?: { title?: string; message?: string },
    ) => {
      const title = opts?.title ?? currentSchema?.ui?.confirmTitle ?? '确认操作';
      const message = opts?.message ?? currentSchema?.ui?.confirmText ?? '执行此操作？';

      actionDialogs.showConfirmDialog(title, message, () => {
        void (async () => {
          const accepted = await proceedWithAction(targetSeat);
          if (!accepted) return;
          await onAccepted();
        })();
      });
    },
    [actionDialogs, currentSchema, proceedWithAction],
  );

  // ─── Rejection effect ────────────────────────────────────────────────────

  useEffect(() => {
    const rejected = gameState?.actionRejected;
    if (!rejected) {
      lastRejectedKeyRef.current = null;
      return;
    }

    // In debug mode, Host controls bot seats, so also check effectiveSeat's uid
    const effectiveUid = effectiveSeat === null ? null : gameState?.players.get(effectiveSeat)?.uid;
    const isTargetMatch = rejected.targetUid === myUid || rejected.targetUid === effectiveUid;
    if (!myUid || !isTargetMatch) return;

    // Deduplicate repeated broadcasts of the same rejection
    const key =
      (rejected as { rejectionId?: string }).rejectionId ??
      `${rejected.action}:${rejected.reason}:${rejected.targetUid}`;
    if (key === lastRejectedKeyRef.current) return;
    lastRejectedKeyRef.current = key;

    roomScreenLog.warn('Action rejected by server', {
      action: rejected.action,
      reason: rejected.reason,
      targetUid: rejected.targetUid,
    });
    actionDialogs.showActionRejectedAlert(rejected.reason);
  }, [gameState?.actionRejected, gameState?.players, myUid, effectiveSeat, actionDialogs]);

  // ─── Intent handler (executor dispatch) ──────────────────────────────────

  const handleActionIntent = useCallback(
    async (intent: ActionIntent) => {
      const ctx: ExecutorContext = {
        gameState,
        gameStateRef,
        currentSchema,
        currentActionRole,
        effectiveSeat,
        effectiveRole,
        controlledSeat,
        actorSeatForUi,
        firstSwapSeat,
        setFirstSwapSeat,
        setSecondSeat,
        multiSelectedSeats,
        setMultiSelectedSeats,
        proceedWithAction,
        confirmThenAct,
        submitRevealAckSafe,
        sendWolfRobotHunterStatusViewed,
        submitGroupConfirmAck,
        setPendingRevealDialog,
        pendingHunterStatusViewed,
        setPendingHunterStatusViewed,
        openChooseCardModal,
        actionDialogs,
        mountedRef,
      };

      const handled = await dispatchIntent(intent, ctx);
      if (!handled) {
        throw new Error(
          `[FAIL-FAST] No executor registered for ActionIntentType: ${String(intent.type)}`,
        );
      }
    },
    [
      gameState,
      effectiveRole,
      effectiveSeat,
      firstSwapSeat,
      actionDialogs,
      confirmThenAct,
      currentSchema,
      currentActionRole,
      pendingHunterStatusViewed,
      sendWolfRobotHunterStatusViewed,
      submitRevealAckSafe,
      submitGroupConfirmAck,
      actorSeatForUi,
      multiSelectedSeats,
      setMultiSelectedSeats,
      setFirstSwapSeat,
      setSecondSeat,
      controlledSeat,
      proceedWithAction,
      openChooseCardModal,
    ],
  );

  // ─── Auto-trigger intent (idempotent) ────────────────────────────────────

  useEffect(() => {
    // Guard: reset key when not in ongoing state or night ended
    if (roomStatus !== GameStatus.Ongoing || !currentActionRole) {
      if (lastAutoIntentKeyRef.current !== null) {
        roomScreenLog.debug(' Clearing key (not ongoing or night ended)');
        lastAutoIntentKeyRef.current = null;
      }
      return;
    }

    // 音频播放中 / 继续游戏弹窗可见时禁止自动触发 intent
    if (!imActioner || isAudioPlaying || needsContinueOverlay) return;

    const autoIntent = getAutoTriggerIntent();
    if (!autoIntent) return;

    // Build idempotency key: stable representation of "same turn + same actor"
    const key = [
      roomStatus,
      gameState?.currentStepIndex ?? 'null',
      currentActionRole ?? 'null',
      actorSeatForUi ?? 'null',
      imActioner ? 'A' : 'N',
      isAudioPlaying ? 'P' : 'S',
      effectiveRole ?? 'null',
      firstSwapSeat ?? 'null',
      autoIntent.type,
    ].join('|');

    // Skip if same key (idempotent - already triggered this exact intent)
    if (key === lastAutoIntentKeyRef.current) {
      roomScreenLog.debug('Skipping duplicate auto-intent', { key });
      return;
    }

    roomScreenLog.debug('Triggering auto-intent', { key, intent: autoIntent.type });
    lastAutoIntentKeyRef.current = key;
    void handleActionIntent(autoIntent).catch((err) => {
      handleError(err, { label: 'auto-trigger', logger: roomScreenLog, alertTitle: false });
    });
  }, [
    imActioner,
    isAudioPlaying,
    needsContinueOverlay,
    effectiveRole,
    actorSeatForUi,
    firstSwapSeat,
    roomStatus,
    currentActionRole,
    gameState?.currentStepIndex,
    getAutoTriggerIntent,
    handleActionIntent,
  ]);

  return {
    handleActionIntent,
    pendingRevealDialog,
    setPendingRevealDialog,
    pendingHunterStatusViewed,
    isActionSubmitting,
  };
}
