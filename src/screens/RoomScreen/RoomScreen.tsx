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
    mySeatNumber,
    wolfVotes: gameState?.wolfVotes ?? new Map(),
    isHost,
    actions: gameState?.actions ?? new Map(),
  });

  // Build seat view models for PlayerGrid
  const seatViewModels = useMemo(() => {
    if (!gameState) return [];
    return buildSeatViewModels(gameState, mySeatNumber, showWolves, anotherIndex);
  }, [gameState, mySeatNumber, showWolves, anotherIndex]);

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
    getWitchContext,
  }), [hasWolfVoted, getWitchContext]);

  const {
    getActionIntent,
    getSkipIntent,
    getAutoTriggerIntent,
    getMagicianTarget,
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

      case 'seerReveal': {
        if (!gameState) return;
        // Confirm intent before submitting to Host
        actionDialogs.showConfirmDialog(
          '确认查验',
          `是否查验${intent.targetIndex + 1}号玩家？`,
          async () => {
            // Anti-cheat: Submit action to Host first, Host sends SEER_REVEAL privately
            // Then wait for result from inbox (handles network latency)
            const accepted = await proceedWithAction(intent.targetIndex);
            if (!accepted) return; // Action rejected, alert already shown
            const reveal = await waitForSeerReveal();
            if (reveal) {
              actionDialogs.showRevealDialog(
                `${reveal.targetSeat + 1}号是${reveal.result}`,
                '',
                () => {
                  submitRevealAckSafe('seer');
                }
              );
            } else {
              console.warn('[RoomScreen] seerReveal timeout - no reveal received');
            }
          }
        );
        break;
      }

      case 'psychicReveal': {
        if (!gameState) return;
        actionDialogs.showConfirmDialog(
          '确认查验',
          `是否查验${intent.targetIndex + 1}号玩家？`,
          async () => {
            // Anti-cheat: Submit action to Host first, Host sends PSYCHIC_REVEAL privately
            // Then wait for result from inbox (handles network latency)
            const accepted = await proceedWithAction(intent.targetIndex);
            if (!accepted) return; // Action rejected, alert already shown
            const reveal = await waitForPsychicReveal();
            if (reveal) {
              actionDialogs.showRevealDialog(
                `${reveal.targetSeat + 1}号是${reveal.result}`,
                '',
                () => {
                  submitRevealAckSafe('psychic');
                }
              );
            } else {
              console.warn('[RoomScreen] psychicReveal timeout - no reveal received');
            }
          }
        );
        break;
      }

      case 'gargoyleReveal': {
        if (!gameState) return;
        actionDialogs.showConfirmDialog(
          '确认查验',
          `是否查验${intent.targetIndex + 1}号玩家？`,
          async () => {
            // Anti-cheat: Submit action to Host first, Host sends GARGOYLE_REVEAL privately
            // Then wait for result from inbox (handles network latency)
            const accepted = await proceedWithAction(intent.targetIndex);
            if (!accepted) return; // Action rejected, alert already shown
            const reveal = await waitForGargoyleReveal();
            if (reveal) {
              actionDialogs.showRevealDialog(
                `${reveal.targetSeat + 1}号是${reveal.result}`,
                '',
                () => {
                  submitRevealAckSafe('gargoyle');
                }
              );
            } else {
              console.warn('[RoomScreen] gargoyleReveal timeout - no reveal received');
            }
          }
        );
        break;
      }

      case 'wolfRobotReveal': {
        if (!gameState) return;
        actionDialogs.showConfirmDialog(
          '确认查验',
          `是否查验${intent.targetIndex + 1}号玩家？`,
          async () => {
            // Anti-cheat: Submit action to Host first, Host sends WOLF_ROBOT_REVEAL privately
            // Then wait for result from inbox (handles network latency)
            const accepted = await proceedWithAction(intent.targetIndex);
            if (!accepted) return; // Action rejected, alert already shown
            const reveal = await waitForWolfRobotReveal();
            if (reveal) {
              actionDialogs.showRevealDialog(
                `${reveal.targetSeat + 1}号是${reveal.result}`,
                '',
                () => {
                  submitRevealAckSafe('wolfRobot');
                }
              );
            } else {
              console.warn('[RoomScreen] wolfRobotReveal timeout - no reveal received');
            }
          }
        );
        break;
      }

      case 'wolfVote':
        if (intent.wolfSeat !== undefined) {
          actionDialogs.showWolfVoteDialog(
            `${intent.wolfSeat + 1}号狼人`,
            intent.targetIndex,
            () => void submitWolfVote(intent.targetIndex)
          );
        }
        break;

      case 'actionConfirm':
        if (myRole === 'magician' && anotherIndex !== null) {
          const mergedTarget = getMagicianTarget(intent.targetIndex);
          setAnotherIndex(null);
          actionDialogs.showConfirmDialog(
            '确认交换',
            intent.message || `确定交换${anotherIndex + 1}号和${intent.targetIndex + 1}号?`,
            () => void proceedWithAction(mergedTarget)
          );
        } else {
          // Witch: payload is driven by step schema id
          let extra: any | undefined;
          if (currentSchema?.kind === 'chooseSeat') {
            if (currentSchema.id === 'witchSave') extra = { save: true };
            if (currentSchema.id === 'witchPoison') extra = { poison: true };
          }
          actionDialogs.showConfirmDialog(
            '确认行动',
            intent.message || '',
            () => void proceedWithAction(intent.targetIndex, extra)
          );
        }
        break;

      case 'skip':
        // Witch: skip payload is driven by step schema id
        let extra: any | undefined;
        if (currentSchema?.kind === 'chooseSeat') {
          if (currentSchema.id === 'witchSave') extra = { save: false };
          if (currentSchema.id === 'witchPoison') extra = { poison: false };
        }
        actionDialogs.showConfirmDialog(
          '确认跳过',
          intent.message || '确定不发动技能吗？',
          () => void proceedWithAction(null, extra)
        );
        break;

      case 'actionPrompt': {
        // Generic action prompt for all roles (dismiss → wait for seat tap)
        const roleInfo = getRoleDisplayInfo(myRole!);
        if (!roleInfo) return;
        
        actionDialogs.showRoleActionPrompt(
          roleInfo.actionTitle,
          roleInfo.actionMessage || '请选择目标',
          () => {
            // dismiss → do nothing, wait for user to tap seat
          }
        );
        break;
      }
    }
  }, [gameState, myRole, anotherIndex, currentSchema, actionDialogs, proceedWithAction, submitWolfVote, getMagicianTarget, setAnotherIndex]);

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

  // ───────────────────────────────────────────────────────────────────────────
  // Skip action handler
  // ───────────────────────────────────────────────────────────────────────────

  const handleSkipAction = useCallback(() => {
    const intent = getSkipIntent();
    if (intent) {
      handleActionIntent(intent);
    }
  }, [getSkipIntent, handleActionIntent]);

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
    
    const roleInfo = getRoleDisplayInfo(currentActionRole);
    const baseMessage =
      currentSchema?.ui?.prompt ||
      roleInfo?.actionMessage ||
      `请${roleInfo?.displayName || currentActionRole}行动`;
    
    if (currentActionRole !== 'wolf') {
      return baseMessage;
    }
    
    const voteSummary = getWolfVoteSummary(toGameRoomLike(gameState));
    
    if (mySeatNumber !== null && myRole && isWolfRole(myRole)) {
      if (hasWolfVoted(mySeatNumber)) {
        return `${baseMessage}\n${voteSummary} (你已投票，等待其他狼人)`;
      }
      return `${baseMessage}\n${voteSummary}`;
    }
    
    return `${baseMessage}\n${voteSummary}`;
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
        
  {/* Actioner: Skip Action */}
  {imActioner && roomStatus === RoomStatus.ongoing && !isAudioPlaying && (() => {
          // Nightmare blocked: UX-only skip button (Host still rejects illegal actions).
          if (isBlockedByNightmare) return true;

          // Schema-driven bottom action visibility.
          if (!currentSchema) return false;

          // wolfVote: always allow empty vote (-1)
          if (currentSchema.kind === 'wolfVote') return true;

          // chooseSeat/swap: honor canSkip
          // NOTE: witchSave/witchPoison are chooseSeat sub-steps and should allow bottom skip.
          if (currentSchema.kind === 'chooseSeat') return currentSchema.canSkip;
          if (currentSchema.kind === 'swap') return currentSchema.canSkip;

          // compound/confirm/skip: no generic bottom action in commit 2
          return false;
        })() && (
          <TouchableOpacity style={styles.actionButton} onPress={handleSkipAction}>
            <Text style={styles.buttonText}>
              {(() => {
                if (isBlockedByNightmare) return '跳过（技能被封锁）';
                if (currentSchema?.kind === 'wolfVote') {
                  return currentSchema.ui?.emptyVoteText || '投票空刀';
                }
                return currentSchema?.ui?.bottomActionText || '不使用技能';
              })()}
            </Text>
          </TouchableOpacity>
        )}
        
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
