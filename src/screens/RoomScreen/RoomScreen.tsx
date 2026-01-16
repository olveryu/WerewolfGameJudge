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
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { 
  RoomStatus, 
  getWolfVoteSummary,
  getPlayersNotViewedRole,
} from '../../models/Room';
import { 
  getRoleDisplayInfo,
  RoleName,
  isWolfRole,
} from '../../models/roles';
import { showAlert } from '../../utils/alert';
import { styles } from './RoomScreen.styles';
import { useGameRoom } from '../../hooks/useGameRoom';
import type { LocalGameState } from '../../services/types/GameStateTypes';
import { HostControlButtons } from './HostControlButtons';
import { useRoomHostDialogs } from './useRoomHostDialogs';
import { useRoomActionDialogs } from './useRoomActionDialogs';
import { useRoomSeatDialogs } from './useRoomSeatDialogs';
import { PlayerGrid } from './components/PlayerGrid';
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
import type { ActionSchema, CompoundSchema, RevealKind, SchemaId, InlineSubStepSchema } from '../../models/roles/spec';
import { SCHEMAS, isValidSchemaId } from '../../models/roles/spec';
import { createRevealExecutors } from './revealExecutors';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

export const RoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const { roomNumber, isHost: isHostParam, template } = route.params;

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

  const submitRevealAckSafe = useCallback(
    (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot') => {
      void submitRevealAck(role);
    },
    [submitRevealAck]
  );

  // Local UI state
  const [firstNightEnded, setFirstNightEnded] = useState(false);
  const [anotherIndex, setAnotherIndex] = useState<number | null>(null); // For Magician
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

  // Build seat view models for PlayerGrid
  const seatViewModels = useMemo(() => {
    if (!gameState) return [];
    return buildSeatViewModels(gameState, mySeatNumber, showWolves, anotherIndex, {
      // Commit 5 (UX-only): meeting vote restrictions apply during the wolf-meeting vote,
      // and this codebase currently models that voting step as the wolfKill schema.
      // Neutral-judge red line is enforced host-side; UI-disable here is UX-only.
      enableWolfVoteRestrictions:
        currentSchema?.kind === 'wolfVote' && currentSchema?.id === 'wolfKill',
    });
  }, [gameState, mySeatNumber, showWolves, anotherIndex, currentSchema?.kind, currentSchema?.id]);

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
    
    if (roomStatus === RoomStatus.unseated || roomStatus === RoomStatus.seated) {
      setFirstNightEnded(false);
      setIsStartingGame(false);
      setAnotherIndex(null); // Reset magician state
      return;
    }

  // NOTE: roomStatus=ready is handled by the normal non-ongoing resets.
  // Keep logic minimal here to avoid masking state-sync bugs.
    
    if (roomStatus === RoomStatus.ongoing && !currentActionRole) {
      setFirstNightEnded(true);
    }
    
    // When night ends (status becomes ended), mark firstNightEnded
    if (roomStatus === RoomStatus.ended) {
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

  const gameContext = useMemo(() => ({
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
  }), [gameState, roomStatus, currentActionRole, currentSchema, imActioner, mySeatNumber, myRole, isAudioPlaying, isBlockedByNightmare, anotherIndex]);

  const actionDeps = useMemo(() => ({
    hasWolfVoted,
  getWolfVoteSummary: () => (gameState ? getWolfVoteSummary(toGameRoomLike(gameState)) : '0/0 狼人已投票'),
    getWitchContext,
  }), [gameState, hasWolfVoted, getWitchContext]);

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

  const proceedWithAction = useCallback(async (targetIndex: number | null, extra?: any): Promise<boolean> => {
    await submitAction(targetIndex, extra);
    
    // Wait for potential rejection first (short timeout: 800ms)
    const rejected = await waitForActionRejected();
    if (rejected) {
      // Show rejection alert with reason from Host
      actionDialogs.showActionRejectedAlert(rejected.reason);
      return false; // Action was rejected
    }
    
    return true; // Action was accepted
  }, [submitAction, waitForActionRejected, actionDialogs]);

  // ---------------------------------------------------------------------------------
  // Action extra typing (UI -> Host wire payload)
  //
  // NOTE: The transport currently uses an untyped `extra?: any` field.
  // We keep it type-safe on the UI side by narrowing locally.
  // ---------------------------------------------------------------------------------

  type ActionExtra = { save: boolean } | { poison: boolean };

  const getSchemaById = useCallback((id: string): ActionSchema | null => {
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
      if (!stepKey || !currentSchema || currentSchema.kind !== 'compound') return null;
      const compound = currentSchema as CompoundSchema;
      return compound.steps.find(s => s.key === stepKey) ?? null;
    },
    [currentSchema]
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
    [currentSchema]
  );

  const proceedWithActionTyped = useCallback(
    async (targetIndex: number | null, extra?: ActionExtra): Promise<boolean> => {
      return proceedWithAction(targetIndex, extra);
    },
    [proceedWithAction]
  );

  // UI-only helpers: keep confirm copy schema-driven and avoid repeating the same fallback logic.
  const getConfirmTitleForSchema = useCallback((): string => {
    return currentSchema?.kind === 'chooseSeat'
      ? (currentSchema.ui?.confirmTitle || '确认行动')
      : '确认行动';
  }, [currentSchema]);

  const getConfirmTextForSeatAction = useCallback(
    (targetIndex: number): string => {
      return currentSchema?.kind === 'chooseSeat'
        ? (currentSchema.ui?.confirmText || `是否对${targetIndex + 1}号玩家使用技能？`)
        : `是否对${targetIndex + 1}号玩家使用技能？`;
    },
    [currentSchema]
  );

  const confirmThenAct = useCallback(
    (
      targetIndex: number,
      onAccepted: () => Promise<void> | void,
      opts?: { title?: string; message?: string }
    ) => {
      const title = opts?.title ?? getConfirmTitleForSchema();
      const message = opts?.message ?? getConfirmTextForSeatAction(targetIndex);

      actionDialogs.showConfirmDialog(title, message, async () => {
        const accepted = await proceedWithActionTyped(targetIndex);
        if (!accepted) return;
        await onAccepted();
      });
    },
    [
      actionDialogs,
      getConfirmTextForSeatAction,
      getConfirmTitleForSchema,
      proceedWithActionTyped,
    ]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Intent Handler (Orchestrator)
  // ───────────────────────────────────────────────────────────────────────────

  const handleActionIntent = useCallback(async (intent: ActionIntent) => {
    switch (intent.type) {
      // NOTE: 'blocked' intent removed - nightmare block is now handled by Host (ACTION_REJECTED).
      // If blocked player submits action, Host will send ACTION_REJECTED private message.

      case 'magicianFirst':
  setAnotherIndex(intent.targetIndex);
        actionDialogs.showMagicianFirstAlert(intent.targetIndex);
        break;

      case 'reveal': {
        if (!gameState) return;
        if (!intent.revealKind) {
          console.warn('[RoomScreen] reveal intent missing revealKind');
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
            actionDialogs.showRevealDialog(`${reveal.targetSeat + 1}号是${reveal.result}`, '', () => {
              exec.ack();
            });
          } else {
            console.warn(`[RoomScreen] ${exec.timeoutLog} timeout - no reveal received`);
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
            currentSchema?.ui?.confirmText
          );
        }
        break;

      case 'actionConfirm':
        if (myRole === 'magician' && anotherIndex !== null) {
          const mergedTarget = getMagicianTarget(intent.targetIndex);
          setAnotherIndex(null);
          actionDialogs.showConfirmDialog(
            (currentSchema?.ui?.confirmTitle || '确认交换'),
            intent.message || `确定交换${anotherIndex + 1}号和${intent.targetIndex + 1}号?`,
            () => void proceedWithActionTyped(mergedTarget)
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
            (stepSchema?.ui?.confirmTitle || currentSchema?.ui?.confirmTitle || '确认行动'),
            (stepSchema?.ui?.confirmText || intent.message || ''),
            () => void proceedWithActionTyped(intent.targetIndex, extra)
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

        actionDialogs.showConfirmDialog(
          '确认跳过',
          (skipStepSchema?.ui?.confirmText || intent.message || '确定不发动技能吗？'),
          () => void proceedWithActionTyped(null, skipExtra)
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

        // Generic action prompt for all other roles (dismiss → wait for seat tap)
        // Schema-first: prompt copy must come from schema ui.
        // Keep a generic fallback (no role-specific copy) to avoid blank UI in dev if schema is incomplete.
        actionDialogs.showRoleActionPrompt('行动提示', currentSchema?.ui?.prompt || '请选择目标', () => {
          // dismiss → do nothing, wait for user to tap seat
        });
        break;
      }
    }
  }, [
    gameState,
    myRole,
    anotherIndex,
    actionDialogs,
    buildWitchExtra,
    confirmThenAct,
    currentSchema,
    getMagicianTarget,
    proceedWithActionTyped,
    submitRevealAckSafe,
    submitWolfVote,
    waitForGargoyleReveal,
    waitForPsychicReveal,
    waitForSeerReveal,
    waitForWolfRobotReveal,
  ]);

  // ───────────────────────────────────────────────────────────────────────────
  // Auto-trigger intent (with idempotency to prevent duplicate triggers)
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Guard: reset key when not in ongoing state or night ended
    if (roomStatus !== RoomStatus.ongoing || !currentActionRole) {
      if (lastAutoIntentKeyRef.current !== null) {
        console.log('[AutoIntent] Clearing key (not ongoing or night ended)');
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
      console.log(`[AutoIntent] Skipping duplicate: key=${key}`);
      return;
    }

    console.log(`[AutoIntent] Triggering: key=${key}, intent=${autoIntent.type}`);
    lastAutoIntentKeyRef.current = key;
    handleActionIntent(autoIntent);
  }, [imActioner, isAudioPlaying, myRole, anotherIndex, roomStatus, currentActionRole, gameState?.currentActionerIndex, getAutoTriggerIntent, handleActionIntent]);

  // ───────────────────────────────────────────────────────────────────────────
  // Seat tap handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleSeatingTap = useCallback((index: number) => {
    if (mySeatNumber !== null && index === mySeatNumber) {
      showLeaveSeatDialog(index);
    } else {
      showEnterSeatDialog(index);
    }
  }, [mySeatNumber, showLeaveSeatDialog, showEnterSeatDialog]);

  const handleActionTap = useCallback((index: number) => {
    const intent = getActionIntent(index);
    if (intent) {
      handleActionIntent(intent);
    }
  }, [getActionIntent, handleActionIntent]);

  const onSeatTapped = useCallback((index: number) => {
    if (!gameState) return;
    
    if (roomStatus === RoomStatus.ongoing && isAudioPlaying) {
      return;
    }
    
    if (roomStatus === RoomStatus.unseated || roomStatus === RoomStatus.seated) {
      handleSeatingTap(index);
    } else if (roomStatus === RoomStatus.ongoing && imActioner) {
      handleActionTap(index);
    }
  }, [gameState, roomStatus, isAudioPlaying, handleSeatingTap, handleActionTap, imActioner]);

  // Host dialog callbacks from hook
  const {
    showPrepareToFlipDialog,
    showStartGameDialog,
    showLastNightInfoDialog,
    showRestartDialog,
    showEmergencyRestartDialog,
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
    
    const roleInfo = getRoleDisplayInfo(myRole);
    const roleName = roleInfo?.displayName || myRole;
    const description = roleInfo?.description || '无技能描述';
    
    await viewedRole();
    
    showAlert(
      `你的身份是：${roleName}`,
      `【技能介绍】\n${description}`,
      [{ text: '确定', style: 'default' }]
    );
  }, [myRole, viewedRole]);

  // Loading state
  if (!isInitialized || !gameState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
        {showRetryButton && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <TouchableOpacity 
              style={[styles.errorBackButton, { backgroundColor: '#FF9800' }]} 
              onPress={() => {
                setIsInitialized(false);
                setShowRetryButton(false);
                setLoadingMessage('重试中...');
              }}
            >
              <Text style={styles.errorBackButtonText}>重试</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.errorBackButton} 
              onPress={() => navigation.goBack()}
            >
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

  // Schema-first: prompt copy must come from schema ui.
  // Keep a generic fallback (no role-specific copy) to avoid blank UI in dev if schema is incomplete.
  const baseMessage = currentSchema?.ui?.prompt || '请选择目标';
    
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
        <View style={[
          styles.connectionStatusBar,
          connectionStatus === 'live' && styles.connectionStatusLive,
          connectionStatus === 'syncing' && styles.connectionStatusSyncing,
          connectionStatus === 'connecting' && styles.connectionStatusConnecting,
          connectionStatus === 'disconnected' && styles.connectionStatusDisconnected,
  ]} testID={TESTIDS.connectionStatusContainer}>
          <Text style={styles.connectionStatusText}>
            {connectionStatus === 'live' && '🟢 已连接'}
            {connectionStatus === 'syncing' && '🔄 同步中...'}
            {connectionStatus === 'connecting' && '⏳ 连接中...'}
            {connectionStatus === 'disconnected' && '🔴 连接断开'}
          </Text>
          {(connectionStatus === 'disconnected' || connectionStatus === 'syncing') && (
            <TouchableOpacity 
              onPress={() => requestSnapshot()} 
              style={styles.forceSyncButton}
              disabled={connectionStatus === 'syncing'}
              testID={TESTIDS.forceSyncButton}
            >
              <Text style={styles.forceSyncButtonText}>
                {connectionStatus === 'syncing' ? '同步中' : '强制同步'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Board Info */}
        <View style={styles.boardInfoContainer}>
          <Text style={styles.boardInfoTitle}>板子配置 ({gameState.template.roles.length}人局)</Text>
          <View style={styles.boardInfoContent}>
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>🐺 狼人：</Text>
              <Text style={styles.roleCategoryText}>
                {formatRoleList(wolfRoles, roleCounts)}
              </Text>
            </View>
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>✨ 神职：</Text>
              <Text style={styles.roleCategoryText}>
                {formatRoleList(godRoles, roleCounts)}
              </Text>
            </View>
            {specialRoles.length > 0 && (
              <View style={styles.roleCategory}>
                <Text style={styles.roleCategoryLabel}>🎭 特殊：</Text>
                <Text style={styles.roleCategoryText}>
                  {formatRoleList(specialRoles, roleCounts)}
                </Text>
              </View>
            )}
            {villagerCount > 0 && (
              <View style={styles.roleCategory}>
                <Text style={styles.roleCategoryLabel}>👤 村民：</Text>
                <Text style={styles.roleCategoryText}>{villagerCount}人</Text>
              </View>
            )}
          </View>
        </View>

        {/* Player Grid */}
        <PlayerGrid
          seats={seatViewModels}
          roomNumber={roomNumber}
          onSeatPress={onSeatTapped}
          disabled={roomStatus === RoomStatus.ongoing && isAudioPlaying}
        />
        
        {/* Action Message - only show after audio finishes */}
        {imActioner && !isAudioPlaying && (
          <Text style={styles.actionMessage}>{actionMessage}</Text>
        )}

        {/* Commit 6 (UI-only): show which audioKey is currently playing */}
        {roomStatus === RoomStatus.ongoing && isAudioPlaying && currentAudioKeyForUi && (
          <Text style={styles.actionMessage}>正在播放：{currentAudioKeyForUi}</Text>
        )}
        
        {/* Show players who haven't viewed their roles yet */}
        {isHost && roomStatus === RoomStatus.assigned && (() => {
          const notViewed = getPlayersNotViewedRole(toGameRoomLike(gameState));
          if (notViewed.length === 0) return null;
          return (
            <View style={styles.actionLogContainer}>
              <Text style={styles.actionLogTitle}>⏳ 等待查看身份</Text>
              <Text style={styles.actionLogItem}>
                {notViewed.map(s => `${s + 1}号`).join(', ')}
              </Text>
            </View>
          );
        })()}
      </ScrollView>
      
      {/* Bottom Buttons */}
      <View style={styles.buttonContainer}>
        {/* Host Control Buttons */}
        <HostControlButtons
          isHost={isHost}
          showSettings={!isStartingGame && !isAudioPlaying && (roomStatus === RoomStatus.unseated || roomStatus === RoomStatus.seated || roomStatus === RoomStatus.assigned || roomStatus === RoomStatus.ready)}
          showPrepareToFlip={roomStatus === RoomStatus.seated}
          showStartGame={roomStatus === RoomStatus.ready && !isStartingGame}
          showLastNightInfo={firstNightEnded}
          showRestart={firstNightEnded}
          showEmergencyRestart={roomStatus === RoomStatus.ongoing}
          onSettingsPress={handleSettingsPress}
          onPrepareToFlipPress={showPrepareToFlipDialog}
          onStartGamePress={showStartGameDialog}
          onLastNightInfoPress={showLastNightInfoDialog}
          onRestartPress={showRestartDialog}
          onEmergencyRestartPress={showEmergencyRestartDialog}
        />
        
        {/* Actioner: schema-driven bottom action buttons */}
        {(() => {
          const bottom = getBottomAction();
          if (!bottom.buttons.length) return null;
          return bottom.buttons.map((b) => (
            <TouchableOpacity
              key={b.key}
              style={styles.actionButton}
              onPress={() => handleActionIntent(b.intent)}
            >
              <Text style={styles.buttonText}>{b.label}</Text>
            </TouchableOpacity>
          ));
        })()}
        
        {/* View Role Card */}
        {(roomStatus === RoomStatus.assigned || roomStatus === RoomStatus.ready || roomStatus === RoomStatus.ongoing || roomStatus === RoomStatus.ended) && mySeatNumber !== null && (
          <TouchableOpacity style={styles.actionButton} onPress={showRoleCardDialog}>
            <Text style={styles.buttonText}>查看身份</Text>
          </TouchableOpacity>
        )}
        
        {/* Greyed View Role (waiting for host) */}
        {(roomStatus === RoomStatus.unseated || roomStatus === RoomStatus.seated) && mySeatNumber !== null && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.disabledButton]}
            onPress={() => showAlert('等待房主点击"准备看牌"分配角色')}
          >
            <Text style={styles.buttonText}>查看身份</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Seat Confirmation Modal */}
      <Modal
        visible={seatModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelSeat}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalType === 'enter' ? '入座' : '站起'}
            </Text>
            <Text style={styles.modalMessage}>
              {modalType === 'enter' 
                ? `确定在${(pendingSeatIndex ?? 0) + 1}号位入座?`
                : `确定从${(pendingSeatIndex ?? 0) + 1}号位站起?`
              }
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleCancelSeat}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={modalType === 'enter' ? handleConfirmSeat : handleConfirmLeave}
              >
                <Text style={styles.modalConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default RoomScreen;
