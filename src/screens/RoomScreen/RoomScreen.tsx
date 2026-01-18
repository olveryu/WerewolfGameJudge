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
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { GameStatus, getWolfVoteSummary, getPlayersNotViewedRole } from '../../models/Room';
import { getRoleSpec, getRoleDisplayName, buildNightPlan } from '../../models/roles';
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
import { TESTIDS } from '../../testids';
import { useActionerState } from './hooks/useActionerState';
import { useRoomActions, ActionIntent } from './hooks/useRoomActions';
import { getStepSpec } from '../../models/roles/spec/nightSteps';
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import { roomScreenLog } from '../../utils/logger';
import type { ActionSchema, SchemaId, InlineSubStepSchema } from '../../models/roles/spec';
import { SCHEMAS, BLOCKED_UI_DEFAULTS, isValidSchemaId } from '../../models/roles/spec';
import { createRevealExecutors } from './revealExecutors';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

export const RoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const { roomNumber, isHost: isHostParam, template } = route.params;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Use the new game room hook
  const {
    gameState,
    isHost,
    mySeatNumber,
    myRole,
    roomStatus,
    currentActionRole,
    currentSchema,
    currentStepId,
    isAudioPlaying,
    connectionStatus,
    error: gameRoomError,
    createRoom,
    joinRoom,
    takeSeat,
    leaveSeat,
    assignRoles,
    startGame,
    restartGame,
    viewedRole,
    submitAction,
    submitWolfVote,
    hasWolfVoted,
    getLastNightInfo: getLastNightInfoFn,
    lastSeatError,
    clearLastSeatError,
    requestSnapshot,
    getWitchContext,
    getConfirmStatus,
    waitForSeerReveal,
    waitForPsychicReveal,
    waitForGargoyleReveal,
    waitForWolfRobotReveal,
    waitForActionRejected,
    submitRevealAck,
  } = useGameRoom();

  // Commit 6 (UI-only): display the authoritative audioKey (from NIGHT_STEPS via ROLE_TURN.stepId)
  const currentAudioKeyForUi = useMemo(() => {
    if (!currentStepId) return null;
    return getStepSpec(currentStepId)?.audioKey ?? null;
  }, [currentStepId]);

  // Night progress indicator: calculate current step index and total steps
  // Uses buildNightPlan to get the actual steps based on the template roles
  const nightProgress = useMemo(() => {
    if (!currentStepId || !gameState || gameState.status !== 'ongoing') {
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

  const submitRevealAckSafe = useCallback(
    (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot') => {
      void submitRevealAck(role);
    },
    [submitRevealAck],
  );

  // Local UI state
  const [firstNightEnded, setFirstNightEnded] = useState(false);
  const [anotherIndex, setAnotherIndex] = useState<number | null>(null); // For Magician first seat
  const [secondSeatIndex, setSecondSeatIndex] = useState<number | null>(null); // For Magician second seat (temporary highlight)
  const [isStartingGame, setIsStartingGame] = useState(false); // Hide start button after clicking
  const [seatModalVisible, setSeatModalVisible] = useState(false);
  const [pendingSeatIndex, setPendingSeatIndex] = useState<number | null>(null);
  const [modalType, setModalType] = useState<'enter' | 'leave'>('enter');
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('加载房间...');
  const [showRetryButton, setShowRetryButton] = useState(false);

  // Refs for callback stability
  const gameStateRef = useRef<LocalGameState | null>(null);

  // Auto-trigger intent idempotency: prevent duplicate triggers in the same turn
  const lastAutoIntentKeyRef = useRef<string | null>(null);

  // Keep gameStateRef in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Computed values: use useActionerState hook
  const { imActioner, showWolves } = useActionerState({
    myRole,
    currentActionRole,
    currentSchema,
    mySeatNumber,
    wolfVotes: gameState?.wolfVotes ?? new Map(),
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
    return buildSeatViewModels(gameState, mySeatNumber, showWolves, anotherIndex, {
      // Commit 5 (UX-only): meeting vote restrictions apply during the wolf-meeting vote,
      // and this codebase currently models that voting step as the wolfKill schema.
      // Neutral-judge red line is enforced host-side; UI-disable here is UX-only.
      enableWolfVoteRestrictions:
        currentSchema?.kind === 'wolfVote' && currentSchema?.id === 'wolfKill',
      // Schema-driven constraints (notSelf, etc.) - UX-only early rejection
      schemaConstraints: imActioner ? currentSchemaConstraints : undefined,
      // For magician swap: highlight the second seat being selected
      secondSelectedIndex: secondSeatIndex,
    });
  }, [
    gameState,
    mySeatNumber,
    showWolves,
    anotherIndex,
    secondSeatIndex,
    currentSchema?.kind,
    currentSchema?.id,
    imActioner,
    currentSchemaConstraints,
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
  }, [isInitialized, isHostParam, template, roomNumber, createRoom, joinRoom, takeSeat]);

  // Track when first night ends
  useEffect(() => {
    if (!gameState) return;

    if (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) {
      setFirstNightEnded(false);
      setIsStartingGame(false);
      setAnotherIndex(null); // Reset magician state
      return;
    }

    // NOTE: roomStatus=ready is handled by the normal non-ongoing resets.
    // Keep logic minimal here to avoid masking state-sync bugs.

    if (roomStatus === GameStatus.ongoing && !currentActionRole) {
      setFirstNightEnded(true);
    }

    // When night ends (status becomes ended), mark firstNightEnded
    if (roomStatus === GameStatus.ended) {
      setFirstNightEnded(true);
    }
  }, [gameState, roomStatus, currentActionRole]);

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
  // Nightmare block detection
  // ───────────────────────────────────────────────────────────────────────────

  const isBlockedByNightmare = useMemo(() => {
    if (!gameState || mySeatNumber === null) return false;
    return gameState.nightmareBlockedSeat === mySeatNumber;
  }, [gameState, mySeatNumber]);

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
      isBlockedByNightmare,
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
      isBlockedByNightmare,
      anotherIndex,
    ],
  );

  const actionDeps = useMemo(
    () => ({
      hasWolfVoted,
      getWolfVoteSummary: () =>
        gameState ? getWolfVoteSummary(toGameRoomLike(gameState)) : '0/0 狼人已投票',
      getWitchContext,
    }),
    [gameState, hasWolfVoted, getWitchContext],
  );

  const {
    getActionIntent,
    getAutoTriggerIntent,
    getMagicianTarget,
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
  // Implements "reject-first" pattern: wait for ACTION_REJECTED before proceeding.
  // @see docs/architecture/unified-host-reject-and-wolf-rules.zh-CN.md
  // ───────────────────────────────────────────────────────────────────────────

  const proceedWithAction = useCallback(
    async (targetIndex: number | null, extra?: any): Promise<boolean> => {
      await submitAction(targetIndex, extra);

      // Wait for potential rejection first (short timeout: 800ms)
      const rejected = await waitForActionRejected();
      if (rejected) {
        // Show rejection alert with reason from Host
        actionDialogs.showActionRejectedAlert(rejected.reason);
        return false; // Action was rejected
      }

      return true; // Action was accepted
    },
    [submitAction, waitForActionRejected, actionDialogs],
  );

  // ---------------------------------------------------------------------------------
  // Action extra typing (UI -> Host wire payload)
  //
  // NOTE: The transport currently uses an untyped `extra?: any` field.
  // We keep it type-safe on the UI side by narrowing locally.
  // ---------------------------------------------------------------------------------

  type ActionExtra = { save: boolean } | { poison: boolean };

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

  const buildWitchExtra = useCallback(
    (opts: { save?: boolean; poison?: boolean }): ActionExtra | undefined => {
      // For compound schema (witch), just pass through the save/poison option as ActionExtra
      if (currentSchema?.kind === 'compound') {
        if (typeof opts.save === 'boolean') return { save: opts.save };
        if (typeof opts.poison === 'boolean') return { poison: opts.poison };
      }
      return undefined;
    },
    [currentSchema],
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
        case 'blocked':
          // UX: Show feedback when blocked player taps a seat
          actionDialogs.showBlockedAlert();
          break;

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

          const revealExecutors = createRevealExecutors({
            seer: {
              wait: waitForSeerReveal,
              ack: () => submitRevealAckSafe('seer'),
              timeoutLog: 'seerReveal',
            },
            psychic: {
              wait: waitForPsychicReveal,
              ack: () => submitRevealAckSafe('psychic'),
              timeoutLog: 'psychicReveal',
            },
            gargoyle: {
              wait: waitForGargoyleReveal,
              ack: () => submitRevealAckSafe('gargoyle'),
              timeoutLog: 'gargoyleReveal',
            },
            wolfRobot: {
              wait: waitForWolfRobotReveal,
              ack: () => submitRevealAckSafe('wolfRobot'),
              timeoutLog: 'wolfRobotReveal',
            },
          });

          const exec = revealExecutors[intent.revealKind];
          confirmThenAct(intent.targetIndex, async () => {
            const reveal = await exec.wait();
            if (reveal) {
              actionDialogs.showRevealDialog(
                `${reveal.targetSeat + 1}号是${reveal.result}`,
                '',
                () => {
                  exec.ack();
                },
              );
            } else {
              roomScreenLog.warn(` ${exec.timeoutLog} timeout - no reveal received`);
            }
          });
          break;
        }

        case 'wolfVote':
          {
            const seat = intent.wolfSeat ?? findVotingWolfSeat();
            if (seat === null) return;
            actionDialogs.showWolfVoteDialog(
              `${seat + 1}号狼人`,
              intent.targetIndex,
              () => void submitWolfVote(intent.targetIndex),
              // Schema-driven copy: prefer schema.ui.confirmText (contract-enforced)
              currentSchema?.ui?.confirmText,
            );
          }
          break;

        case 'actionConfirm':
          if (myRole === 'magician' && anotherIndex !== null) {
            const mergedTarget = getMagicianTarget(intent.targetIndex);
            // Highlight both seats during confirmation dialog
            setSecondSeatIndex(intent.targetIndex);
            actionDialogs.showConfirmDialog(
              currentSchema?.ui?.confirmTitle || '确认交换',
              intent.message || `确定交换${anotherIndex + 1}号和${intent.targetIndex + 1}号?`,
              () => {
                setAnotherIndex(null);
                setSecondSeatIndex(null);
                void proceedWithActionTyped(mergedTarget);
              },
              () => {
                // User cancelled - keep first seat selected, clear second
                setSecondSeatIndex(null);
              },
            );
          } else {
            // Witch/compound: drive copy + payload by stepKey when provided.
            const stepSchema = getSubStepByKey(intent.stepKey);
            let extra: ReturnType<typeof buildWitchExtra> | undefined;
            if (stepSchema?.key === 'save') {
              extra = buildWitchExtra({ save: true });
            } else if (stepSchema?.key === 'poison') {
              extra = buildWitchExtra({ poison: true });
            }

            actionDialogs.showConfirmDialog(
              stepSchema?.ui?.confirmTitle || currentSchema?.ui?.confirmTitle || '确认行动',
              stepSchema?.ui?.confirmText || intent.message || '',
              () => void proceedWithActionTyped(intent.targetIndex, extra),
            );
          }
          break;

        case 'skip': {
          // Witch/compound: drive copy + payload by stepKey when provided.
          const skipStepSchema = getSubStepByKey(intent.stepKey);
          let skipExtra: ReturnType<typeof buildWitchExtra> | undefined;
          if (intent.stepKey === 'skipAll') {
            skipExtra = buildWitchExtra({ save: false, poison: false });
          } else if (skipStepSchema?.key === 'save') {
            skipExtra = buildWitchExtra({ save: false });
          } else if (skipStepSchema?.key === 'poison') {
            skipExtra = buildWitchExtra({ poison: false });
          }

          // FAIL-FAST: skip confirmText must come from schema or intent
          const skipConfirmText = skipStepSchema?.ui?.confirmText || intent.message;
          if (!skipConfirmText) {
            throw new Error(`[FAIL-FAST] Missing confirmText for skip action: ${intent.stepKey}`);
          }

          actionDialogs.showConfirmDialog(
            '确认跳过',
            skipConfirmText,
            () => void proceedWithActionTyped(null, skipExtra),
          );
          break;
        }

        case 'actionPrompt': {
          // Schema-driven prompt.
          // WitchAction uses private WitchContext for dynamic info; template copy comes from schema.
          if (currentSchema?.kind === 'compound' && currentSchema.id === 'witchAction') {
            const witchCtx = getWitchContext();
            if (!witchCtx) return;
            actionDialogs.showWitchInfoPrompt(witchCtx, currentSchema, () => {
              // dismiss → do nothing, wait for user to tap seat / use bottom buttons
            });
            break;
          }

          // confirm schema (hunter/darkWolfKing): show different prompt based on blocked status
          if (currentSchema?.kind === 'confirm') {
            if (isBlockedByNightmare) {
              actionDialogs.showRoleActionPrompt(
                BLOCKED_UI_DEFAULTS.title,
                BLOCKED_UI_DEFAULTS.message,
                () => {},
              );
            } else {
              // FAIL-FAST: schema.ui.prompt must exist for confirm schema
              if (!currentSchema.ui?.prompt) {
                throw new Error(
                  `[FAIL-FAST] Missing schema.ui.prompt for confirm schema: ${currentActionRole}`,
                );
              }
              actionDialogs.showRoleActionPrompt('行动提示', currentSchema.ui.prompt, () => {});
            }
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
          // ANTI-CHEAT: Status comes from Host via private message (CONFIRM_STATUS)
          if (!gameState) break;

          // Get status from private message (Host computed)
          const confirmStatus = getConfirmStatus();

          let canShoot = true; // Default if no private message (shouldn't happen in normal flow)

          if (myRole === 'hunter') {
            if (confirmStatus?.role === 'hunter') {
              canShoot = confirmStatus.canShoot;
            }
          } else if (myRole === 'darkWolfKing') {
            if (confirmStatus?.role === 'darkWolfKing') {
              canShoot = confirmStatus.canShoot;
            }
          }

          // Schema-driven: get displayName from ROLE_SPECS
          const roleDisplayName = getRoleDisplayName(myRole ?? '');

          const statusMessage = canShoot
            ? `${roleDisplayName}可以发动技能`
            : `${roleDisplayName}不能发动技能`;

          // Show info dialog with status, then submit action when user acknowledges
          actionDialogs.showRoleActionPrompt(
            '技能状态',
            statusMessage,
            () => void proceedWithActionTyped(mySeatNumber ?? 0),
          );
          break;
        }
      }
    },
    [
      gameState,
      myRole,
      mySeatNumber,
      isBlockedByNightmare,
      anotherIndex,
      actionDialogs,
      buildWitchExtra,
      confirmThenAct,
      currentSchema,
      currentActionRole,
      findVotingWolfSeat,
      getConfirmStatus,
      getMagicianTarget,
      getSubStepByKey,
      getWitchContext,
      proceedWithActionTyped,
      submitRevealAckSafe,
      submitWolfVote,
      waitForGargoyleReveal,
      waitForPsychicReveal,
      waitForSeerReveal,
      waitForWolfRobotReveal,
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

  const onSeatTapped = useCallback(
    (index: number) => {
      if (!gameState) return;

      if (roomStatus === GameStatus.ongoing && isAudioPlaying) {
        return;
      }

      if (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) {
        handleSeatingTap(index);
      } else if (roomStatus === GameStatus.ongoing && imActioner) {
        handleActionTap(index);
      }
    },
    [gameState, roomStatus, isAudioPlaying, handleSeatingTap, handleActionTap, imActioner],
  );

  // Host dialog callbacks from hook
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

  const showRoleCardDialog = useCallback(async () => {
    if (!myRole) return;

    const spec = getRoleSpec(myRole);
    const roleName = spec?.displayName || myRole;
    const description = spec?.description || '无技能描述';

    await viewedRole();

    showAlert(`你的身份是：${roleName}`, `【技能介绍】\n${description}`, [
      { text: '确定', style: 'default' },
    ]);
  }, [myRole, viewedRole]);

  // ───────────────────────────────────────────────────────────────────────────
  // Host: Show speaking order dialog when night ends (after audio finishes)
  // ───────────────────────────────────────────────────────────────────────────
  const hasShownSpeakOrderRef = useRef(false);

  useEffect(() => {
    // Only show once per game, only for host, only when firstNightEnded and audio finished
    if (!isHost || !firstNightEnded || isAudioPlaying || hasShownSpeakOrderRef.current) return;

    hasShownSpeakOrderRef.current = true;
    showSpeakOrderDialog();
  }, [isHost, firstNightEnded, isAudioPlaying, showSpeakOrderDialog]);

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

    return (
      <View style={styles.loadingContainer}>
        {!isError && <ActivityIndicator size="large" color={colors.primary} />}
        {isError && <Text style={styles.errorIcon}>⚠️</Text>}
        <Text style={[styles.loadingText, isError && styles.errorMessageText]}>
          {displayMessage}
        </Text>
        {showRetryButton && (
          <View style={styles.retryButtonRow}>
            <TouchableOpacity
              style={[styles.errorBackButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setIsInitialized(false);
                setShowRetryButton(false);
                setLoadingMessage('重试中...');
              }}
            >
              <Text style={styles.errorBackButtonText}>重试</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.errorBackButton} onPress={() => navigation.goBack()}>
              <Text style={styles.errorBackButtonText}>返回</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Get action message
  const getActionMessage = () => {
    if (!currentActionRole) return '';

    // FAIL-FAST: schema.ui.prompt must exist
    if (!currentSchema?.ui?.prompt) {
      throw new Error(`[FAIL-FAST] Missing schema.ui.prompt for role: ${currentActionRole}`);
    }
    const baseMessage = currentSchema.ui.prompt;

    const wolfStatusLine = getWolfStatusLine();
    if (wolfStatusLine) {
      return `${baseMessage}\n${wolfStatusLine}`;
    }

    return baseMessage;
  };

  const actionMessage = getActionMessage();

  return (
    <View style={styles.container} testID={TESTIDS.roomScreenRoot}>
      {/* Header */}
      <View style={styles.header} testID={TESTIDS.roomHeader}>
        <TouchableOpacity onPress={handleLeaveRoom} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>房间 {roomNumber}</Text>
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
        {/* Board Info */}
        <BoardInfoCard
          playerCount={gameState.template.roles.length}
          wolfRolesText={formatRoleList(wolfRoles, roleCounts)}
          godRolesText={formatRoleList(godRoles, roleCounts)}
          specialRolesText={
            specialRoles.length > 0 ? formatRoleList(specialRoles, roleCounts) : undefined
          }
          villagerCount={villagerCount}
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

        {/* Commit 6 (UI-only): show which audioKey is currently playing */}
        {roomStatus === GameStatus.ongoing && isAudioPlaying && currentAudioKeyForUi && (
          <ActionMessage message={`正在播放：${currentAudioKeyForUi}`} />
        )}

        {/* Show players who haven't viewed their roles yet */}
        {isHost && roomStatus === GameStatus.assigned && (
          <WaitingViewRoleList seatIndices={getPlayersNotViewedRole(toGameRoomLike(gameState))} />
        )}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.buttonContainer}>
        {/* Host Control Buttons */}
        <HostControlButtons
          isHost={isHost}
          showSettings={
            !isStartingGame &&
            !isAudioPlaying &&
            (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated)
          }
          showPrepareToFlip={roomStatus === GameStatus.seated}
          showStartGame={roomStatus === GameStatus.ready && !isStartingGame}
          showLastNightInfo={firstNightEnded}
          showRestart={
            roomStatus === GameStatus.assigned ||
            roomStatus === GameStatus.ready ||
            roomStatus === GameStatus.ongoing ||
            firstNightEnded
          }
          isEmergencyRestart={roomStatus === GameStatus.ongoing && !firstNightEnded}
          onSettingsPress={handleSettingsPress}
          onPrepareToFlipPress={showPrepareToFlipDialog}
          onStartGamePress={showStartGameDialog}
          onLastNightInfoPress={showLastNightInfoDialog}
          onRestartPress={showRestartDialog}
        />

        {/* Actioner: schema-driven bottom action buttons */}
        {(() => {
          const bottom = getBottomAction();
          if (!bottom.buttons.length) return null;
          return bottom.buttons.map((b) => (
            <ActionButton
              key={b.key}
              label={b.label}
              onPress={() => handleActionIntent(b.intent)}
            />
          ));
        })()}

        {/* View Role Card */}
        {(roomStatus === GameStatus.assigned ||
          roomStatus === GameStatus.ready ||
          roomStatus === GameStatus.ongoing ||
          roomStatus === GameStatus.ended) &&
          mySeatNumber !== null && <ActionButton label="查看身份" onPress={showRoleCardDialog} />}

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
    </View>
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
      marginTop: spacing.md,
      fontSize: typography.base,
      color: colors.textSecondary,
    },
    errorIcon: {
      fontSize: 48,
      marginBottom: spacing.md,
    },
    errorMessageText: {
      color: colors.error,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
    errorBackButton: {
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    errorBackButtonText: {
      color: colors.textInverse,
      fontSize: typography.base,
      fontWeight: '600',
    },
    retryButtonRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: spacing.sm,
    },
    backButtonText: {
      color: colors.primary,
      fontSize: typography.base,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: typography.lg,
      fontWeight: '700',
      color: colors.text,
    },
    headerSpacer: {
      width: 60,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
    },
    buttonContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },
  });
}

export default RoomScreen;
