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
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { GameStatus, getWolfVoteSummary, getPlayersNotViewedRole } from '../../models/Room';
import { buildNightPlan, getRoleDisplayName } from '../../models/roles';
import { showAlert } from '../../utils/alert';
import { useGameRoom } from '../../hooks/useGameRoom';
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
import {
  toGameRoomLike,
  getRoleStats,
  formatRoleList,
  buildSeatViewModels,
} from './RoomScreen.helpers';
import {
  getInteractionResult,
  type InteractionEvent,
  type InteractionContext,
} from './policy';
import { TESTIDS } from '../../testids';
import { useActionerState } from './hooks/useActionerState';
import { useRoomActions, ActionIntent } from './hooks/useRoomActions';
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import { roomScreenLog } from '../../utils/logger';
import type { ActionSchema, SchemaId, InlineSubStepSchema } from '../../models/roles/spec';
import { SCHEMAS, isValidSchemaId, BLOCKED_UI_DEFAULTS } from '../../models/roles/spec';
import { LoadingScreen } from '../../components/LoadingScreen';
import { RoleCardModal } from '../../components/RoleCardModal';
import { RoleRouletteModal } from '../../components/RoleRouletteModal';
import { RoleCardSimple } from '../../components/RoleCardSimple';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

export const RoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const { roomNumber, isHost: isHostParam, template, roleRevealAnimation: initialRoleRevealAnimation } = route.params;
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
    roleRevealAnimation,
    connectionStatus,
    error: gameRoomError,
    createRoom,
    joinRoom,
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
    isBgmEnabled,
    toggleBgm,
  } = useGameRoom();

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

  // Computed values: use useActionerState hook
  const { imActioner, showWolves } = useActionerState({
    myRole,
    currentActionRole,
    currentSchema,
    mySeatNumber,
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
  const seatViewModels = useMemo(() => {
    if (!gameState) return [];

    // Bug fix: After wolfRobot learns (wolfRobotReveal exists), all seat taps
    // should have NO effect - no dialogs, no actions. Skip schema constraints
    // entirely so that PlayerGrid won't show "不能选择自己" alert for self-tap.
    const skipConstraints =
      currentSchema?.id === 'wolfRobotLearn' && gameState.wolfRobotReveal != null;

    return buildSeatViewModels(gameState, mySeatNumber, showWolves, anotherIndex, {
      // Schema-driven constraints (notSelf, etc.) - UX-only early rejection
      // Skip when wolfRobot learning is complete (no seat should be tappable)
      schemaConstraints: imActioner && !skipConstraints ? currentSchemaConstraints : undefined,
      // For magician swap: highlight the second seat being selected
      secondSelectedIndex: secondSeatIndex,
    });
  }, [
    gameState,
    mySeatNumber,
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
  }, [isInitialized, retryKey, isHostParam, template, roomNumber, createRoom, joinRoom, takeSeat, initialRoleRevealAnimation, setRoleRevealAnimation]);

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
      mySeatNumber,
      myRole,
      isAudioPlaying,
      anotherIndex,
    }),
    [
      gameState,
      roomStatus,
      currentActionRole,
      currentSchema,
      imActioner,
      mySeatNumber,
      myRole,
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

  const seatDialogs = useRoomSeatDialogs({
    pendingSeatIndex,
    setPendingSeatIndex,
    setSeatModalVisible,
    setModalType,
    takeSeat,
    leaveSeat,
    roomStatus,
    navigation,
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

    if (!myUid || rejected.targetUid !== myUid) return;

    // Deduplicate repeated broadcasts of the same rejection
    // Prefer a unique rejection id so repeated errors with the same reason still show.
    const key =
      (rejected as { rejectionId?: string }).rejectionId ??
      `${rejected.action}:${rejected.reason}:${rejected.targetUid}`;
    if (key === lastRejectedKeyRef.current) return;
    lastRejectedKeyRef.current = key;

    actionDialogs.showActionRejectedAlert(rejected.reason);
  }, [gameState?.actionRejected, myUid, actionDialogs]);

  // ---------------------------------------------------------------------------------
  // Action extra typing (UI -> Host wire payload)
  //
  // NOTE: The transport currently uses an untyped `extra?: any` field.
  // We keep it type-safe on the UI side by narrowing locally.
  // ---------------------------------------------------------------------------------

  type WitchStepResults = { save: number | null; poison: number | null };
  type ActionExtra =
    | { stepResults: WitchStepResults }
    | { targets: readonly [number, number] }; // swap protocol: [seatA, seatB]

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
              const displayResult = revealKind === 'seer' 
                ? reveal.result 
                : getRoleDisplayName(reveal.result);
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
              roomScreenLog.warn(` ${revealKind}Reveal timeout - no reveal received after ${maxRetries * retryInterval}ms`);
              // P0-FIX: 超时也要清除 pending 状态
              setPendingRevealDialog(false);
            }
          });
          break;
        }

        case 'wolfVote':
          {
            const seat = intent.wolfSeat ?? findVotingWolfSeat();
            roomScreenLog.info(
              '[handleActionIntent] wolfVote:',
              'intent.wolfSeat=',
              intent.wolfSeat,
              'findVotingWolfSeat()=',
              findVotingWolfSeat(),
              'seat=',
              seat,
              'targetIndex=',
              intent.targetIndex,
            );
            if (seat === null) {
              roomScreenLog.warn(
                '[handleActionIntent] wolfVote: seat is null, returning early. myRole=',
                myRole,
                'mySeatNumber=',
                mySeatNumber,
                'hasWolfVoted=',
                mySeatNumber === null ? 'N/A' : hasWolfVoted(mySeatNumber),
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
                const immune =
                  targetRole === 'spiritKnight' ||
                  targetRole === 'wolfQueen';
                return immune ? `${base ?? ''}\n（提示：该角色免疫狼刀，Host 会拒绝）` : base;
              })(),
            );
          }
          break;

        case 'actionConfirm':
          if (myRole === 'magician' && anotherIndex !== null) {
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
            // Witch/compound: drive copy + payload by stepKey when provided.
            // protocol: seat = actorSeat (mySeatNumber), target info in stepResults
            const stepSchema = getSubStepByKey(intent.stepKey);
            let extra: ActionExtra | undefined;
            if (stepSchema?.key === 'save') {
              // save: target is intent.targetIndex (killedIndex from witchContext)
              extra = buildWitchStepResults({ saveTarget: intent.targetIndex, poisonTarget: null });
            } else if (stepSchema?.key === 'poison') {
              // poison: target is intent.targetIndex (user-selected seat)
              extra = buildWitchStepResults({ saveTarget: null, poisonTarget: intent.targetIndex });
            }

            actionDialogs.showConfirmDialog(
              stepSchema?.ui?.confirmTitle || currentSchema?.ui?.confirmTitle || '确认行动',
              stepSchema?.ui?.confirmText || intent.message || '',
              () => void proceedWithActionTyped(mySeatNumber ?? 0, extra),
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
            skipExtra = buildWitchStepResults({ saveTarget: null, poisonTarget: null });
            skipSeat = mySeatNumber ?? 0;
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
          if (!currentSchema?.ui?.statusDialogTitle || !currentSchema?.ui?.canShootText || !currentSchema?.ui?.cannotShootText) {
            throw new Error(
              `[RoomScreen] confirmTrigger schema missing status dialog UI fields for ${currentSchema?.id}`,
            );
          }

          // Get status from gameState (Host computed)
          const confirmStatus = gameState.confirmStatus;

          let canShoot = true; // Default if no status (shouldn't happen in normal flow)

          if (myRole === 'hunter') {
            if (confirmStatus?.role === 'hunter') {
              canShoot = confirmStatus.canShoot;
            }
          } else if (myRole === 'darkWolfKing') {
            if (confirmStatus?.role === 'darkWolfKing') {
              canShoot = confirmStatus.canShoot;
            }
          }

          // Schema-driven: use schema text directly (no string concatenation)
          const dialogTitle = currentSchema.ui.statusDialogTitle;
          const statusMessage = canShoot ? currentSchema.ui.canShootText : currentSchema.ui.cannotShootText;

          // Show info dialog with status, then submit action when user acknowledges
          // IMPORTANT: Pass confirmed=true to satisfy Host block guard
          actionDialogs.showRoleActionPrompt(
            dialogTitle,
            statusMessage,
            () => void proceedWithActionTyped(mySeatNumber ?? 0, { confirmed: true } as any),
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
      myRole,
      mySeatNumber,
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

    // Build idempotency key: stable representation of "same turn"
    const key = [
      roomStatus,
      gameState?.currentActionerIndex ?? 'null',
      currentActionRole ?? 'null',
      imActioner ? 'A' : 'N',
      isAudioPlaying ? 'P' : 'S',
      myRole ?? 'null',
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
    myRole,
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
      mySeatNumber,
      myRole,
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
          roomScreenLog.debug('[dispatchInteraction] NOOP', { reason: result.reason, event: event.kind });
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
              setRoleCardVisible(true);
              void viewedRole();
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
            case 'bgmToggle':
              toggleBgm();
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
      toggleBgm,
      submitRevealAckSafe,
      sendWolfRobotHunterStatusViewed,
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

  // Role card modal state
  const [roleCardVisible, setRoleCardVisible] = useState(false);

  const handleRoleCardClose = useCallback(() => {
    setRoleCardVisible(false);
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
          <Text style={styles.headerTitle}>房间 {roomNumber}</Text>
          <Text style={styles.headerSubtitle}>{gameState.template.roles.length}人局</Text>
        </View>
        <View style={styles.headerSpacer} />
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
          disabled={roomStatus === GameStatus.ongoing && isAudioPlaying}
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
          showRestart={
            roomStatus === GameStatus.assigned ||
            roomStatus === GameStatus.ready ||
            roomStatus === GameStatus.ongoing ||
            roomStatus === GameStatus.ended
          }
          showBgmToggle={roomStatus === GameStatus.ongoing && !isAudioPlaying}
          isBgmEnabled={isBgmEnabled}
          onSettingsPress={() => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'settings' })}
          onPrepareToFlipPress={() => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'prepareToFlip' })}
          onStartGamePress={() => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'startGame' })}
          onLastNightInfoPress={() => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'lastNightInfo' })}
          onRestartPress={() => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'restart' })}
          onBgmToggle={() => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'bgmToggle' })}
        />

        {/* Actioner: schema-driven bottom action buttons */}
        {(() => {
          const bottom = getBottomAction();
          if (!bottom.buttons.length) return null;
          return bottom.buttons.map((b) => (
            <ActionButton
              key={b.key}
              label={b.label}
              onPress={() => dispatchInteraction({ kind: 'BOTTOM_ACTION', intent: b.intent })}
            />
          ));
        })()}

        {/* View Role Card */}
        {(roomStatus === GameStatus.assigned ||
          roomStatus === GameStatus.ready ||
          roomStatus === GameStatus.ongoing ||
          roomStatus === GameStatus.ended) &&
          mySeatNumber !== null && (
            <ActionButton
              label="查看身份"
              onPress={() => dispatchInteraction({ kind: 'VIEW_ROLE' })}
            />
          )}

        {/* Greyed View Role (waiting for host) */}
        {(roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) &&
          mySeatNumber !== null && (
            <ActionButton
              label="查看身份"
              disabled
              onPress={() => showAlert('等待房主点击"准备看牌"分配角色')}
            />
          )}
      </View>

      {/* Seat Confirmation Modal */}
      <SeatConfirmModal
        visible={seatModalVisible}
        modalType={modalType}
        seatNumber={(pendingSeatIndex ?? 0) + 1}
        onConfirm={modalType === 'enter' ? handleConfirmSeat : handleConfirmLeave}
        onCancel={handleCancelSeat}
      />

      {/* Role Card Modal - 根据设置选择动画方式 */}
      {roleRevealAnimation === 'roulette' && (
        <RoleRouletteModal
          visible={roleCardVisible}
          roleId={myRole}
          allRoles={gameState?.template?.roles ?? template?.roles ?? []}
          onClose={handleRoleCardClose}
        />
      )}

      {roleRevealAnimation === 'flip' && (
        <RoleCardModal
          visible={roleCardVisible}
          roleId={myRole}
          onClose={handleRoleCardClose}
        />
      )}

      {roleRevealAnimation === 'none' && (
        <RoleCardSimple
          visible={roleCardVisible}
          roleId={myRole}
          onClose={handleRoleCardClose}
        />
      )}
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
    },
    backButtonText: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '600',
    },
    headerCenter: {
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
      width: spacing.xxlarge + spacing.large, // ~64
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
