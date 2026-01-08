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
  getKilledIndex,
  getHunterStatus,
  getDarkWolfKingStatus,
  getActionLog,
  performSeerAction,
  performPsychicAction,
  getWolfVoteSummary,
  getPlayersNotViewedRole,
  GameRoomLike,
} from '../../models/Room';
import { 
  witchRole, 
  hunterRole, 
  darkWolfKingRole,
  getRoleModel,
  RoleName,
  isWolfRole,
} from '../../models/roles';
import { showAlert } from '../../utils/alert';
import { Avatar } from '../../components/Avatar';
import { styles, TILE_SIZE } from './RoomScreen.styles';
import { useGameRoom } from '../../hooks/useGameRoom';
import { LocalGameState } from '../../services/GameStateService';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

// Helper function to check if current actioner is a bot (or all bots for wolf turn)
function checkIfCurrentActionerBot(gameState: LocalGameState, currentActionRole: RoleName | null): boolean {
  if (!currentActionRole) return false;
  
  // For wolf turn, check if there are any bot wolves that haven't voted yet
  if (currentActionRole === 'wolf') {
    let hasUnvotedBotWolf = false;
    for (const [seat, player] of gameState.players.entries()) {
      if (player?.role && isWolfRole(player.role) && player.uid.startsWith('bot_')) {
        if (!gameState.wolfVotes.has(seat)) {
          hasUnvotedBotWolf = true;
          break;
        }
      }
    }
    return hasUnvotedBotWolf;
  }
  
  // For other roles, find the player with the current action role
  // and check if they are a bot
  for (const [, player] of gameState.players.entries()) {
    if (player?.role === currentActionRole) {
      return player.uid.startsWith('bot_');
    }
  }
  
  return false;
}

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
    hasBots,
    createRoom,
    takeSeat,
    leaveSeat,
    assignRoles,
    startGame,
    restartGame,
    viewedRole,
    submitAction,
    submitWolfVote,
    hasWolfVoted,
    getAllWolfSeats,
    getLastNightInfo: getLastNightInfoFn,
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
  const handleBotActionRef = useRef<((role: RoleName) => void) | null>(null);

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

  // Action log for bot mode
  const actionLog = useMemo(() => {
    if (!gameState || !hasBots || roomStatus !== RoomStatus.ongoing) {
      return [];
    }
    return getActionLog(toGameRoomLike(gameState));
  }, [gameState, hasBots, roomStatus]);

  // Initialize room on mount (host creates, player joins)
  useEffect(() => {
    if (isInitialized) return;
    
    const initRoom = async () => {
      setLoadingMessage('正在初始化...');
      
      if (isHostParam && template) {
        // Host creates room
        setLoadingMessage('正在创建房间...');
        const createdRoomNumber = await createRoom(template);
        
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
        // Player joins existing room
        // Note: In new architecture, player joins via BroadcastService
        // For now, just mark as initialized - the hook handles joining
        setIsInitialized(true);
      }
    };
    
    initRoom();
  }, [isInitialized, isHostParam, template, createRoom, takeSeat]);

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

  // Bot auto-view role
  useEffect(() => {
    if (!gameState || !isHost) return;
    
    const botsNotViewed: number[] = [];
    gameState.players.forEach((player, seat) => {
      if (player?.uid.startsWith('bot_') && player.role && !player.hasViewedRole) {
        botsNotViewed.push(seat);
      }
    });
    
    if (botsNotViewed.length === 0) return;
    
    // In new architecture, bot role viewing is handled by GameStateService
    // This is just a placeholder for now
  }, [gameState, isHost]);

  // Bot auto-action
  const handleBotAction = useCallback((role: RoleName) => {
    const latestGameState = gameStateRef.current;
    if (!latestGameState || roomStatus !== RoomStatus.ongoing) return;
    
    const numberOfPlayers = latestGameState.template.numberOfPlayers;
    
    const delay = 500 + Math.random() * 1000;
    setTimeout(async () => {
      if (role === 'witch') {
        await submitAction(null); // Skip
      } else if (role === 'wolf') {
        // All bot wolves vote for random target
        const wolfSeats = getAllWolfSeats();
        for (const seat of wolfSeats) {
          const player = latestGameState.players.get(seat);
          if (player?.uid.startsWith('bot_') && !hasWolfVoted(seat)) {
            const target = Math.floor(Math.random() * numberOfPlayers);
            await submitWolfVote(target);
          }
        }
      } else {
        const shouldAct = Math.random() > 0.2;
        if (shouldAct) {
          const target = Math.floor(Math.random() * numberOfPlayers);
          await submitAction(target);
        } else {
          await submitAction(null);
        }
      }
    }, delay);
  }, [roomStatus, submitAction, submitWolfVote, getAllWolfSeats, hasWolfVoted]);
  
  handleBotActionRef.current = handleBotAction;

  // Function to show action dialog
  const showActionDialog = useCallback((role: RoleName) => {
    const roleModel = getRoleModel(role);
    if (!roleModel) return;
    
    const actionMessage = roleModel.actionMessage || `请${roleModel.displayName}行动`;
    
    if (role === 'witch') {
      showWitchDialog();
    } else if (role === 'hunter') {
      showHunterStatusDialog();
    } else if (role === 'darkWolfKing') {
      showDarkWolfKingStatusDialog();
    } else if (role === 'wolf') {
      showAlert('狼人请睁眼', actionMessage, [{ text: '好', style: 'default' }]);
    } else {
      showAlert(`${roleModel.displayName}请睁眼`, actionMessage, [{ text: '好', style: 'default' }]);
    }
  }, []);
  
  showActionDialogRef.current = showActionDialog;
  
  const showWitchDialog = useCallback(() => {
    if (!gameState || mySeatNumber === null) return;
    const killedIndex = getKilledIndex(toGameRoomLike(gameState));
    
    const dialogConfig = witchRole.getActionDialogConfig({
      mySeatNumber,
      killedIndex,
      playerCount: gameState.players.size,
      alivePlayers: [],
      currentActions: {},
      proceedWithAction: (target, isPoison) => { void proceedWithAction(target, isPoison ?? false); },
      showNextDialog: showWitchPoisonDialog,
    });
    
    if (dialogConfig) {
      showAlert(dialogConfig.title, dialogConfig.message ?? '', dialogConfig.buttons);
    }
  }, [gameState, mySeatNumber]);
  
  const showWitchPoisonDialog = useCallback(() => {
    const dialogConfig = witchRole.getPoisonDialogConfig();
    showAlert(dialogConfig.title, dialogConfig.message ?? '', dialogConfig.buttons);
  }, []);
  
  const showHunterStatusDialog = useCallback(() => {
    if (!gameState) return;
    const canUseSkill = getHunterStatus(toGameRoomLike(gameState));
    
    const dialogConfig = hunterRole.getStatusDialogConfig(canUseSkill);
    showAlert(dialogConfig.title, dialogConfig.message ?? '', [
      { text: dialogConfig.buttons[0].text, onPress: () => { void proceedWithAction(null); } }
    ]);
  }, [gameState]);
  
  const showDarkWolfKingStatusDialog = useCallback(() => {
    if (!gameState) return;
    const canUseSkill = getDarkWolfKingStatus(toGameRoomLike(gameState));
    
    const dialogConfig = darkWolfKingRole.getStatusDialogConfig(canUseSkill);
    showAlert(dialogConfig.title, dialogConfig.message ?? '', [
      { text: dialogConfig.buttons[0].text, onPress: () => { void proceedWithAction(null); } }
    ]);
  }, [gameState]);

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
  
  const showEnterSeatDialog = useCallback((index: number) => {
    setPendingSeatIndex(index);
    setModalType('enter');
    setSeatModalVisible(true);
  }, []);
  
  const handleConfirmSeat = useCallback(async () => {
    if (pendingSeatIndex === null) return;
    
    const success = await takeSeat(pendingSeatIndex);
    setSeatModalVisible(false);
    
    if (!success) {
      showAlert(`${pendingSeatIndex + 1}号座已被占用`, '请选择其他位置。');
    }
    setPendingSeatIndex(null);
  }, [pendingSeatIndex, takeSeat]);
  
  const handleCancelSeat = useCallback(() => {
    setSeatModalVisible(false);
    setPendingSeatIndex(null);
  }, []);
  
  const showLeaveSeatDialog = useCallback((index: number) => {
    setPendingSeatIndex(index);
    setModalType('leave');
    setSeatModalVisible(true);
  }, []);
  
  const handleConfirmLeave = useCallback(async () => {
    if (pendingSeatIndex === null) return;
    
    await leaveSeat();
    setSeatModalVisible(false);
    setPendingSeatIndex(null);
  }, [pendingSeatIndex, leaveSeat]);

  // Wolf vote handling
  const findVotingWolfSeat = useCallback((): number | null => {
    if (!gameState) return null;
    
    if (mySeatNumber !== null && myRole && isWolfRole(myRole) && !hasWolfVoted(mySeatNumber)) {
      return mySeatNumber;
    }
    
    if (!isHost) return null;
    
    const wolfSeats = getAllWolfSeats();
    for (const seat of wolfSeats) {
      const player = gameState.players.get(seat);
      if (player?.uid.startsWith('bot_') && !hasWolfVoted(seat)) {
        return seat;
      }
    }
    return null;
  }, [gameState, mySeatNumber, myRole, isHost, hasWolfVoted, getAllWolfSeats]);

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

  const showActionConfirmDialog = useCallback((index: number) => {
    if (!myRole) return;
    
    if (myRole === 'wolf') {
      const votingWolfSeat = findVotingWolfSeat();
      if (votingWolfSeat !== null) {
        showWolfVoteConfirmDialog(index, votingWolfSeat);
        return;
      }
    }
    
    const msg = buildActionMessage(index, myRole);
    
    showAlert(
      index === -1 ? '不发动技能' : '使用技能',
      msg,
      [
        { 
          text: '确定', 
          onPress: () => {
            if (index === -1) {
              proceedWithAction(null);
            } else {
              performAction(index);
            }
          }
        },
        { 
          text: '取消', 
          style: 'cancel',
          onPress: () => setAnotherIndex(null)
        },
      ]
    );
  }, [myRole, findVotingWolfSeat, buildActionMessage]);
  
  const showWolfVoteConfirmDialog = useCallback((targetIndex: number, wolfSeat: number) => {
    if (!gameState) return;
    
    const player = gameState.players.get(wolfSeat);
    const wolfName = player?.displayName || `${wolfSeat + 1}号狼人`;
    
    const msg = targetIndex === -1 
      ? `${wolfName} 确定投票空刀吗？` 
      : `${wolfName} 确定要猎杀${targetIndex + 1}号玩家吗？`;
    
    showAlert(
      '狼人投票',
      msg,
      [
        { 
          text: '确定', 
          onPress: () => { void submitWolfVote(targetIndex); }
        },
        { text: '取消', style: 'cancel' },
      ]
    );
  }, [gameState, submitWolfVote]);
  
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
  
  const showPrepareToFlipDialog = useCallback(() => {
    if (!gameState) return;
    
    let seatedCount = 0;
    gameState.players.forEach((player) => {
      if (player !== null) seatedCount++;
    });
    const totalSeats = gameState.template.roles.length;
    
    if (seatedCount !== totalSeats) {
      showAlert('无法开始游戏', '有座位尚未被占用。');
      return;
    }
    
    showAlert(
      '允许看牌？',
      '所有座位已被占用。将洗牌并分配角色。',
      [
        { 
          text: '确定', 
          onPress: () => { void assignRoles(); }
        }
      ]
    );
  }, [gameState, assignRoles]);
  
  const handleStartGame = useCallback(async () => {
    setIsStartingGame(true);
    await startGame();
  }, [startGame]);

  const showStartGameDialog = useCallback(() => {
    showAlert(
      '开始游戏？',
      '请将您的手机音量调整到最大。',
      [
        { 
          text: '确定', 
          onPress: () => { void handleStartGame(); }
        }
      ]
    );
  }, [handleStartGame]);
  
  const showLastNightInfoDialog = useCallback(() => {
    showAlert(
      '确定查看昨夜信息？',
      '',
      [
        { 
          text: '确定', 
          onPress: () => {
            const info = getLastNightInfoFn();
            showAlert('昨夜信息', info);
          }
        },
        { text: '取消', style: 'cancel' },
      ]
    );
  }, [getLastNightInfoFn]);
  
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
  
  const showRestartDialog = useCallback(() => {
    showAlert(
      '重新开始游戏？',
      '使用相同板子开始新一局游戏。',
      [
        { 
          text: '确定', 
          onPress: () => { void restartGame(); }
        },
        { text: '取消', style: 'cancel' },
      ]
    );
  }, [restartGame]);
  
  const handleSkipAction = useCallback(() => {
    showActionConfirmDialog(-1);
  }, [showActionConfirmDialog]);
  
  const handleLeaveRoom = useCallback(() => {
    if (roomStatus === RoomStatus.ongoing) {
      navigation.navigate('Home');
      return;
    }
    
    showAlert(
      '离开房间？',
      '',
      [
        { text: '确定', onPress: () => navigation.navigate('Home') },
        { text: '取消', style: 'cancel' },
      ]
    );
  }, [roomStatus, navigation]);

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
    
    if (isHost) {
      const wolfSeats = getAllWolfSeats();
      for (const seat of wolfSeats) {
        const player = gameState.players.get(seat);
        if (player?.uid.startsWith('bot_') && !hasWolfVoted(seat)) {
          const wolfName = player.displayName || `${seat + 1}号`;
          return `${baseMessage}\n${voteSummary}\n当前: ${wolfName} 投票`;
        }
      }
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
              <View key={seatKey} style={styles.tileWrapper}>
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
        
        {/* Action Log for Bot Mode */}
        {isHost && hasBots && roomStatus === RoomStatus.ongoing && actionLog.length > 0 && (
          <View style={styles.actionLogContainer}>
            <Text style={styles.actionLogTitle}>📋 行动记录</Text>
            {actionLog.map((log, idx) => (
              <Text key={`log-${log.substring(0, 10)}-${idx}`} style={styles.actionLogItem}>{log}</Text>
            ))}
          </View>
        )}
      </ScrollView>
      
      {/* Bottom Buttons */}
      <View style={styles.buttonContainer}>
        {/* Host: Settings */}
        {isHost && !isStartingGame && !isAudioPlaying && (roomStatus === RoomStatus.unseated || roomStatus === RoomStatus.seated || roomStatus === RoomStatus.assigned || roomStatus === RoomStatus.ready) && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#3B82F6' }]} 
            onPress={() => navigation.navigate('Config', { existingRoomNumber: roomNumber })}
          >
            <Text style={styles.buttonText}>⚙️ 设置</Text>
          </TouchableOpacity>
        )}

        {/* Host: Prepare to Flip */}
        {isHost && roomStatus === RoomStatus.seated && (
          <TouchableOpacity style={styles.actionButton} onPress={showPrepareToFlipDialog}>
            <Text style={styles.buttonText}>准备看牌</Text>
          </TouchableOpacity>
        )}
        
        {/* Host: Start Game */}
        {isHost && roomStatus === RoomStatus.ready && !isStartingGame && (
          <TouchableOpacity style={styles.actionButton} onPress={showStartGameDialog}>
            <Text style={styles.buttonText}>开始游戏</Text>
          </TouchableOpacity>
        )}
        
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
        
        {/* Host: View Last Night Info */}
        {isHost && firstNightEnded && (
          <TouchableOpacity style={styles.actionButton} onPress={showLastNightInfoDialog}>
            <Text style={styles.buttonText}>查看昨晚信息</Text>
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
        
        {/* Host: Restart Game */}
        {isHost && firstNightEnded && (
          <TouchableOpacity style={styles.actionButton} onPress={showRestartDialog}>
            <Text style={styles.buttonText}>重新开始</Text>
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
