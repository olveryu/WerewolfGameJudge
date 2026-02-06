/**
 * RoomScreen - Main game room screen
 *
 * Refactored to use modular architecture:
 * - RoomScreen.helpers.ts (pure functions)
 * - hooks/ (useRoomInit, useRoomActions, useActionerState)
 * - components/PlayerGrid.tsx (seat grid display)
 *
 * All game state accessed through useGameRoom hook.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { GameStatus, getWolfVoteSummary, getPlayersNotViewedRole } from '../../models/Room';
import { buildNightPlan, getRoleDisplayName, getRoleSpec, Faction } from '../../models/roles';
import { showAlert } from '../../utils/alert';
import { useGameRoom } from '../../hooks/useGameRoom';
import { AudioService } from '../../services';
import type { LocalGameState } from '../../services/types/GameStateTypes';
import { HostControlButtons } from './HostControlButtons';
import { useRoomHostDialogs } from './useRoomHostDialogs';
import { useRoomActionDialogs } from './useRoomActionDialogs';
import { useRoomSeatDialogs } from './useRoomSeatDialogs';
import { PlayerGrid } from './components/PlayerGrid';
import { BoardInfoCard } from './components/BoardInfoCard';
import { ActionMessage } from './components/ActionMessage';
import { WaitingViewRoleList } from './components/WaitingViewRoleList';
import { ActionButton } from './components/ActionButton';
import { SeatConfirmModal } from './components/SeatConfirmModal';
import { NightProgressIndicator } from './components/NightProgressIndicator';
import { ControlledSeatBanner } from './components/ControlledSeatBanner';
import { HostMenuDropdown } from './components/HostMenuDropdown';
import {
  toGameRoomLike,
  getRoleStats,
  formatRoleList,
  buildSeatViewModels,
} from './RoomScreen.helpers';
import { getInteractionResult, getActorIdentity, isActorIdentityValid, type InteractionEvent, type InteractionContext } from './policy';
import { TESTIDS } from '../../testids';
import { useActionerState } from './hooks/useActionerState';
import { useRoomActions, ActionIntent } from './hooks/useRoomActions';
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import { roomScreenLog } from '../../utils/logger';
import type { ActionSchema, SchemaId, InlineSubStepSchema } from '../../models/roles/spec';
import { SCHEMAS, isValidSchemaId, BLOCKED_UI_DEFAULTS } from '../../models/roles/spec';
import { LoadingScreen } from '../../components/LoadingScreen';
import { RoleCardSimple } from '../../components/RoleCardSimple';
import {
  RoleRevealAnimator,
  createRoleData,
  type RoleData,
  type RevealEffectType,
} from '../../components/RoleRevealEffects';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../theme';
import { mobileDebug } from '../../utils/mobileDebug';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

export const RoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    roomNumber,
    isHost: isHostParam,
    template,
    roleRevealAnimation: initialRoleRevealAnimation,
  } = route.params;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Use the new game room hook
  const {
    gameState,
    isHost,
    mySeatNumber,
    myRole,
    myUid,
    roomStatus,
    currentActionRole,
    currentSchema,
    currentStepId,
    isAudioPlaying,
    resolvedRoleRevealAnimation,
    connectionStatus,
    error: gameRoomError,
    createRoom,
    joinRoom,
    leaveRoom,
    takeSeat,
    leaveSeat,
    assignRoles,
    startGame,
    restartGame,
    setRoleRevealAnimation,
    viewedRole,
    submitAction,
    submitWolfVote,
    hasWolfVoted,
    getLastNightInfo: getLastNightInfoFn,
    lastSeatError,
    clearLastSeatError,
    requestSnapshot,
    submitRevealAck,
    sendWolfRobotHunterStatusViewed,
    // Debug mode
    isDebugMode,
    fillWithBots,
    markAllBotsViewed,
    controlledSeat,
    setControlledSeat,
    effectiveSeat,
    effectiveRole,
  } = useGameRoom();

  // Check if there are any bots in the game (for showing bot mode hint)
  const hasBots = useMemo(() => {
    if (!gameState) return false;
    return Array.from(gameState.players.values()).some((p) => p?.isBot);
  }, [gameState]);

  // Night progress indicator: calculate current step index and total steps
  // Uses buildNightPlan to get the actual steps based on the template roles
  const nightProgress = useMemo(() => {
    if (!currentStepId || gameState?.status !== 'ongoing') {
      return null;
    }

    // Build night plan from template roles (same as Host uses)
    const nightPlan = buildNightPlan(gameState.template.roles);

    // Find current step index in the dynamically built plan
    const stepIndex = nightPlan.steps.findIndex((step) => step.stepId === currentStepId);
    if (stepIndex === -1) return null;

    const currentStep = nightPlan.steps[stepIndex];
    return {
      current: stepIndex + 1, // 1-based for display
      total: nightPlan.length,
      roleName: currentStep?.displayName,
    };
  }, [currentStepId, gameState]);

  // =========================================================================
  // PR7: 音频架构 - UI 只读 isAudioPlaying
  // 根据 copilot-instructions.md：
  // - Handler 声明音频 (PLAY_AUDIO sideEffect)
  // - Facade 执行音频 + gate
  // - UI 只读 gate，用于禁用交互
  // RoomScreen 不触发音频，不写 isAudioPlaying
  // =========================================================================

  const submitRevealAckSafe = useCallback(
    (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot') => {
      void submitRevealAck(role);
    },
    [submitRevealAck],
  );

  // Local UI state
  const [anotherIndex, setAnotherIndex] = useState<number | null>(null); // For Magician first seat
  const [secondSeatIndex, setSecondSeatIndex] = useState<number | null>(null); // For Magician second seat (temporary highlight)
  const [isStartingGame, setIsStartingGame] = useState(false); // Hide start button after clicking
  const [seatModalVisible, setSeatModalVisible] = useState(false);
  const [pendingSeatIndex, setPendingSeatIndex] = useState<number | null>(null);
  const [modalType, setModalType] = useState<'enter' | 'leave'>('enter');
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('加载房间...');
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [retryKey, setRetryKey] = useState(0); // 用于强制触发重试

  // Hidden debug panel trigger: tap title 5 times to show mobileDebug panel
  const debugTapCountRef = useRef(0);
  const debugTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDebugTitleTap = useCallback(() => {
    debugTapCountRef.current += 1;
    if (debugTapTimeoutRef.current) {
      clearTimeout(debugTapTimeoutRef.current);
    }
    if (debugTapCountRef.current >= 5) {
      debugTapCountRef.current = 0;
      mobileDebug.toggle();
    } else {
      debugTapTimeoutRef.current = setTimeout(() => {
        debugTapCountRef.current = 0;
      }, 2000);
    }
  }, []);

  // Refs for callback stability
  const gameStateRef = useRef<LocalGameState | null>(null);

  // Auto-trigger intent idempotency: prevent duplicate triggers in the same turn
  const lastAutoIntentKeyRef = useRef<string | null>(null);

  // P0-FIX: 追踪"正在等待/显示查验结果弹窗"的状态
  // 这样天亮弹窗（发言顺序）会等待查验结果弹窗关闭后再显示
  const [pendingRevealDialog, setPendingRevealDialog] = useState(false);

  // P1-FIX: 追踪"机械狼猎人状态确认正在提交"的状态
  // 防止 sendWolfRobotHunterStatusViewed 在 state 更新前被重复触发
  const [pendingHunterStatusViewed, setPendingHunterStatusViewed] = useState(false);

  // Keep gameStateRef in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const wolfVotesMap = useMemo(() => {
    const raw = gameState?.currentNightResults?.wolfVotesBySeat;
    if (!raw) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const [k, v] of Object.entries(raw as Record<string, number>)) {
      map.set(Number.parseInt(k, 10), v);
    }
    return map;
  }, [gameState?.currentNightResults]);

  // ───────────────────────────────────────────────────────────────────────────
  // Actor Identity: Single source of truth for UI action-related decisions
  // ───────────────────────────────────────────────────────────────────────────
  const actorIdentity = useMemo(
    () =>
      getActorIdentity({
        mySeatNumber,
        myRole,
        effectiveSeat,
        effectiveRole,
        controlledSeat,
      }),
    [mySeatNumber, myRole, effectiveSeat, effectiveRole, controlledSeat],
  );

  const { actorSeatForUi, actorRoleForUi, isDelegating } = actorIdentity;

  // FAIL-FAST observability: Log warning when delegating but identity is invalid
  // This helps debugging "can't click anything" issues in debug bot mode
  useEffect(() => {
    if (isDelegating && !isActorIdentityValid(actorIdentity)) {
      roomScreenLog.warn('[ActorIdentity] Invalid delegation state detected', {
        controlledSeat,
        effectiveSeat,
        effectiveRole,
        actorSeatForUi,
        actorRoleForUi,
        hint: 'effectiveSeat should equal controlledSeat when delegating',
      });
    }
  }, [isDelegating, actorIdentity, controlledSeat, effectiveSeat, effectiveRole, actorSeatForUi, actorRoleForUi]);

  // Computed values: use useActionerState hook
  // Use actorSeatForUi/actorRoleForUi for action-related decisions
  const { imActioner, showWolves } = useActionerState({
    myRole: actorRoleForUi,
    currentActionRole,
    currentSchema,
    mySeatNumber: actorSeatForUi,
    wolfVotes: wolfVotesMap,
    isHost,
    actions: gameState?.actions ?? new Map(),
  });

  // Extract schema constraints for chooseSeat/swap schemas (non-compound).
  // Compound schemas (witch) have fixed targets or step-specific handling.
  const currentSchemaConstraints = useMemo(() => {
    if (!currentSchema) return undefined;
    // Only chooseSeat and swap schemas have constraints that affect seat selection
    if (currentSchema.kind === 'chooseSeat' || currentSchema.kind === 'swap') {
      return currentSchema.constraints;
    }
    return undefined;
  }, [currentSchema]);

  // Build seat view models for PlayerGrid
  // Uses actorSeatForUi to highlight the actor's seat (bot seat when delegating)
  const seatViewModels = useMemo(() => {
    if (!gameState) return [];

    // Bug fix: After wolfRobot learns (wolfRobotReveal exists), all seat taps
    // should have NO effect - no dialogs, no actions. Skip schema constraints
    // entirely so that PlayerGrid won't show "不能选择自己" alert for self-tap.
    const skipConstraints =
      currentSchema?.id === 'wolfRobotLearn' && gameState.wolfRobotReveal != null;

    return buildSeatViewModels(gameState, actorSeatForUi, showWolves, anotherIndex, {
      // Schema-driven constraints (notSelf, etc.) - UX-only early rejection
      // Skip when wolfRobot learning is complete (no seat should be tappable)
      schemaConstraints: imActioner && !skipConstraints ? currentSchemaConstraints : undefined,
      // For magician swap: highlight the second seat being selected
      secondSelectedIndex: secondSeatIndex,
    });
  }, [
    gameState,
    actorSeatForUi,
    showWolves,
    anotherIndex,
    secondSeatIndex,
    imActioner,
    currentSchemaConstraints,
    currentSchema?.id,
  ]);

  // Calculate role statistics using helper
  const { roleCounts, wolfRoles, godRoles, specialRoles, villagerCount } = useMemo(() => {
    if (!gameState) {
      return { roleCounts: {}, wolfRoles: [], godRoles: [], specialRoles: [], villagerCount: 0 };
    }
    return getRoleStats(gameState.template.roles);
  }, [gameState]);

  // Show alert when seat request is rejected (BUG-2 fix)
  useEffect(() => {
    if (lastSeatError) {
      showAlert('入座失败', '该座位已被占用，请选择其他位置。');
      clearLastSeatError();
    }
  }, [lastSeatError, clearLastSeatError]);

  // Initialize room on mount (host creates, player joins)
  useEffect(() => {
    if (isInitialized) return;

    const initRoom = async () => {
      setLoadingMessage('正在初始化...');

      if (isHostParam && template) {
        // Host creates room with the provided roomNumber from ConfigScreen
        setLoadingMessage('正在创建房间...');
        const createdRoomNumber = await createRoom(template, roomNumber);

        if (createdRoomNumber) {
          // Set role reveal animation if provided from ConfigScreen
          if (initialRoleRevealAnimation) {
            await setRoleRevealAnimation(initialRoleRevealAnimation);
          }
          // Host auto-takes seat 0
          setLoadingMessage('正在入座...');
          await takeSeat(0);
          setIsInitialized(true);
        } else {
          setLoadingMessage('创建失败');
          setShowRetryButton(true);
        }
      } else {
        // Player joins existing room via BroadcastService
        setLoadingMessage('正在加入房间...');
        const joined = await joinRoom(roomNumber);

        if (joined) {
          setIsInitialized(true);
        } else {
          setLoadingMessage('加入房间失败');
          setShowRetryButton(true);
        }
      }
    };

    initRoom();
    // retryKey 变化时也会触发重试
  }, [
    isInitialized,
    retryKey,
    isHostParam,
    template,
    roomNumber,
    createRoom,
    joinRoom,
    takeSeat,
    initialRoleRevealAnimation,
    setRoleRevealAnimation,
  ]);

  // Reset UI state when game restarts
  useEffect(() => {
    if (!gameState) return;

    if (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) {
      setIsStartingGame(false);
      setAnotherIndex(null); // Reset magician state
    }
  }, [gameState, roomStatus]);

  // Loading timeout
  useEffect(() => {
    if (isInitialized && gameState) {
      setShowRetryButton(false);
      return;
    }

    const timeout = setTimeout(() => {
      if (!isInitialized || !gameState) {
        setShowRetryButton(true);
        setLoadingMessage('加载超时');
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isInitialized, gameState]);

  // ───────────────────────────────────────────────────────────────────────────
  // Intent Layer: useRoomActions
  // ───────────────────────────────────────────────────────────────────────────

  const gameContext = useMemo(
    () => ({
      gameState,
      roomStatus,
      currentActionRole,
      currentSchema,
      imActioner,
      actorSeatNumber: actorSeatForUi,
      actorRole: actorRoleForUi,
      isAudioPlaying,
      anotherIndex,
    }),
    [
      gameState,
      roomStatus,
      currentActionRole,
      currentSchema,
      imActioner,
      actorSeatForUi,
      actorRoleForUi,
      isAudioPlaying,
      anotherIndex,
    ],
  );

  const actionDeps = useMemo(
    () => ({
      hasWolfVoted,
      getWolfVoteSummary: () =>
        gameState ? getWolfVoteSummary(toGameRoomLike(gameState)) : '0/0 狼人已投票',
      getWitchContext: () => gameState?.witchContext ?? null,
    }),
    [gameState, hasWolfVoted],
  );

  const {
    getActionIntent,
    getAutoTriggerIntent,
    findVotingWolfSeat,
    getWolfStatusLine,
    getBottomAction,
  } = useRoomActions(gameContext, actionDeps);

  // ───────────────────────────────────────────────────────────────────────────
  // Dialog Layer: useRoomActionDialogs + useRoomSeatDialogs
  // ───────────────────────────────────────────────────────────────────────────

  const actionDialogs = useRoomActionDialogs();

  // Cleanup callback for leaving room - MUST call leaveRoom() to abort async operations
  const handleLeaveRoomCleanup = useCallback(() => {
    roomScreenLog.debug('handleLeaveRoomCleanup: calling leaveRoom + cleanup');
    // P0 fix: leaveRoom() sets abort flag to stop ongoing async operations (e.g., audio queue)
    // This also cleans up facade state, presence, etc.
    void leaveRoom();
    // Also cleanup audio (stops current player + BGM immediately)
    AudioService.getInstance().cleanup();
  }, [leaveRoom]);

  const seatDialogs = useRoomSeatDialogs({
    pendingSeatIndex,
    setPendingSeatIndex,
    setSeatModalVisible,
    setModalType,
    takeSeat,
    leaveSeat,
    roomStatus,
    navigation,
    onLeaveRoom: handleLeaveRoomCleanup,
  });

  const {
    showEnterSeatDialog,
    showLeaveSeatDialog,
    handleConfirmSeat,
    handleCancelSeat,
    handleConfirmLeave,
    handleLeaveRoom,
  } = seatDialogs;

  // ───────────────────────────────────────────────────────────────────────────
  // Execution Layer: proceedWithAction
  // Action rejection is now checked via gameState.actionRejected after state update.
  // ───────────────────────────────────────────────────────────────────────────

  const proceedWithAction = useCallback(
    async (targetIndex: number | null, extra?: any): Promise<boolean> => {
      await submitAction(targetIndex, extra);

      // Submission success/failure UX is handled by the state-driven
      // `gameState.actionRejected` effect below (covers submitAction + submitWolfVote).
      // Return true here to keep callers progressing; Host rejection will be surfaced
      // asynchronously via broadcast.
      return true;
    },
    [submitAction],
  );

  // ---------------------------------------------------------------------------
  // Unified rejection UX (Host-authoritative)
  //
  // NOTE: Do NOT rely on submitAction-only plumbing.
  // WOLF_VOTE is submitted via submitWolfVote(), so we surface actionRejected
  // via a state-driven effect for ALL action types.
  // ---------------------------------------------------------------------------

  const lastRejectedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const rejected = gameState?.actionRejected;
    if (!rejected) {
      lastRejectedKeyRef.current = null;
      return;
    }

    // In debug mode, Host controls bot seats, so also check effectiveSeat's uid
    const effectiveUid =
      effectiveSeat === null ? null : gameState?.players.get(effectiveSeat)?.uid;
    const isTargetMatch = rejected.targetUid === myUid || rejected.targetUid === effectiveUid;
    if (!myUid || !isTargetMatch) return;

    // Deduplicate repeated broadcasts of the same rejection
    // Prefer a unique rejection id so repeated errors with the same reason still show.
    const key =
      (rejected as { rejectionId?: string }).rejectionId ??
      `${rejected.action}:${rejected.reason}:${rejected.targetUid}`;
    if (key === lastRejectedKeyRef.current) return;
    lastRejectedKeyRef.current = key;

    actionDialogs.showActionRejectedAlert(rejected.reason);
  }, [gameState?.actionRejected, gameState?.players, myUid, effectiveSeat, actionDialogs]);

  // ---------------------------------------------------------------------------------
  // Action extra typing (UI -> Host wire payload)
  //
  // NOTE: The transport currently uses an untyped `extra?: any` field.
  // We keep it type-safe on the UI side by narrowing locally.
  // ---------------------------------------------------------------------------------

  type WitchStepResults = { save: number | null; poison: number | null };
  type ActionExtra = { stepResults: WitchStepResults } | { targets: readonly [number, number] }; // swap protocol: [seatA, seatB]

  // Schema lookup helper (used internally)
  const _getSchemaById = useCallback((id: string): ActionSchema | null => {
    if (!isValidSchemaId(id)) return null;
    const schemaId: SchemaId = id;
    return SCHEMAS[schemaId] ?? null;
  }, []);

  /**
   * Get a compound sub-step by key (e.g., 'save', 'poison' for witchAction).
   * Returns the InlineSubStepSchema or null if not found.
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
   * @param opts.saveTarget - seat to save (or null to skip save)
   * @param opts.poisonTarget - seat to poison (or null to skip poison)
   */
  const buildWitchStepResults = useCallback(
    (opts: { saveTarget: number | null; poisonTarget: number | null }): ActionExtra => {
      return { stepResults: { save: opts.saveTarget, poison: opts.poisonTarget } };
    },
    [],
  );

  const proceedWithActionTyped = useCallback(
    async (targetIndex: number | null, extra?: ActionExtra): Promise<boolean> => {
      return proceedWithAction(targetIndex, extra);
    },
    [proceedWithAction],
  );

  // UI-only helpers: keep confirm copy schema-driven and avoid repeating the same fallback logic.
  const getConfirmTitleForSchema = useCallback((): string => {
    return currentSchema?.kind === 'chooseSeat'
      ? currentSchema.ui?.confirmTitle || '确认行动'
      : '确认行动';
  }, [currentSchema]);

  const getConfirmTextForSeatAction = useCallback(
    (targetIndex: number): string => {
      return currentSchema?.kind === 'chooseSeat'
        ? currentSchema.ui?.confirmText || `是否对${targetIndex + 1}号玩家使用技能？`
        : `是否对${targetIndex + 1}号玩家使用技能？`;
    },
    [currentSchema],
  );

  const confirmThenAct = useCallback(
    (
      targetIndex: number,
      onAccepted: () => Promise<void> | void,
      opts?: { title?: string; message?: string },
    ) => {
      const title = opts?.title ?? getConfirmTitleForSchema();
      const message = opts?.message ?? getConfirmTextForSeatAction(targetIndex);

      actionDialogs.showConfirmDialog(title, message, async () => {
        const accepted = await proceedWithActionTyped(targetIndex);
        if (!accepted) return;
        await onAccepted();
      });
    },
    [actionDialogs, getConfirmTextForSeatAction, getConfirmTitleForSchema, proceedWithActionTyped],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Intent Handler (Orchestrator)
  // ───────────────────────────────────────────────────────────────────────────

  const handleActionIntent = useCallback(
    async (intent: ActionIntent) => {
      switch (intent.type) {
        // NOTE: 'blocked' intent type has been removed.
        // Nightmare block is now handled by Host resolver.
        // UI submits action → Host validates → ACTION_REJECTED if blocked.

        case 'magicianFirst':
          setAnotherIndex(intent.targetIndex);
          actionDialogs.showMagicianFirstAlert(intent.targetIndex);
          break;

        case 'reveal': {
          if (!gameState) return;
          if (!intent.revealKind) {
            roomScreenLog.warn(' reveal intent missing revealKind');
            return;
          }

          const revealKind = intent.revealKind;

          // Get reveal data from gameState after action is processed
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

          confirmThenAct(intent.targetIndex, async () => {
            // P0-FIX: 用户确认后设置 pending 状态，阻止天亮弹窗在查验结果显示之前出现
            // 必须在回调内设置，因为用户可能取消确认弹窗
            setPendingRevealDialog(true);

            // Wait for state to propagate with retry (React batch updates may delay ref update)
            const maxRetries = 10;
            const retryInterval = 50;
            let reveal: { targetSeat: number; result: string } | undefined;

            for (let i = 0; i < maxRetries; i++) {
              await new Promise((resolve) => setTimeout(resolve, retryInterval));
              reveal = getRevealData();
              if (reveal) break;
            }

            if (reveal) {
              // Seer result is already Chinese ('好人'/'狼人'), others are RoleId
              const displayResult =
                revealKind === 'seer' ? reveal.result : getRoleDisplayName(reveal.result);
              actionDialogs.showRevealDialog(
                `${reveal.targetSeat + 1}号是${displayResult}`,
                '',
                () => {
                  submitRevealAckSafe(revealKind);
                  // P0-FIX: 用户确认后清除 pending 状态，允许天亮弹窗显示
                  setPendingRevealDialog(false);
                },
              );
            } else {
              roomScreenLog.warn(
                ` ${revealKind}Reveal timeout - no reveal received after ${maxRetries * retryInterval}ms`,
              );
              // P0-FIX: 超时也要清除 pending 状态
              setPendingRevealDialog(false);
            }
          });
          break;
        }

        case 'wolfVote':
          {
            // P0-FIX: UI 不再做"是否允许投票/是否已投票"的业务校验。
            // 仅检查提交身份是否存在（effectiveSeat）；其他校验由 Host resolver 处理。
            // intent.wolfSeat 已在 useRoomActions 中用 actorSeatNumber（即 actorSeatForUi）填充。
            const seat = intent.wolfSeat ?? effectiveSeat;
            roomScreenLog.info('[handleActionIntent] wolfVote:', {
              'intent.wolfSeat': intent.wolfSeat,
              effectiveSeat,
              effectiveRole,
              controlledSeat,
              seat,
              targetIndex: intent.targetIndex,
            });
            // 仅当提交身份不存在时阻断（未入座无法提交）
            if (seat === null) {
              roomScreenLog.warn(
                '[handleActionIntent] wolfVote: effectiveSeat is null, cannot submit.',
                { effectiveSeat, effectiveRole, controlledSeat },
              );
              return;
            }
            actionDialogs.showWolfVoteDialog(
              `${seat + 1}号狼人`,
              intent.targetIndex,
              () => void submitWolfVote(intent.targetIndex),
              // Schema-driven copy: prefer schema.ui.confirmText (contract-enforced)
              // NOTE: target immune rule is Host-authoritative; we only add a UX hint here to avoid confusion.
              (() => {
                const base = currentSchema?.ui?.confirmText;
                const targetRole = gameStateRef.current?.players?.get(intent.targetIndex)?.role;
                if (currentSchema?.id !== 'wolfKill' || !targetRole) return base;
                // Local import would create layering issues; use a lightweight string hint only.
                // The real validation still happens in wolfKillResolver (Host-only).
                const immune = targetRole === 'spiritKnight' || targetRole === 'wolfQueen';
                return immune ? `${base ?? ''}\n（提示：该角色免疫狼刀，Host 会拒绝）` : base;
              })(),
            );
          }
          break;

        case 'actionConfirm':
          // DEBUG: Log actionConfirm handling details
          roomScreenLog.debug('[actionConfirm] Processing:', {
            effectiveRole,
            anotherIndex,
            schemaKind: currentSchema?.kind,
            schemaId: currentSchema?.id,
            'intent.targetIndex': intent.targetIndex,
            'intent.stepKey': intent.stepKey,
            mySeatNumber,
          });

          if (effectiveRole === 'magician' && anotherIndex !== null) {
            // protocol: target = null, extra.targets = [seatA, seatB]
            const swapTargets: [number, number] = [anotherIndex, intent.targetIndex];
            // Highlight both seats during confirmation dialog
            setSecondSeatIndex(intent.targetIndex);
            // Use setTimeout to allow React to re-render before showing dialog
            setTimeout(() => {
              actionDialogs.showConfirmDialog(
                currentSchema?.ui?.confirmTitle || '确认交换',
                intent.message || `确定交换${anotherIndex + 1}号和${intent.targetIndex + 1}号?`,
                () => {
                  setAnotherIndex(null);
                  setSecondSeatIndex(null);
                  void proceedWithActionTyped(null, { targets: swapTargets });
                },
                () => {
                  // User cancelled - reset both seats for re-selection
                  setAnotherIndex(null);
                  setSecondSeatIndex(null);
                },
              );
            }, 0);
          } else {
            // Handle based on schema kind:
            // - compound (witch): protocol uses seat=actorSeat, target info in stepResults
            // - chooseSeat (nightmare/seer/guard/etc): protocol uses target=intent.targetIndex
            const stepSchema = getSubStepByKey(intent.stepKey);
            let extra: ActionExtra | undefined;
            let targetToSubmit: number | null;

            if (currentSchema?.kind === 'compound') {
              // Compound schema (witch): target = actorSeat, real targets in extra.stepResults
              // Use effectiveSeat (supports both normal play and debug/bot takeover mode)
              // FAIL-FAST: If effectiveSeat is null, player is not seated and cannot act.
              if (effectiveSeat === null) {
                roomScreenLog.warn('[actionConfirm] Cannot submit compound action without seat (effectiveSeat is null)');
                return;
              }
              targetToSubmit = effectiveSeat;
              if (stepSchema?.key === 'save') {
                extra = buildWitchStepResults({ saveTarget: intent.targetIndex, poisonTarget: null });
              } else if (stepSchema?.key === 'poison') {
                extra = buildWitchStepResults({ saveTarget: null, poisonTarget: intent.targetIndex });
              }
            } else {
              // chooseSeat schema: target = user-selected seat (intent.targetIndex)
              targetToSubmit = intent.targetIndex;
            }

            // DEBUG: Log what we're about to submit
            roomScreenLog.debug('[actionConfirm] Submitting:', {
              schemaKind: currentSchema?.kind,
              targetToSubmit,
              'intent.targetIndex': intent.targetIndex,
              extra,
            });

            actionDialogs.showConfirmDialog(
              stepSchema?.ui?.confirmTitle || currentSchema?.ui?.confirmTitle || '确认行动',
              stepSchema?.ui?.confirmText || intent.message || '',
              () => void proceedWithActionTyped(targetToSubmit, extra),
            );
          }
          break;

        case 'skip': {
          // Special handling for confirm schema (hunter/darkWolfKing) blocked skip
          if (currentSchema?.kind === 'confirm') {
            actionDialogs.showConfirmDialog(
              '确认跳过',
              intent.message || BLOCKED_UI_DEFAULTS.skipButtonText,
              () => void proceedWithActionTyped(null, { confirmed: false } as any),
            );
            break;
          }

          // Witch/compound: protocol - skip means stepResults with all null
          // seat = actorSeat (mySeatNumber)
          const skipStepSchema = getSubStepByKey(intent.stepKey);
          let skipExtra: ActionExtra | undefined;
          let skipSeat: number | null = null; // default for chooseSeat: null

          if (intent.stepKey === 'skipAll' || currentSchema?.kind === 'compound') {
            // Compound schema: skip uses actorSeat + stepResults with all null
            // Use effectiveSeat (supports both normal play and debug/bot takeover mode)
            // FAIL-FAST: If effectiveSeat is null, player is not seated and cannot act.
            if (effectiveSeat === null) {
              roomScreenLog.warn('[skip] Cannot submit compound skip without seat (effectiveSeat is null)');
              return;
            }
            skipExtra = buildWitchStepResults({ saveTarget: null, poisonTarget: null });
            skipSeat = effectiveSeat;
          }

          // FAIL-FAST: skip confirmText must come from schema or intent
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
          // ─────────────────────────────────────────────────────────────────
          // UI Hint（Host 广播驱动，UI 只读展示）
          // 如果 Host 广播了 promptOverride，直接显示覆盖后的 prompt。
          // 使用 targetRoleIds 过滤：只有 effectiveRole 在 targetRoleIds 中才显示 hint。
          // 注意：使用 effectiveRole 而非 myRole，以支持 debug/bot 模式下 Host 代操作。
          // ─────────────────────────────────────────────────────────────────
          const hint = gameState?.ui?.currentActorHint;
          const hintApplies = hint && effectiveRole && hint.targetRoleIds.includes(effectiveRole);
          // DEBUG: 临时调试日志
          roomScreenLog.debug('[actionPrompt] UI Hint check', {
            hint: hint ? { kind: hint.kind, targetRoleIds: hint.targetRoleIds, bottomAction: hint.bottomAction } : null,
            effectiveRole,
            hintApplies,
            'gameState.ui': gameState?.ui,
          });
          if (hintApplies && hint.promptOverride) {
            actionDialogs.showRoleActionPrompt(
              hint.promptOverride.title || '技能被封锁',
              hint.promptOverride.text || hint.message,
              () => {
                // Dismiss callback: 与其他 prompt 一致，关闭后等待用户操作底部按钮
                // 底部按钮已经被 hint.bottomAction 控制为 skipOnly/wolfEmptyOnly
              },
            );
            break;
          }

          // Schema-driven prompt.
          // WitchAction uses witchContext from gameState for dynamic info; template copy comes from schema.
          if (currentSchema?.kind === 'compound' && currentSchema.id === 'witchAction') {
            const witchCtx = gameState?.witchContext;
            if (!witchCtx) return;
            actionDialogs.showWitchInfoPrompt(witchCtx, currentSchema, () => {
              // dismiss → do nothing, wait for user to tap seat / use bottom buttons
            });
            break;
          }

          // confirm schema (hunter/darkWolfKing): show standard prompt
          // NOTE: Nightmare block is now handled by Host resolver.
          // UI no longer shows blocked prompt here. Action goes through submit → Host validates.
          if (currentSchema?.kind === 'confirm') {
            // FAIL-FAST: schema.ui.prompt must exist for confirm schema
            if (!currentSchema.ui?.prompt) {
              throw new Error(
                `[FAIL-FAST] Missing schema.ui.prompt for confirm schema: ${currentActionRole}`,
              );
            }
            actionDialogs.showRoleActionPrompt('行动提示', currentSchema.ui.prompt, () => {});
            break;
          }

          // Generic action prompt for all other roles (dismiss → wait for seat tap)
          // FAIL-FAST: schema.ui.prompt must exist for all action schemas
          if (!currentSchema?.ui?.prompt) {
            throw new Error(`[FAIL-FAST] Missing schema.ui.prompt for role: ${currentActionRole}`);
          }
          actionDialogs.showRoleActionPrompt('行动提示', currentSchema.ui.prompt, () => {
            // dismiss → do nothing, wait for user to tap seat
          });
          break;
        }

        case 'confirmTrigger': {
          // Hunter/DarkWolfKing: show status dialog (can shoot or not), then submit action
          // Status comes from gameState.confirmStatus (Host computed and broadcast)
          if (!gameState) break;

          // Schema-driven UI: get text from currentSchema (hunterConfirm or darkWolfKingConfirm)
          // Fail-fast if schema missing required status dialog fields
          if (
            !currentSchema?.ui?.statusDialogTitle ||
            !currentSchema?.ui?.canShootText ||
            !currentSchema?.ui?.cannotShootText
          ) {
            throw new Error(
              `[RoomScreen] confirmTrigger schema missing status dialog UI fields for ${currentSchema?.id}`,
            );
          }

          // Get status from gameState (Host computed)
          const confirmStatus = gameState.confirmStatus;

          let canShoot = true; // Default if no status (shouldn't happen in normal flow)

          if (effectiveRole === 'hunter') {
            if (confirmStatus?.role === 'hunter') {
              canShoot = confirmStatus.canShoot;
            }
          } else if (effectiveRole === 'darkWolfKing') {
            if (confirmStatus?.role === 'darkWolfKing') {
              canShoot = confirmStatus.canShoot;
            }
          }

          // Schema-driven: use schema text directly (no string concatenation)
          const dialogTitle = currentSchema.ui.statusDialogTitle;
          const statusMessage = canShoot
            ? currentSchema.ui.canShootText
            : currentSchema.ui.cannotShootText;

          // Show info dialog with status, then submit action when user acknowledges
          // IMPORTANT: Pass confirmed=true to satisfy Host block guard
          // Use effectiveSeat (supports both normal play and debug/bot takeover mode)
          // FAIL-FAST: If effectiveSeat is null, player is not seated and cannot act.
          if (effectiveSeat === null) {
            roomScreenLog.warn('[confirmTrigger] Cannot submit confirm action without seat (effectiveSeat is null)');
            return;
          }
          actionDialogs.showRoleActionPrompt(
            dialogTitle,
            statusMessage,
            () => void proceedWithActionTyped(effectiveSeat, { confirmed: true } as any),
          );
          break;
        }

        case 'wolfRobotViewHunterStatus': {
          // WolfRobot learned hunter: show status dialog, then set gate
          if (!gameState?.wolfRobotReveal) break;

          // P1-FIX: 防重入 - 如果正在提交确认，跳过
          if (pendingHunterStatusViewed) {
            roomScreenLog.debug('[wolfRobotViewHunterStatus] Skipping - pending submission');
            break;
          }

          // Schema-driven UI: use currentSchema (must be wolfRobotLearn at this point)
          // Assert schema consistency to catch refactoring errors early
          if (currentSchema?.id !== 'wolfRobotLearn') {
            throw new Error(
              `[RoomScreen] wolfRobotViewHunterStatus intent received but currentSchema is ${currentSchema?.id}, expected wolfRobotLearn`,
            );
          }

          // Read all texts from currentSchema.ui (fail-fast if missing)
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
            // P1-FIX: 设置 pending 状态并 await 确保 state 更新后再释放
            setPendingHunterStatusViewed(true);
            try {
              await sendWolfRobotHunterStatusViewed();
            } catch (error) {
              // P1-FIX: 失败时给用户可见提示，避免用户误以为没点成功而反复操作
              roomScreenLog.error('[wolfRobotViewHunterStatus] Failed to send confirmation', error);
              actionDialogs.showRoleActionPrompt(
                '确认失败',
                '状态确认发送失败，请稍后重试。如问题持续，请联系房主。',
                () => {
                  // 用户知悉后关闭
                },
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
      anotherIndex,
      actionDialogs,
      buildWitchStepResults,
      confirmThenAct,
      currentSchema,
      currentActionRole,
      findVotingWolfSeat,
      getSubStepByKey,
      hasWolfVoted,
      pendingHunterStatusViewed,
      proceedWithActionTyped,
      sendWolfRobotHunterStatusViewed,
      submitRevealAckSafe,
      submitWolfVote,
    ],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Auto-trigger intent (with idempotency to prevent duplicate triggers)
  // ───────────────────────────────────────────────────────────────────────────

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
    // P0-FIX: actorSeatForUi 必须在 key 中，否则同一 wolfVote step 内
    // 切换 controlledSeat 到另一个狼人时 key 不变，prompt 被判重跳过。
    const key = [
      roomStatus,
      gameState?.currentActionerIndex ?? 'null',
      currentActionRole ?? 'null',
      actorSeatForUi ?? 'null',
      imActioner ? 'A' : 'N',
      isAudioPlaying ? 'P' : 'S',
      effectiveRole ?? 'null',
      anotherIndex ?? 'null',
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
    anotherIndex,
    roomStatus,
    currentActionRole,
    gameState?.currentActionerIndex,
    getAutoTriggerIntent,
    handleActionIntent,
  ]);

  // ───────────────────────────────────────────────────────────────────────────
  // Seat tap handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleSeatingTap = useCallback(
    (index: number) => {
      if (mySeatNumber !== null && index === mySeatNumber) {
        showLeaveSeatDialog(index);
      } else {
        showEnterSeatDialog(index);
      }
    },
    [mySeatNumber, showLeaveSeatDialog, showEnterSeatDialog],
  );

  const handleActionTap = useCallback(
    (index: number) => {
      const intent = getActionIntent(index);
      if (intent) {
        handleActionIntent(intent);
      }
    },
    [getActionIntent, handleActionIntent],
  );

  // Host dialog callbacks from hook (must be declared before dispatchInteraction)
  const {
    showPrepareToFlipDialog,
    showStartGameDialog,
    showLastNightInfoDialog,
    showRestartDialog,
    showSpeakOrderDialog,
    handleSettingsPress,
  } = useRoomHostDialogs({
    gameState,
    assignRoles,
    startGame,
    restartGame,
    getLastNightInfo: getLastNightInfoFn,
    setIsStartingGame,
    navigation,
    roomNumber,
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Build InteractionContext for policy decisions
  // ───────────────────────────────────────────────────────────────────────────
  const interactionContext: InteractionContext = useMemo(
    () => ({
      roomStatus,
      hasGameState: !!gameState,
      isAudioPlaying,
      pendingRevealAck: pendingRevealDialog,
      pendingHunterGate: pendingHunterStatusViewed,
      isHost,
      imActioner,
      // Real identity (for display purposes only)
      mySeatNumber,
      myRole,
      // Actor identity (for all action-related decisions)
      actorSeatForUi,
      actorRoleForUi,
      // Debug mode fields
      isDebugMode,
      controlledSeat,
      isDelegating,
      getBotSeats: () => {
        if (!gameState) return [];
        return Array.from(gameState.players.entries())
          .filter(([, player]) => player?.isBot)
          .map(([seatIndex]) => seatIndex);
      },
    }),
    [
      roomStatus,
      gameState,
      isAudioPlaying,
      pendingRevealDialog,
      pendingHunterStatusViewed,
      isHost,
      imActioner,
      mySeatNumber,
      myRole,
      actorSeatForUi,
      actorRoleForUi,
      isDebugMode,
      controlledSeat,
      isDelegating,
    ],
  );

  /**
   * Unified interaction dispatcher using RoomInteractionPolicy.
   *
   * This is the single entry point for all user interactions.
   * It calls the pure policy function and executes the resulting instruction.
   *
   * Integrated: SEAT_TAP, BOTTOM_ACTION, VIEW_ROLE, LEAVE_ROOM, HOST_CONTROL,
   *             REVEAL_ACK, WOLF_ROBOT_HUNTER_STATUS_VIEWED
   */
  const dispatchInteraction = useCallback(
    (event: InteractionEvent) => {
      const result = getInteractionResult(interactionContext, event);

      switch (result.kind) {
        case 'NOOP':
          // Do nothing - blocked by gate or not applicable
          roomScreenLog.debug('[dispatchInteraction] NOOP', {
            reason: result.reason,
            event: event.kind,
          });
          return;

        case 'ALERT':
          showAlert(result.title, result.message, [{ text: '好' }]);
          return;

        case 'SHOW_DIALOG':
          switch (result.dialogType) {
            case 'seatingEnter':
              if (result.seatIndex !== undefined) showEnterSeatDialog(result.seatIndex);
              return;
            case 'seatingLeave':
              if (result.seatIndex !== undefined) showLeaveSeatDialog(result.seatIndex);
              return;
            case 'roleCard':
              {
                // P0-FIX: 使用 effectiveSeat 获取当前接管身份的 hasViewedRole 状态
                // 接管模式下看的是 bot 的身份，非接管时看的是自己的身份
                const effectivePlayer =
                  effectiveSeat === null ? null : gameState?.players.get(effectiveSeat);
                const needAnimation = !(effectivePlayer?.hasViewedRole ?? false);
                setShouldPlayRevealAnimation(needAnimation);
                setRoleCardVisible(true);
                void viewedRole();
              }
              return;
            case 'leaveRoom':
              handleLeaveRoom();
              return;
          }
          return;

        case 'SEATING_FLOW':
          handleSeatingTap(result.seatIndex);
          return;

        case 'ACTION_FLOW':
          if (result.intent) {
            handleActionIntent(result.intent);
          } else if (result.seatIndex !== undefined) {
            handleActionTap(result.seatIndex);
          }
          return;

        case 'HOST_CONTROL':
          switch (result.action) {
            case 'settings':
              handleSettingsPress();
              return;
            case 'prepareToFlip':
              showPrepareToFlipDialog();
              return;
            case 'startGame':
              showStartGameDialog();
              return;
            case 'lastNightInfo':
              showLastNightInfoDialog();
              return;
            case 'restart':
              showRestartDialog();
              return;
          }
          return;

        case 'REVEAL_ACK':
          submitRevealAckSafe(result.revealRole);
          // Clear the reveal gate after ack
          setPendingRevealDialog(false);
          return;

        case 'HUNTER_STATUS_VIEWED':
          void sendWolfRobotHunterStatusViewed();
          return;

        case 'TAKEOVER_BOT_SEAT':
          setControlledSeat(result.seatIndex);
          return;

        case 'RELEASE_BOT_SEAT':
          setControlledSeat(null);
          return;
      }
    },
    [
      interactionContext,
      handleSeatingTap,
      handleActionTap,
      handleActionIntent,
      showEnterSeatDialog,
      showLeaveSeatDialog,
      handleLeaveRoom,
      viewedRole,
      handleSettingsPress,
      showPrepareToFlipDialog,
      showStartGameDialog,
      showLastNightInfoDialog,
      showRestartDialog,
      submitRevealAckSafe,
      sendWolfRobotHunterStatusViewed,
      setControlledSeat,
    ],
  );

  /**
   * Main seat tap handler - delegates to dispatchInteraction.
   */
  const onSeatTapped = useCallback(
    (index: number, disabledReason?: string) => {
      dispatchInteraction({ kind: 'SEAT_TAP', seatIndex: index, disabledReason });
    },
    [dispatchInteraction],
  );

  /**
   * Seat long-press handler for bot takeover (debug mode).
   */
  const onSeatLongPressed = useCallback(
    (seatIndex: number) => {
      dispatchInteraction({ kind: 'TAKEOVER_BOT_SEAT', seatIndex });
    },
    [dispatchInteraction],
  );

  // Role card modal state
  const [roleCardVisible, setRoleCardVisible] = useState(false);
  // 记录本次打开是否需要播放动画（在打开时根据 hasViewedRole 决定，避免状态更新后丢失）
  const [shouldPlayRevealAnimation, setShouldPlayRevealAnimation] = useState(false);

  const handleRoleCardClose = useCallback(() => {
    setRoleCardVisible(false);
    setShouldPlayRevealAnimation(false);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Host: Show speaking order dialog when night ends (after audio finishes)
  // ───────────────────────────────────────────────────────────────────────────
  const hasShownSpeakOrderRef = useRef(false);

  useEffect(() => {
    // Only show once per game, only for host, only when game ended and audio finished
    // P0-FIX: 等待查验结果弹窗关闭后再显示发言顺序弹窗
    if (
      !isHost ||
      roomStatus !== GameStatus.ended ||
      isAudioPlaying ||
      pendingRevealDialog ||
      hasShownSpeakOrderRef.current
    )
      return;

    hasShownSpeakOrderRef.current = true;
    showSpeakOrderDialog();
  }, [isHost, roomStatus, isAudioPlaying, pendingRevealDialog, showSpeakOrderDialog]);

  // Reset speak order flag when game restarts
  useEffect(() => {
    if (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) {
      hasShownSpeakOrderRef.current = false;
    }
  }, [roomStatus]);

  // Loading state
  if (!isInitialized || !gameState) {
    // Determine the display message: prefer specific error over generic loading message
    const displayMessage = showRetryButton && gameRoomError ? gameRoomError : loadingMessage;
    const isError = showRetryButton;

    if (isError) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.loadingText, styles.errorMessageText]}>{displayMessage}</Text>
          <View style={styles.retryButtonRow}>
            <TouchableOpacity
              style={[styles.errorBackButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setIsInitialized(false); // 重置初始化状态
                setShowRetryButton(false);
                setLoadingMessage('重试中...');
                // 递增 retryKey 强制触发 useEffect 重试（即使 isInitialized 已经是 false）
                setRetryKey((prev) => prev + 1);
              }}
            >
              <Text style={styles.errorBackButtonText}>重试</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.errorBackButton} onPress={() => navigation.goBack()}>
              <Text style={styles.errorBackButtonText}>返回</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return <LoadingScreen message={displayMessage} />;
  }

  // Get action message
  const getActionMessage = () => {
    if (!currentActionRole) return '';

    // FAIL-FAST: schema.ui.prompt must exist
    if (!currentSchema?.ui?.prompt) {
      throw new Error(`[FAIL-FAST] Missing schema.ui.prompt for role: ${currentActionRole}`);
    }

    // Bug fix (ONLY hunter gate): When wolfRobot has learned hunter (wolfRobotReveal exists)
    // and needs to view hunter status, show the hunter gate prompt instead of learning prompt.
    // NOTE: This is intentionally NOT a generic "any learned role" gate. Only hunter has
    // this extra UI gate before night advances.
    const isWolfRobotHunterGateActive =
      currentSchema.id === 'wolfRobotLearn' &&
      gameState?.wolfRobotReveal?.learnedRoleId === 'hunter' &&
      !gameState?.wolfRobotHunterStatusViewed;

    const baseMessage = isWolfRobotHunterGateActive
      ? (currentSchema.ui.hunterGatePrompt ?? currentSchema.ui.prompt)
      : currentSchema.ui.prompt;

    const wolfStatusLine = getWolfStatusLine();
    if (wolfStatusLine) {
      return `${baseMessage}\n${wolfStatusLine}`;
    }

    return baseMessage;
  };

  const actionMessage = getActionMessage();

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.roomScreenRoot}>
      {/* Header */}
      <View style={styles.header} testID={TESTIDS.roomHeader}>
        <TouchableOpacity
          onPress={() => dispatchInteraction({ kind: 'LEAVE_ROOM' })}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← 返回</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TouchableOpacity onPress={handleDebugTitleTap} activeOpacity={1}>
            <Text style={styles.headerTitle}>房间 {roomNumber}</Text>
          </TouchableOpacity>
          <Text style={styles.headerSubtitle}>{gameState.template.roles.length}人局</Text>
        </View>
        {/* Host Menu Dropdown - replaces headerSpacer */}
        <HostMenuDropdown
          visible={isHost}
          showRestart={
            !isAudioPlaying &&
            (roomStatus === GameStatus.assigned ||
              roomStatus === GameStatus.ready ||
              roomStatus === GameStatus.ongoing ||
              roomStatus === GameStatus.ended)
          }
          showFillWithBots={roomStatus === GameStatus.unseated}
          showMarkAllBotsViewed={isDebugMode && roomStatus === GameStatus.assigned}
          onRestart={() => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'restart' })}
          onFillWithBots={() => void fillWithBots()}
          onMarkAllBotsViewed={() => void markAllBotsViewed()}
        />
      </View>

      {/* Connection Status Bar */}
      {!isHost && (
        <ConnectionStatusBar status={connectionStatus} onForceSync={() => requestSnapshot()} />
      )}

      {/* Night Progress Indicator - only show during ongoing game */}
      {nightProgress && (
        <NightProgressIndicator
          currentStep={nightProgress.current}
          totalSteps={nightProgress.total}
          currentRoleName={nightProgress.roleName}
        />
      )}

      {/* Bot Mode Hint / Controlled Seat Banner - mutually exclusive */}
      {isDebugMode && hasBots && roomStatus === GameStatus.ongoing && (
        controlledSeat !== null && gameState.players.get(controlledSeat) ? (
          <ControlledSeatBanner
            mode="controlled"
            controlledSeat={controlledSeat}
            botDisplayName={gameState.players.get(controlledSeat)?.displayName || 'Bot'}
            onRelease={() => setControlledSeat(null)}
          />
        ) : (
          <ControlledSeatBanner mode="hint" />
        )
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Board Info - collapsed when game is ongoing */}
        <BoardInfoCard
          playerCount={gameState.template.roles.length}
          wolfRolesText={formatRoleList(wolfRoles, roleCounts)}
          godRolesText={formatRoleList(godRoles, roleCounts)}
          specialRolesText={
            specialRoles.length > 0 ? formatRoleList(specialRoles, roleCounts) : undefined
          }
          villagerCount={villagerCount}
          collapsed={roomStatus === GameStatus.ongoing || roomStatus === GameStatus.ended}
        />

        {/* Player Grid */}
        <PlayerGrid
          seats={seatViewModels}
          roomNumber={roomNumber}
          onSeatPress={onSeatTapped}
          onSeatLongPress={onSeatLongPressed}
          disabled={roomStatus === GameStatus.ongoing && isAudioPlaying}
          controlledSeat={controlledSeat}
          showBotRoles={isDebugMode && isHost}
        />

        {/* Action Message - only show after audio finishes */}
        {imActioner && !isAudioPlaying && <ActionMessage message={actionMessage} />}

        {/* Show players who haven't viewed their roles yet */}
        {isHost && roomStatus === GameStatus.assigned && (
          <WaitingViewRoleList seatIndices={getPlayersNotViewedRole(toGameRoomLike(gameState))} />
        )}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.buttonContainer}>
        {/* Host Control Buttons - dispatch events to policy */}
        <HostControlButtons
          isHost={isHost}
          showSettings={
            !isStartingGame &&
            !isAudioPlaying &&
            (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated)
          }
          showPrepareToFlip={roomStatus === GameStatus.seated}
          showStartGame={roomStatus === GameStatus.ready && !isStartingGame}
          showLastNightInfo={roomStatus === GameStatus.ended && !isAudioPlaying}
          onSettingsPress={() => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'settings' })}
          onPrepareToFlipPress={() =>
            dispatchInteraction({ kind: 'HOST_CONTROL', action: 'prepareToFlip' })
          }
          onStartGamePress={() =>
            dispatchInteraction({ kind: 'HOST_CONTROL', action: 'startGame' })
          }
          onLastNightInfoPress={() =>
            dispatchInteraction({ kind: 'HOST_CONTROL', action: 'lastNightInfo' })
          }
        />

        {/* Actioner: schema-driven bottom action buttons */}
        {(() => {
          const bottom = getBottomAction();
          if (!bottom.buttons.length) return null;
          return bottom.buttons.map((b) => (
            <ActionButton
              key={b.key}
              label={b.label}
              onPress={(_meta) => dispatchInteraction({ kind: 'BOTTOM_ACTION', intent: b.intent })}
            />
          ));
        })()}

        {/* View Role Card */}
        {/* P0-FIX: 使用 effectiveSeat 支持接管模式（Host 无 seat 但接管 bot 时也能查看身份） */}
        {(roomStatus === GameStatus.assigned ||
          roomStatus === GameStatus.ready ||
          roomStatus === GameStatus.ongoing ||
          roomStatus === GameStatus.ended) &&
          effectiveSeat !== null && (
            <ActionButton
              label="查看身份"
              onPress={(_meta) => dispatchInteraction({ kind: 'VIEW_ROLE' })}
            />
          )}

        {/* Greyed View Role (waiting for host) */}
        {(roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) &&
          effectiveSeat !== null && (
            <ActionButton
              label="查看身份"
              disabled
              onPress={(meta) => {
                // Policy decision: disabled button shows alert
                if (meta.disabled) {
                  showAlert('等待房主点击"准备看牌"分配角色');
                }
              }}
            />
          )}
      </View>

      {/* Seat Confirmation Modal */}
      {/* Seat Confirmation Modal - only render when pendingSeatIndex is set */}
      {pendingSeatIndex !== null && (
        <SeatConfirmModal
          visible={seatModalVisible}
          modalType={modalType}
          seatNumber={pendingSeatIndex + 1}
          onConfirm={modalType === 'enter' ? handleConfirmSeat : handleConfirmLeave}
          onCancel={handleCancelSeat}
        />
      )}

      {/* Role Card Modal - 统一使用 RoleRevealAnimator */}
      {/* 只在首次查看时播放动画（shouldPlayRevealAnimation），后续直接显示静态卡片 */}
      {/* P0-FIX: 使用 effectiveRole 支持接管模式（Host 接管 bot 时显示 bot 的身份） */}
      {roleCardVisible &&
        effectiveRole &&
        (() => {
          // 如果动画是 none 或不需要播放动画，直接显示静态卡片
          if (resolvedRoleRevealAnimation === 'none' || !shouldPlayRevealAnimation) {
            return (
              <RoleCardSimple
                visible={roleCardVisible}
                roleId={effectiveRole}
                onClose={handleRoleCardClose}
              />
            );
          }

          // 首次查看，播放动画
          const roleSpec = getRoleSpec(effectiveRole);
          const alignmentMap: Record<string, 'wolf' | 'god' | 'villager'> = {
            [Faction.Wolf]: 'wolf',
            [Faction.God]: 'god',
            [Faction.Villager]: 'villager',
            [Faction.Special]: 'villager', // Special 归类为 villager
          };
          const effectiveRoleData: RoleData = createRoleData(
            effectiveRole,
            getRoleDisplayName(effectiveRole),
            alignmentMap[roleSpec.faction] ?? 'villager',
          );
          const allRoles = gameState?.template?.roles ?? template?.roles ?? [];
          const allRolesData: RoleData[] = allRoles.map((roleId) => {
            const spec = getRoleSpec(roleId);
            return createRoleData(
              roleId,
              getRoleDisplayName(roleId),
              alignmentMap[spec.faction] ?? 'villager',
            );
          });
          // resolvedRoleRevealAnimation 直接作为 effectType（Host 已解析 random → 具体动画）
          const effectType: RevealEffectType = resolvedRoleRevealAnimation as RevealEffectType;
          return (
            <RoleRevealAnimator
              visible={roleCardVisible}
              role={effectiveRoleData}
              effectType={effectType}
              allRoles={allRolesData}
              onComplete={handleRoleCardClose}
            />
          );
        })()}
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles factory
// ─────────────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: spacing.medium,
      fontSize: typography.body,
      color: colors.textSecondary,
    },
    errorIcon: {
      fontSize: spacing.xxlarge + spacing.medium, // ~48
      marginBottom: spacing.medium,
    },
    errorMessageText: {
      color: colors.error,
      textAlign: 'center',
      paddingHorizontal: spacing.large,
    },
    errorBackButton: {
      marginTop: spacing.large,
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.medium,
    },
    errorBackButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: '600',
    },
    retryButtonRow: {
      flexDirection: 'row',
      gap: spacing.small + spacing.tight, // ~12
      marginTop: spacing.large,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.medium,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: spacing.small,
      minWidth: 60,
    },
    backButtonText: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '600',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: typography.subtitle,
      fontWeight: '700',
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.tight / 2,
    },
    headerSpacer: {
      minWidth: 60,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.medium,
    },
    buttonContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      paddingHorizontal: spacing.medium,
      paddingBottom: spacing.xlarge,
      gap: spacing.small,
    },
  });
}

export default RoomScreen;
