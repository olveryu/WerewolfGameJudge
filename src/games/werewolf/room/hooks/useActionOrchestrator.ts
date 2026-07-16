/**
 * useActionOrchestrator.ts - Night action intent handler & auto-trigger orchestrator
 *
 * Dispatches ActionIntent to the executor registry, manages action submission
 * helpers (proceedWithAction, confirmThenAct), runs auto-trigger effect
 * (idempotent intent auto-fire on step changes), and surfaces Host
 * ACTION_REJECTED via alert.
 *
 * Server-ack lifecycle (reveal / hunterStatus / groupConfirm) tracked via
 * useWerewolfAckMutation — RoomInteractionPolicy reads aggregate state via
 * useWerewolfPendingAcks. No local pending booleans here.
 *
 * Does not import services directly (all actions come via params), does not
 * contain policy / interaction dispatch logic (that's useInteractionDispatcher),
 * does not render UI or hold JSX, does not own seat tap / interaction context,
 * and does not modify GameState directly.
 */

import type { WerewolfActionInput } from '@game-judge/game-engine/games/werewolf/public';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { ActionSchema } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isSuccessfulRoomCommand,
  type SuccessfulRoomCommandDispatchOutcome,
} from '@/features/room/session/roomCommandResult';
import { useWerewolfAckMutation } from '@/games/werewolf/hooks/useWerewolfAckMutation';
import type { ActionIntent } from '@/games/werewolf/room/policy/types';
import type { UseRoomActionDialogsResult } from '@/games/werewolf/room/useRoomActionDialogs';
import type { WerewolfCommandDispatchOutcome } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { ExecutorContext } from '../executors';
import { dispatchIntent } from '../executors';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseActionOrchestratorParams {
  // ── Game state ──
  gameState: LocalGameState;
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
  myUserId: string | null;

  // ── Rejoin overlay ──
  /** When true, ContinueGameOverlay is visible — suppress auto-trigger to avoid z-order conflict. */
  needsContinueOverlay: boolean;

  // ── Magician state (owned by WerewolfRoomScreen, passed in + out) ──
  firstSwapSeat: number | null;
  setFirstSwapSeat: (v: number | null) => void;
  setSecondSeat: (v: number | null) => void;

  // ── Submission callbacks ──
  submitAction: (input: WerewolfActionInput) => Promise<WerewolfCommandDispatchOutcome>;
  submitRevealAck: () => Promise<WerewolfCommandDispatchOutcome>;
  sendWolfRobotHunterStatusViewed: () => Promise<WerewolfCommandDispatchOutcome>;
  submitGroupConfirmAck: () => Promise<WerewolfCommandDispatchOutcome>;

  // ── Multi-select state (owned by WerewolfRoomScreen, passed in + out) ──
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
  myUserId,
  needsContinueOverlay,
  firstSwapSeat,
  setFirstSwapSeat,
  setSecondSeat,
  submitAction,
  submitRevealAck,
  sendWolfRobotHunterStatusViewed,
  submitGroupConfirmAck,
  multiSelectedSeats,
  setMultiSelectedSeats,
  getAutoTriggerIntent,
  actionDialogs,
  openChooseCardModal,
}: UseActionOrchestratorParams): UseActionOrchestratorResult {
  // ─── Server-ack mutations (TanStack — owns isPending lifecycle) ──────────
  // mutationKey ['ack', name] aggregates into useWerewolfPendingAcks for the policy gate.
  // retry: 0 — UI controls re-show on failure (see executor onSuccess branches).
  const revealAckMutation = useWerewolfAckMutation<void, WerewolfCommandDispatchOutcome>(
    'reveal',
    () => submitRevealAck(),
  );
  const hunterStatusAckMutation = useWerewolfAckMutation<void, WerewolfCommandDispatchOutcome>(
    'hunterStatus',
    () => sendWolfRobotHunterStatusViewed(),
  );
  const groupConfirmAckMutation = useWerewolfAckMutation<void, WerewolfCommandDispatchOutcome>(
    'groupConfirm',
    () => submitGroupConfirmAck(),
  );

  // ─── Refs ────────────────────────────────────────────────────────────────
  const gameStateRef = useRef<LocalGameState>(gameState);
  const lastAutoIntentKeyRef = useRef<string | null>(null);
  const lastRejectedKeyRef = useRef<string | null>(null);

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
    async (input: WerewolfActionInput): Promise<WerewolfCommandDispatchOutcome> => {
      if (actionSubmittingRef.current) {
        throw new Error('[FAIL-FAST] Werewolf action submitted while another action is pending');
      }
      markActionSubmitting(true);
      roomScreenLog.debug('proceedWithAction Submitting', { inputKind: input.kind });
      try {
        const result = await submitAction(input);
        // Submission success/failure UX is handled by the state-driven
        // `gameState.actionRejected` effect below.
        return result;
      } catch (err) {
        handleError(err, {
          label: '提交操作',
          logger: roomScreenLog,
          feedback: 'toast',
          alertMessage: '请稍后重试',
        });
        throw err;
      } finally {
        markActionSubmitting(false);
      }
    },
    [submitAction, markActionSubmitting],
  );

  const confirmThenAct = useCallback(
    (
      targetSeat: number,
      onAccepted: (result: SuccessfulRoomCommandDispatchOutcome<GameState>) => Promise<void> | void,
      opts?: { title?: string; message?: string },
    ) => {
      const title = opts?.title ?? currentSchema?.ui?.confirmTitle ?? '确认操作';
      const message = opts?.message ?? currentSchema?.ui?.confirmText ?? '执行此操作？';

      actionDialogs.showConfirmDialog(title, message, async () => {
        const result = await proceedWithAction({ kind: 'target', target: targetSeat });
        if (!isSuccessfulRoomCommand(result)) return;
        await onAccepted(result);
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

    // In debug mode, Host controls bot seats, so also check effectiveSeat's userId
    const effectiveUid =
      effectiveSeat === null ? null : gameState?.players.get(effectiveSeat)?.userId;
    const isTargetMatch =
      rejected.targetUserId === myUserId || rejected.targetUserId === effectiveUid;
    if (!myUserId || !isTargetMatch) return;

    // Deduplicate repeated broadcasts of the same rejection
    const key =
      (rejected as { rejectionId?: string }).rejectionId ??
      `${rejected.action}:${rejected.reason}:${rejected.targetUserId}`;
    if (key === lastRejectedKeyRef.current) return;
    lastRejectedKeyRef.current = key;

    roomScreenLog.warn('Action rejected by server', {
      action: rejected.action,
      reason: rejected.reason,
      targetUserId: rejected.targetUserId,
    });
    actionDialogs.showActionRejectedAlert(rejected.reason);
  }, [gameState?.actionRejected, gameState?.players, myUserId, effectiveSeat, actionDialogs]);

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
        revealAckMutation,
        hunterStatusAckMutation,
        groupConfirmAckMutation,
        openChooseCardModal,
        actionDialogs,
      };

      await dispatchIntent(intent, ctx);
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
      revealAckMutation,
      hunterStatusAckMutation,
      groupConfirmAckMutation,
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

    // Suppress auto-triggering intent while audio is playing or the continue-game overlay is visible
    if (!imActioner || isAudioPlaying || needsContinueOverlay) return;

    const autoIntent = getAutoTriggerIntent();
    if (!autoIntent) return;

    // Build idempotency key: stable representation of "same turn + same actor"
    const key = [
      roomStatus,
      gameState.currentStepIndex,
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
      handleError(err, { label: 'auto-trigger', logger: roomScreenLog, feedback: false });
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
    gameState.currentStepIndex,
    getAutoTriggerIntent,
    handleActionIntent,
  ]);

  return {
    handleActionIntent,
    isActionSubmitting,
  };
}
