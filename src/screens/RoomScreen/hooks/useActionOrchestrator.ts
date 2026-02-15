/**
 * useActionOrchestrator.ts - Night action intent handler & auto-trigger orchestrator
 *
 * ✅ Allowed:
 *   - Process ActionIntent (the big switch: reveal, wolfVote, actionConfirm, skip, etc.)
 *   - Manage action submission helpers (proceedWithAction, confirmThenAct, buildWitchStepResults)
 *   - Run auto-trigger effect (idempotent intent auto-fire on step changes)
 *   - Run rejection effect (surface Host ACTION_REJECTED via alert)
 *   - Own pendingRevealDialog / pendingHunterStatusViewed gate state
 *
 * ❌ Do NOT:
 *   - Import services directly (all actions come via params)
 *   - Contain policy / interaction dispatch logic (that's useInteractionDispatcher)
 *   - Render UI or hold JSX
 *   - Own seat tap / interaction context / dispatchInteraction
 *   - Modify BroadcastGameState directly
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RevealKind, RoleId } from '@werewolf/game-engine/models/roles';
import { getRoleDisplayName, getWolfKillImmuneRoleIds } from '@werewolf/game-engine/models/roles';
import type { ActionSchema, InlineSubStepSchema } from '@werewolf/game-engine/models/roles/spec';
import { BLOCKED_UI_DEFAULTS } from '@werewolf/game-engine/models/roles/spec';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { UseRoomActionDialogsResult } from '@/screens/RoomScreen/useRoomActionDialogs';
import type { LocalGameState } from '@/types/GameStateTypes';
import { roomScreenLog } from '@/utils/logger';

import type { ActionIntent } from './useRoomActions';

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

  // ── Magician state (owned by RoomScreen, passed in + out) ──
  firstSwapSeat: number | null;
  setFirstSwapSeat: (v: number | null) => void;
  setSecondSeat: (v: number | null) => void;

  // ── Submission callbacks ──
  submitAction: (targetSeat: number | null, extra?: unknown) => Promise<void>;
  submitWolfVote: (targetSeat: number) => Promise<void>;
  submitRevealAckSafe: (role: RevealKind) => void;
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;

  // ── Intent helpers (from useRoomActions) ──
  getAutoTriggerIntent: () => ActionIntent | null;
  findVotingWolfSeat: () => number | null;

  // ── Dialog layer ──
  actionDialogs: UseRoomActionDialogsResult;
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
  firstSwapSeat,
  setFirstSwapSeat,
  setSecondSeat,
  submitAction,
  submitWolfVote,
  submitRevealAckSafe,
  sendWolfRobotHunterStatusViewed,
  getAutoTriggerIntent,
  findVotingWolfSeat: _findVotingWolfSeat,
  actionDialogs,
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
        roomScreenLog.debug('[proceedWithAction] Skipped: already submitting');
        return false;
      }
      markActionSubmitting(true);
      roomScreenLog.debug('[proceedWithAction] Submitting', { targetSeat });
      try {
        await submitAction(targetSeat, extra);
        // Submission success/failure UX is handled by the state-driven
        // `gameState.actionRejected` effect below (covers submitAction + submitWolfVote).
        return true;
      } finally {
        markActionSubmitting(false);
      }
    },
    [submitAction, markActionSubmitting],
  );

  // ── Action extra typing (UI -> Host wire payload) ──
  type WitchStepResults = { save: number | null; poison: number | null };
  type ActionExtra =
    | { stepResults: WitchStepResults }
    | { targets: readonly [number, number] }
    | { confirmed: boolean };

  /**
   * Get a compound sub-step by key (e.g., 'save', 'poison' for witchAction).
   */
  const getSubStepByKey = useCallback(
    (stepKey: string | undefined): InlineSubStepSchema | null => {
      if (!stepKey || currentSchema?.kind !== 'compound') return null;
      const compound = currentSchema;
      return compound.steps.find((s) => s.key === stepKey) ?? null;
    },
    [currentSchema],
  );

  /**
   * Build witch action extra with stepResults protocol.
   */
  const buildWitchStepResults = useCallback(
    (opts: { saveTarget: number | null; poisonTarget: number | null }): ActionExtra => {
      return { stepResults: { save: opts.saveTarget, poison: opts.poisonTarget } };
    },
    [],
  );

  const proceedWithActionTyped = useCallback(
    async (targetSeat: number | null, extra?: ActionExtra): Promise<boolean> => {
      return proceedWithAction(targetSeat, extra);
    },
    [proceedWithAction],
  );

  // UI-only helpers: keep confirm copy schema-driven
  const getConfirmTitleForSchema = useCallback((): string => {
    return currentSchema?.kind === 'chooseSeat' ? currentSchema.ui!.confirmTitle! : '确认行动';
  }, [currentSchema]);

  const getConfirmTextForSeatAction = useCallback(
    (targetSeat: number): string => {
      return currentSchema?.kind === 'chooseSeat'
        ? currentSchema.ui!.confirmText!
        : `是否对${targetSeat + 1}号玩家使用技能？`;
    },
    [currentSchema],
  );

  const confirmThenAct = useCallback(
    (
      targetSeat: number,
      onAccepted: () => Promise<void> | void,
      opts?: { title?: string; message?: string },
    ) => {
      const title = opts?.title ?? getConfirmTitleForSchema();
      const message = opts?.message ?? getConfirmTextForSeatAction(targetSeat);

      actionDialogs.showConfirmDialog(title, message, async () => {
        const accepted = await proceedWithActionTyped(targetSeat);
        if (!accepted) return;
        await onAccepted();
      });
    },
    [actionDialogs, getConfirmTextForSeatAction, getConfirmTitleForSchema, proceedWithActionTyped],
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

    roomScreenLog.warn('[useActionOrchestrator] Action rejected by Host', {
      action: rejected.action,
      reason: rejected.reason,
      targetUid: rejected.targetUid,
    });
    actionDialogs.showActionRejectedAlert(rejected.reason);
  }, [gameState?.actionRejected, gameState?.players, myUid, effectiveSeat, actionDialogs]);

  // ─── Intent handler (the big switch) ─────────────────────────────────────

  const handleActionIntent = useCallback(
    async (intent: ActionIntent) => {
      switch (intent.type) {
        case 'magicianFirst':
          roomScreenLog.debug('[handleActionIntent] magicianFirst', {
            targetSeat: intent.targetSeat,
          });
          setFirstSwapSeat(intent.targetSeat);
          actionDialogs.showMagicianFirstAlert(intent.targetSeat, currentSchema!);
          break;

        case 'reveal': {
          if (!gameState) return;
          if (!intent.revealKind) {
            roomScreenLog.warn(' reveal intent missing revealKind');
            return;
          }

          const revealKind = intent.revealKind;

          const getRevealData = (): { targetSeat: number; result: string } | undefined => {
            const state = gameStateRef.current;
            if (!state) return undefined;
            switch (revealKind) {
              case 'seer':
                return state.seerReveal;
              case 'psychic':
                return state.psychicReveal;
              case 'gargoyle':
                return state.gargoyleReveal;
              case 'wolfRobot':
                return state.wolfRobotReveal;
              default:
                return undefined;
            }
          };

          confirmThenAct(intent.targetSeat, async () => {
            setPendingRevealDialog(true);

            const maxRetries = 10;
            const retryInterval = 50;
            let reveal: { targetSeat: number; result: string } | undefined;

            for (let i = 0; i < maxRetries; i++) {
              await new Promise((resolve) => setTimeout(resolve, retryInterval));
              reveal = getRevealData();
              if (reveal) break;
            }

            if (reveal) {
              const displayResult =
                revealKind === 'seer' ? reveal.result : getRoleDisplayName(reveal.result);
              const titlePrefix =
                revealKind === 'seer'
                  ? '查验结果'
                  : revealKind === 'psychic'
                    ? '通灵结果'
                    : revealKind === 'gargoyle'
                      ? '石像鬼探查'
                      : '学习结果';
              actionDialogs.showRevealDialog(
                `${titlePrefix}：${reveal.targetSeat + 1}号是${displayResult}`,
                '',
                () => {
                  submitRevealAckSafe(revealKind);
                  setPendingRevealDialog(false);
                },
              );
            } else {
              roomScreenLog.warn(
                ` ${revealKind}Reveal timeout - no reveal received after ${maxRetries * retryInterval}ms`,
              );
              setPendingRevealDialog(false);
            }
          });
          break;
        }

        case 'wolfVote':
          {
            const seat = intent.wolfSeat ?? effectiveSeat;
            roomScreenLog.info('[handleActionIntent] wolfVote:', {
              'intent.wolfSeat': intent.wolfSeat,
              effectiveSeat,
              effectiveRole,
              controlledSeat,
              seat,
              targetSeat: intent.targetSeat,
            });
            if (seat === null) {
              roomScreenLog.warn(
                '[handleActionIntent] wolfVote: effectiveSeat is null, cannot submit.',
                { effectiveSeat, effectiveRole, controlledSeat },
              );
              return;
            }
            actionDialogs.showWolfVoteDialog(
              `${seat + 1}号狼人`,
              intent.targetSeat,
              () => {
                if (actionSubmittingRef.current) return;
                markActionSubmitting(true);
                void Promise.resolve(submitWolfVote(intent.targetSeat)).finally(() => {
                  markActionSubmitting(false);
                });
              },
              (() => {
                // Only override for immune targets — normal text comes from schema templates.
                if (intent.targetSeat < 0) return undefined;
                const targetRole = gameStateRef.current?.players?.get(intent.targetSeat)?.role;
                if (currentSchema?.id !== 'wolfKill' || !targetRole) return undefined;
                const immune = getWolfKillImmuneRoleIds().includes(targetRole);
                if (!immune) return undefined;
                const tpl = currentSchema.ui!.voteConfirmTemplate!;
                const resolved = tpl
                  .replace('{wolf}', `${seat + 1}号狼人`)
                  .replace('{seat}', `${intent.targetSeat + 1}`);
                return `${resolved}\n（提示：该角色免疫狼刀，Host 会拒绝）`;
              })(),
              currentSchema!,
            );
          }
          break;

        case 'actionConfirm':
          roomScreenLog.debug('[actionConfirm] Processing:', {
            effectiveRole,
            effectiveSeat,
            firstSwapSeat,
            schemaKind: currentSchema?.kind,
            schemaId: currentSchema?.id,
            'intent.targetSeat': intent.targetSeat,
            'intent.stepKey': intent.stepKey,
          });

          if (effectiveRole === 'magician' && firstSwapSeat !== null) {
            const swapTargets: [number, number] = [firstSwapSeat, intent.targetSeat];
            setSecondSeat(intent.targetSeat);
            setTimeout(() => {
              actionDialogs.showConfirmDialog(
                currentSchema!.ui!.confirmTitle!,
                intent.message!,
                () => {
                  setFirstSwapSeat(null);
                  setSecondSeat(null);
                  void proceedWithActionTyped(null, { targets: swapTargets });
                },
                () => {
                  setFirstSwapSeat(null);
                  setSecondSeat(null);
                },
              );
            }, 0);
          } else {
            const stepSchema = getSubStepByKey(intent.stepKey);
            let extra: ActionExtra | undefined;
            let targetToSubmit: number | null;

            if (currentSchema?.kind === 'compound') {
              if (effectiveSeat === null) {
                roomScreenLog.warn(
                  '[actionConfirm] Cannot submit compound action without seat (effectiveSeat is null)',
                );
                return;
              }
              targetToSubmit = effectiveSeat;
              if (stepSchema?.key === 'save') {
                extra = buildWitchStepResults({
                  saveTarget: intent.targetSeat,
                  poisonTarget: null,
                });
              } else if (stepSchema?.key === 'poison') {
                extra = buildWitchStepResults({
                  saveTarget: null,
                  poisonTarget: intent.targetSeat,
                });
              }
            } else {
              targetToSubmit = intent.targetSeat;
            }

            roomScreenLog.debug('[actionConfirm] Submitting:', {
              schemaKind: currentSchema?.kind,
              targetToSubmit,
              'intent.targetSeat': intent.targetSeat,
              extra,
            });

            actionDialogs.showConfirmDialog(
              stepSchema?.ui?.confirmTitle ?? currentSchema!.ui!.confirmTitle!,
              stepSchema?.ui?.confirmText ?? intent.message!,
              () => void proceedWithActionTyped(targetToSubmit, extra),
            );
          }
          break;

        case 'skip': {
          if (currentSchema?.kind === 'confirm') {
            actionDialogs.showConfirmDialog(
              '确认跳过',
              intent.message || BLOCKED_UI_DEFAULTS.skipButtonText,
              () => void proceedWithActionTyped(null, { confirmed: false } as ActionExtra),
            );
            break;
          }

          const skipStepSchema = getSubStepByKey(intent.stepKey);
          let skipExtra: ActionExtra | undefined;
          let skipSeat: number | null = null;

          if (intent.stepKey === 'skipAll' || currentSchema?.kind === 'compound') {
            if (effectiveSeat === null) {
              roomScreenLog.warn(
                '[skip] Cannot submit compound skip without seat (effectiveSeat is null)',
              );
              return;
            }
            skipExtra = buildWitchStepResults({ saveTarget: null, poisonTarget: null });
            skipSeat = effectiveSeat;
          }

          const skipConfirmText = skipStepSchema?.ui?.confirmText || intent.message;
          if (!skipConfirmText) {
            throw new Error(`[FAIL-FAST] Missing confirmText for skip action: ${intent.stepKey}`);
          }

          actionDialogs.showConfirmDialog(
            '确认跳过',
            skipConfirmText,
            () => void proceedWithActionTyped(skipSeat, skipExtra),
          );
          break;
        }

        case 'actionPrompt': {
          const hint = gameState?.ui?.currentActorHint;
          const hintApplies = hint && effectiveRole && hint.targetRoleIds.includes(effectiveRole);
          roomScreenLog.debug('[actionPrompt] UI Hint check', {
            hint: hint
              ? {
                  kind: hint.kind,
                  targetRoleIds: hint.targetRoleIds,
                  bottomAction: hint.bottomAction,
                }
              : null,
            effectiveRole,
            hintApplies,
            'gameState.ui': gameState?.ui,
          });
          if (hintApplies && hint.promptOverride) {
            actionDialogs.showRoleActionPrompt(
              hint.promptOverride.title!,
              hint.promptOverride.text!,
              () => {},
            );
            break;
          }

          if (currentSchema?.kind === 'compound' && currentSchema.id === 'witchAction') {
            const witchCtx = gameState?.witchContext;
            if (!witchCtx) return;
            actionDialogs.showWitchInfoPrompt(witchCtx, currentSchema, () => {});
            break;
          }

          if (currentSchema?.kind === 'confirm') {
            if (!currentSchema.ui?.prompt) {
              throw new Error(
                `[FAIL-FAST] Missing schema.ui.prompt for confirm schema: ${currentActionRole}`,
              );
            }
            actionDialogs.showRoleActionPrompt('行动提示', currentSchema.ui.prompt, () => {});
            break;
          }

          if (!currentSchema?.ui?.prompt) {
            throw new Error(`[FAIL-FAST] Missing schema.ui.prompt for role: ${currentActionRole}`);
          }
          actionDialogs.showRoleActionPrompt('行动提示', currentSchema.ui.prompt, () => {});
          break;
        }

        case 'confirmTrigger': {
          if (!gameState) break;

          if (
            !currentSchema?.ui?.statusDialogTitle ||
            !currentSchema?.ui?.canShootText ||
            !currentSchema?.ui?.cannotShootText
          ) {
            throw new Error(
              `[RoomScreen] confirmTrigger schema missing status dialog UI fields for ${currentSchema?.id}`,
            );
          }

          const confirmStatus = gameState.confirmStatus;
          let canShoot = true;

          if (effectiveRole === 'hunter') {
            if (confirmStatus?.role === 'hunter') {
              canShoot = confirmStatus.canShoot;
            }
          } else if (effectiveRole === 'darkWolfKing') {
            if (confirmStatus?.role === 'darkWolfKing') {
              canShoot = confirmStatus.canShoot;
            }
          }

          const dialogTitle = currentSchema.ui.statusDialogTitle;
          const statusMessage = canShoot
            ? currentSchema.ui.canShootText
            : currentSchema.ui.cannotShootText;

          if (effectiveSeat === null) {
            roomScreenLog.warn(
              '[confirmTrigger] Cannot submit confirm action without seat (effectiveSeat is null)',
            );
            return;
          }
          actionDialogs.showRoleActionPrompt(
            dialogTitle,
            statusMessage,
            () => void proceedWithActionTyped(effectiveSeat, { confirmed: true } as ActionExtra),
          );
          break;
        }

        case 'wolfRobotViewHunterStatus': {
          if (!gameState?.wolfRobotReveal) break;

          if (pendingHunterStatusViewed) {
            roomScreenLog.debug('[wolfRobotViewHunterStatus] Skipping - pending submission');
            break;
          }

          if (currentSchema?.id !== 'wolfRobotLearn') {
            throw new Error(
              `[RoomScreen] wolfRobotViewHunterStatus intent received but currentSchema is ${currentSchema?.id}, expected wolfRobotLearn`,
            );
          }

          const dialogTitle = currentSchema.ui?.hunterGateDialogTitle;
          const canShootText = currentSchema.ui?.hunterGateCanShootText;
          const cannotShootText = currentSchema.ui?.hunterGateCannotShootText;

          if (!dialogTitle || !canShootText || !cannotShootText) {
            throw new Error(
              '[RoomScreen] wolfRobotLearn schema missing hunterGate UI fields - schema-driven UI requires these',
            );
          }

          const canShoot = gameState.wolfRobotReveal.canShootAsHunter === true;
          const statusMessage = canShoot ? canShootText : cannotShootText;

          actionDialogs.showRoleActionPrompt(dialogTitle, statusMessage, async () => {
            if (effectiveSeat === null) {
              roomScreenLog.warn(
                '[wolfRobotViewHunterStatus] Cannot submit without seat (effectiveSeat is null)',
              );
              return;
            }
            setPendingHunterStatusViewed(true);
            try {
              await sendWolfRobotHunterStatusViewed(effectiveSeat);
            } catch (error) {
              roomScreenLog.error('[wolfRobotViewHunterStatus] Failed to send confirmation', error);
              actionDialogs.showRoleActionPrompt(
                '确认失败',
                '状态确认发送失败，请稍后重试。如问题持续，请联系房主。',
                () => {},
              );
            } finally {
              setPendingHunterStatusViewed(false);
            }
          });
          break;
        }
      }
    },
    [
      gameState,
      effectiveRole,
      effectiveSeat,
      firstSwapSeat,
      actionDialogs,
      buildWitchStepResults,
      confirmThenAct,
      currentSchema,
      currentActionRole,
      getSubStepByKey,
      pendingHunterStatusViewed,
      proceedWithActionTyped,
      sendWolfRobotHunterStatusViewed,
      submitRevealAckSafe,
      submitWolfVote,
      setFirstSwapSeat,
      setSecondSeat,
      controlledSeat,
    ],
  );

  // ─── Auto-trigger intent (idempotent) ────────────────────────────────────

  useEffect(() => {
    // Guard: reset key when not in ongoing state or night ended
    if (roomStatus !== GameStatus.ongoing || !currentActionRole) {
      if (lastAutoIntentKeyRef.current !== null) {
        roomScreenLog.debug(' Clearing key (not ongoing or night ended)');
        lastAutoIntentKeyRef.current = null;
      }
      return;
    }

    // 音频播放中禁止自动触发 intent（gate 由 Facade 层管理）
    if (!imActioner || isAudioPlaying) return;

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
      roomScreenLog.debug(` Skipping duplicate: key=${key}`);
      return;
    }

    roomScreenLog.debug(` Triggering: key=${key}, intent=${autoIntent.type}`);
    lastAutoIntentKeyRef.current = key;
    handleActionIntent(autoIntent);
  }, [
    imActioner,
    isAudioPlaying,
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
