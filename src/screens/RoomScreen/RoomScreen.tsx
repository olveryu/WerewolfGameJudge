/**
 * RoomScreen - Main game room screen
 * 
 * Refactored to use the new Broadcast architecture:
 * - GameStateService (local state on Host)
 * - BroadcastService (Supabase Realtime)
 * - SimplifiedRoomService (minimal DB storage)
 * 
 * All accessed through the useGameRoom hook.
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
  performSeerAction,
  performPsychicAction,
  getWolfVoteSummary,
  getPlayersNotViewedRole,
  GameRoomLike,
} from '../../models/Room';
import { 
  getRoleModel,
  RoleName,
  isWolfRole,
} from '../../models/roles';
import { showAlert } from '../../utils/alert';
import { Avatar } from '../../components/Avatar';
import { styles, TILE_SIZE } from './RoomScreen.styles';
import { useGameRoom } from '../../hooks/useGameRoom';
import type { LocalGameState } from '../../services/GameStateService';
import { HostControlButtons } from './HostControlButtons';
import { useRoomHostDialogs } from './useRoomHostDialogs';
import { useRoomPlayerDialogs } from './useRoomPlayerDialogs';
import { useRoomNightDialogs } from './useRoomNightDialogs';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

// Helper to determine imActioner state for ongoing game
interface ActionerState {
  imActioner: boolean;
  showWolves: boolean;
}

function determineActionerState(
  myRole: RoleName | null,
  currentActionRole: RoleName | null,
  mySeatNumber: number | null,
  gameState: LocalGameState,
  isHost: boolean
): ActionerState {
  if (!currentActionRole) {
    return { imActioner: false, showWolves: false };
  }
  
  // My role matches current action
  if (myRole === currentActionRole) {
    return handleMatchingRole(myRole, mySeatNumber, gameState);
  }
  
  // Wolf team members during wolf turn
  if (currentActionRole === 'wolf' && myRole && isWolfRole(myRole)) {
    return handleWolfTeamTurn(mySeatNumber, gameState);
  }
  
  // Bot players auto-act randomly, so we don't set imActioner for host
  // This means bots will be handled by the auto-bot-action effect instead
  
  return { imActioner: false, showWolves: false };
}

function handleMatchingRole(myRole: RoleName, mySeatNumber: number | null, gameState: LocalGameState): ActionerState {
  // For wolves, check if already voted
  if (myRole === 'wolf' && mySeatNumber !== null && gameState.wolfVotes.has(mySeatNumber)) {
    return { imActioner: false, showWolves: true };
  }
  
  // Show wolves to wolf team (except nightmare, gargoyle, wolfRobot)
  const showWolves = isWolfRole(myRole) && 
    myRole !== 'nightmare' && 
    myRole !== 'gargoyle' && 
    myRole !== 'wolfRobot';
  
  return { imActioner: true, showWolves };
}

function handleWolfTeamTurn(mySeatNumber: number | null, gameState: LocalGameState): ActionerState {
  // Check if this wolf has already voted
  const hasVoted = mySeatNumber !== null && gameState.wolfVotes.has(mySeatNumber);
  return { imActioner: !hasVoted, showWolves: true };
}

// Helper to convert LocalGameState to GameRoomLike for helper functions
function toGameRoomLike(gameState: LocalGameState): GameRoomLike {
  return {
    template: gameState.template,
    players: gameState.players,
    actions: gameState.actions,
    wolfVotes: gameState.wolfVotes,
    currentActionerIndex: gameState.currentActionerIndex,
  };
}

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
  } = useGameRoom();

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
  const lastShownDialogIndex = useRef<number | null>(null);
  const showActionDialogRef = useRef<((role: RoleName) => void) | null>(null);
  const proceedWithActionRef = useRef<((targetIndex: number | null, extra?: any) => Promise<void>) | null>(null);

  // Keep gameStateRef in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Computed values
  const { imActioner, showWolves } = useMemo(() => {
    if (!gameState || roomStatus !== RoomStatus.ongoing || !currentActionRole) {
      return { imActioner: false, showWolves: false };
    }
    return determineActionerState(myRole, currentActionRole, mySeatNumber, gameState, isHost);
  }, [gameState, roomStatus, myRole, currentActionRole, mySeatNumber, isHost]);

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
      return;
    }
    
    if (roomStatus === RoomStatus.ongoing && !currentActionRole) {
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

  // Show action dialog for player when their turn comes
  useEffect(() => {
    if (!gameState || roomStatus !== RoomStatus.ongoing) {
      lastShownDialogIndex.current = null;
      return;
    }
    
    const currentIndex = gameState.currentActionerIndex;
    
    // Only show dialog when audio is not playing and I'm an actioner
    if (!isAudioPlaying && imActioner && currentActionRole) {
      if (lastShownDialogIndex.current !== currentIndex) {
        lastShownDialogIndex.current = currentIndex;
        showActionDialogRef.current?.(currentActionRole);
      }
    }
  }, [gameState, roomStatus, isAudioPlaying, imActioner, currentActionRole]);

  // Night dialogs from hook
  const {
    showActionDialog,
    showWitchDialog,
    showWitchPoisonDialog,
    showHunterStatusDialog,
    showDarkWolfKingStatusDialog,
  } = useRoomNightDialogs({
    gameState,
    mySeatNumber,
    proceedWithActionRef,
    toGameRoomLike,
  });
  
  useEffect(() => {
    showActionDialogRef.current = showActionDialog;
  }, [showActionDialog]);

  // Seat handling
  const handleSeatingTap = useCallback((index: number) => {
    if (mySeatNumber !== null && index === mySeatNumber) {
      showLeaveSeatDialog(index);
    } else {
      showEnterSeatDialog(index);
    }
  }, [mySeatNumber]);

  const handleActionTap = useCallback((index: number) => {
    if (myRole === 'hunter') {
      showHunterStatusDialog();
      return;
    }
    if (myRole === 'darkWolfKing') {
      showDarkWolfKingStatusDialog();
      return;
    }
    
    if (myRole === 'magician' && anotherIndex === null) {
      setAnotherIndex(index);
      showAlert('已选择第一位玩家', `${index + 1}号，请选择第二位玩家`);
    } else {
      showActionConfirmDialog(index);
    }
  }, [myRole, anotherIndex, showHunterStatusDialog, showDarkWolfKingStatusDialog]);

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

  // Wolf vote handling
  const findVotingWolfSeat = useCallback((): number | null => {
    if (!gameState) return null;
    
    if (mySeatNumber !== null && myRole && isWolfRole(myRole) && !hasWolfVoted(mySeatNumber)) {
      return mySeatNumber;
    }
    
    return null;
  }, [gameState, mySeatNumber, myRole, hasWolfVoted]);

  const buildActionMessage = useCallback((index: number, actingRole: RoleName): string => {
    const roleModel = getRoleModel(actingRole);
    const actionConfirmMessage = roleModel?.actionConfirmMessage || '对';
    
    if (index === -1) {
      return '确定不发动技能吗？';
    }
    if (anotherIndex === null) {
      return `确定${actionConfirmMessage}${index + 1}号玩家?`;
    }
    return `确定${actionConfirmMessage}${index + 1}号和${anotherIndex + 1}号玩家?`;
  }, [anotherIndex]);

  const performAction = useCallback((targetIndex: number) => {
    if (!gameState || !myRole) return;
    
    if (myRole === 'seer' || myRole === 'psychic') {
      const result = myRole === 'seer' 
        ? performSeerAction(toGameRoomLike(gameState), targetIndex)
        : performPsychicAction(toGameRoomLike(gameState), targetIndex);
      
      showAlert(
        `${targetIndex + 1}号是${result}`,
        '',
        [{ text: '确定', onPress: () => { void proceedWithAction(targetIndex); } }]
      );
    } else if (myRole === 'magician' && anotherIndex !== null) {
      const target = anotherIndex + targetIndex * 100;
      setAnotherIndex(null);
      void proceedWithAction(target);
    } else {
      void proceedWithAction(targetIndex);
    }
  }, [gameState, myRole, anotherIndex]);
  
  const proceedWithAction = useCallback(async (targetIndex: number | null, extra?: any) => {
    await submitAction(targetIndex, extra);
  }, [submitAction]);
  
  useEffect(() => {
    proceedWithActionRef.current = proceedWithAction;
  }, [proceedWithAction]);
  
  // Player dialog callbacks from hook
  const {
    showEnterSeatDialog,
    handleConfirmSeat,
    handleCancelSeat,
    showLeaveSeatDialog,
    handleConfirmLeave,
    showActionConfirmDialog,
    showWolfVoteConfirmDialog,
    handleSkipAction,
    handleLeaveRoom,
  } = useRoomPlayerDialogs({
    setPendingSeatIndex,
    setModalType,
    setSeatModalVisible,
    pendingSeatIndex,
    takeSeat,
    leaveSeat,
    myRole,
    gameState,
    findVotingWolfSeat,
    buildActionMessage,
    proceedWithAction,
    performAction,
    setAnotherIndex,
    submitWolfVote,
    roomStatus,
    navigation,
  });

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
    
    const roleModel = getRoleModel(myRole);
    const roleName = roleModel?.displayName || myRole;
    const description = roleModel?.description || '无技能描述';
    
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
    
    const roleModel = getRoleModel(currentActionRole);
    const baseMessage = roleModel?.actionMessage || `请${roleModel?.displayName || currentActionRole}行动`;
    
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

  // Calculate role statistics
  const getRoleStats = () => {
    const roleCounts: Record<string, number> = {};
    const wolfRolesList: string[] = [];
    const godRolesList: string[] = [];
    const specialRolesList: string[] = [];
    const villagerCount = { count: 0 };
    
    gameState.template.roles.forEach((role) => {
      const roleModel = getRoleModel(role);
      if (!roleModel) return;
      
      if (roleModel.faction === 'wolf') {
        roleCounts[roleModel.displayName] = (roleCounts[roleModel.displayName] || 0) + 1;
        if (!wolfRolesList.includes(roleModel.displayName)) {
          wolfRolesList.push(roleModel.displayName);
        }
      } else if (roleModel.faction === 'god') {
        roleCounts[roleModel.displayName] = (roleCounts[roleModel.displayName] || 0) + 1;
        if (!godRolesList.includes(roleModel.displayName)) {
          godRolesList.push(roleModel.displayName);
        }
      } else if (roleModel.faction === 'special') {
        roleCounts[roleModel.displayName] = (roleCounts[roleModel.displayName] || 0) + 1;
        if (!specialRolesList.includes(roleModel.displayName)) {
          specialRolesList.push(roleModel.displayName);
        }
      } else if (role === 'villager') {
        villagerCount.count++;
      }
    });
    
    return { roleCounts, wolfRoles: wolfRolesList, godRoles: godRolesList, specialRoles: specialRolesList, villagerCount: villagerCount.count };
  };
  
  const { roleCounts, wolfRoles, godRoles, specialRoles, villagerCount } = getRoleStats();

  const formatRoleList = (roles: string[], counts: Record<string, number>): string => {
    if (roles.length === 0) return '无';
    return roles.map(r => {
      const count = counts[r];
      return count > 1 ? `${r}×${count}` : r;
    }).join('、');
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
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
        ]}>
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
        <View style={styles.gridContainer}>
          {gameState.template.roles.map((role, index) => {
            const player = gameState.players.get(index);
            const isWolf = showWolves && isWolfRole(role) && 
                          role !== 'wolfRobot' && role !== 'gargoyle';
            const isSelected = anotherIndex === index;
            const isMySpot = mySeatNumber === index;
            const seatKey = `seat-${index}-${role}`;
            
            return (
              <View key={seatKey} style={styles.tileWrapper} testID={`seat-tile-${index}`}>
                <TouchableOpacity
                  style={[
                    styles.playerTile,
                    isMySpot && styles.mySpotTile,
                    isWolf && styles.wolfTile,
                    isSelected && styles.selectedTile,
                  ]}
                  onPress={() => onSeatTapped(index)}
                  activeOpacity={0.7}
                >
                  {player && (
                    <View style={styles.avatarContainer}>
                      <Avatar 
                        value={player.uid} 
                        size={TILE_SIZE - 16} 
                        avatarUrl={player.avatarUrl}
                        seatNumber={player.seatNumber + 1}
                        roomId={roomNumber}
                      />
                      {(isWolf || isSelected) && (
                        <View style={[
                          styles.avatarOverlay,
                          isWolf && styles.wolfOverlay,
                          isSelected && styles.selectedOverlay,
                        ]} />
                      )}
                    </View>
                  )}
                  
                  <Text style={[styles.seatNumber, player && styles.seatedSeatNumber]}>
                    {index + 1}
                  </Text>
                  
                  {!player && (
                    <Text style={styles.emptyIndicator}>空</Text>
                  )}
                  
                  {isMySpot && player && (
                    <Text style={styles.mySeatBadge}>我</Text>
                  )}
                </TouchableOpacity>
                
                {player && (
                  <Text style={styles.playerName} numberOfLines={1}>
                    {player.displayName || '玩家'}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
        
        {/* Action Message */}
        {imActioner && (
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
          const noSkipRoles: RoleName[] = ['hunter', 'darkWolfKing', 'wolfRobot', 'slacker'];
          return myRole && !noSkipRoles.includes(myRole);
        })() && (
          <TouchableOpacity style={styles.actionButton} onPress={handleSkipAction}>
            <Text style={styles.buttonText}>
              {myRole === 'wolf' ? '投票空刀' : '不使用技能'}
            </Text>
          </TouchableOpacity>
        )}
        
        {/* View Role Card */}
        {(roomStatus === RoomStatus.assigned || roomStatus === RoomStatus.ready || roomStatus === RoomStatus.ongoing) && mySeatNumber !== null && (
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
