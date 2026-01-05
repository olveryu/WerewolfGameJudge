import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { 
  Room, 
  RoomStatus, 
  createRoom, 
  getCurrentActionRole,
  getKilledIndex,
  getHunterStatus,
  getDarkWolfKingStatus,
  getAllWolfSeats,
  getLastNightInfo,
  performSeerAction,
  performPsychicAction,
  proceedToNextAction,
  startGame,
  restartRoom,
  recordWolfVote,
  allWolvesVoted,
  getWolfVoteSummary,
  calculateWolfKillTarget,
  hasWolfVoted,
} from '../../models/Room';
import { RoleName, ROLES, isWolfRole } from '../../constants/roles';
import AudioService from '../../services/AudioService';
import { BackendService } from '../../services/BackendService';
import { showAlert, setAlertListener, AlertConfig } from '../../utils/alert';
import { AlertModal } from '../../components/AlertModal';
import { Avatar } from '../../components/Avatar';
import { styles, TILE_SIZE } from './RoomScreen.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

export const RoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const { roomNumber, isHost, template } = route.params;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [mySeatNumber, setMySeatNumber] = useState<number | null>(null);
  const [imActioner, setImActioner] = useState(false);
  const [showWolves, setShowWolves] = useState(false);
  const [firstNightEnded, setFirstNightEnded] = useState(false);
  const [, setLastDialogShownForIndex] = useState<number | null>(null); // Track which action index we've shown dialog for
  const [anotherIndex, setAnotherIndex] = useState<number | null>(null); // For Magician
  const [isAudioPlaying, setIsAudioPlaying] = useState(false); // Block actions while audio playing
  const [isStartingGame, setIsStartingGame] = useState(false); // Hide start button after clicking

  // Modal state for web compatibility
  const [seatModalVisible, setSeatModalVisible] = useState(false);
  const [pendingSeatIndex, setPendingSeatIndex] = useState<number | null>(null);
  const [modalType, setModalType] = useState<'enter' | 'leave'>('enter');

  // Custom alert modal state
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);

  const audioService = useRef(AudioService.getInstance());
  const backendService = useRef(BackendService.getInstance());
  const lastPlayedActionIndex = useRef<number | null>(null);
  const roomRef = useRef<Room | null>(null); // Keep latest room for closures
  const currentUserId = backendService.current.getCurrentUserId();

  // Set up alert listener for custom modal
  useEffect(() => {
    setAlertListener(setAlertConfig);
    return () => setAlertListener(null);
  }, []);

  // Keep roomRef in sync with room state
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // Subscribe to room updates
  useEffect(() => {
    if (!roomNumber) return;
    
    console.log('Subscribing to room:', roomNumber);
    const unsubscribe = backendService.current.subscribeToRoom(
      roomNumber,
      (roomData) => {
        console.log('Room data received:', roomData?.roomNumber, 'status:', roomData?.roomStatus);
        if (roomData) {
          setRoom(roomData);
          setLoading(false);
        } else {
          console.log('No room data - room does not exist');
          // If not host, room should already exist - stop loading to show error
          // If host, keep loading while we create the room
          if (!isHost) {
            setRoom(null);
            setLoading(false);
          }
        }
      }
    );
    
    return () => unsubscribe?.();
  }, [roomNumber, isHost]);
  
  // Create room if host and auto-sit on first seat
  // Using ref to track if we've already created the room
  const hasCreatedRoom = useRef(false);
  useEffect(() => {
    const createRoomAndSit = async () => {
      // Only create once
      if (hasCreatedRoom.current) return;
      if (!isHost || !template) return;
      
      hasCreatedRoom.current = true;
      
      // Wait for backend to be ready (auth initialized)
      await backendService.current.waitForInit?.();
      const userId = backendService.current.getCurrentUserId() || 'anonymous';
      
      console.log('Creating room as host:', roomNumber, 'userId:', userId);
      const newRoom = createRoom(userId, roomNumber, template);
      console.log('Room created:', newRoom.roomNumber, 'status:', newRoom.roomStatus);
      await backendService.current.createRoom(roomNumber, newRoom);
      
      // Auto-sit host on seat 1 (index 0)
      console.log('Auto-seating host on seat 1');
      await backendService.current.takeSeat(roomNumber, 0, null);
    };
    createRoomAndSit();
  }, [isHost, template, roomNumber]);
  
  // Update player state based on room changes
  useEffect(() => {
    if (!room) return;
    
    // Use the same userId logic as takeSeat
    const myUserId = currentUserId || 'anonymous';
    
    // Find my seat
    let myIndex: number | null = null;
    room.players.forEach((player, seat) => {
      if (player?.uid === myUserId) {
        myIndex = seat;
      }
    });
    if (myIndex !== null) {
      setMySeatNumber(myIndex);
    } else {
      setMySeatNumber(null);
    }
    
    // Check if I'm the current actioner
    const myRole = myIndex !== null ? room.template.roles[myIndex] : null;
    const currentActionRole = getCurrentActionRole(room);
    
    // Check if current actioner is a bot (for host control)
    const isCurrentActionerBot = (): boolean => {
      if (!currentActionRole) return false;
      // Find the player with the current action role
      for (const [seat, player] of room.players.entries()) {
        if (player && room.template.roles[seat] === currentActionRole) {
          // Check if it's a bot (uid starts with 'bot_')
          if (player.uid.startsWith('bot_')) {
            return true;
          }
        }
      }
      // For wolf turn, check if ALL wolves are bots
      if (currentActionRole === 'wolf') {
        let hasHumanWolf = false;
        for (const [seat, player] of room.players.entries()) {
          const role = room.template.roles[seat];
          if (player && isWolfRole(role)) {
            if (!player.uid.startsWith('bot_')) {
              hasHumanWolf = true;
              break;
            }
          }
        }
        return !hasHumanWolf;
      }
      return false;
    };
    
    if (room.roomStatus === RoomStatus.seating) {
      setImActioner(false);
      setShowWolves(false);
      setFirstNightEnded(false);
      setLastDialogShownForIndex(null);
    } else if (room.roomStatus === RoomStatus.ongoing) {
      if (!currentActionRole) {
        setFirstNightEnded(true);
        setImActioner(false);
        setShowWolves(false);
      } else if (myRole === currentActionRole) {
        // I am the actioner (my role matches current action)
        // For wolves, check if already voted
        if (currentActionRole === 'wolf' && mySeatNumber !== null && hasWolfVoted(room, mySeatNumber)) {
          setImActioner(false);
          setShowWolves(true); // Can still see other wolves
        } else {
          setImActioner(true);
        }
        
        // Show wolves to wolf team
        if (myRole && isWolfRole(myRole) && 
            myRole !== 'nightmare' && 
            myRole !== 'gargoyle' && 
            myRole !== 'wolfRobot') {
          setShowWolves(true);
        }
        
        // Dialog will be shown after audio completes (see audio useEffect)
      } else if (currentActionRole === 'wolf' && myRole && isWolfRole(myRole)) {
        // Wolf team members can all vote during wolf turn
        // Check if this wolf has already voted
        if (mySeatNumber !== null && hasWolfVoted(room, mySeatNumber)) {
          setImActioner(false);
        } else {
          setImActioner(true); // All wolves can act now
        }
        setShowWolves(true);
        // Dialog will be shown after audio completes
      } else if (isHost && isCurrentActionerBot()) {
        // Host controls bot players during night
        setImActioner(true);
        
        // Show wolves if current action is wolf-related
        if (currentActionRole && isWolfRole(currentActionRole)) {
          setShowWolves(true);
        }
        
        // Dialog will be shown after audio completes
      } else {
        setImActioner(false);
        setShowWolves(false);
      }
    }
  }, [room, currentUserId, isHost, mySeatNumber]);
  
  // Ref to store the latest showActionDialog callback
  const showActionDialogRef = useRef<((role: RoleName) => void) | null>(null);
  
  // Play audio for current action role (host only) and show dialog after audio completes
  useEffect(() => {
    if (!room || !isHost || room.roomStatus !== RoomStatus.ongoing) {
      lastPlayedActionIndex.current = null;
      return;
    }
    
    const currentIndex = room.currentActionerIndex;
    const currentRole = getCurrentActionRole(room);
    
    // Only play audio if the action index has changed
    if (currentIndex !== lastPlayedActionIndex.current) {
      lastPlayedActionIndex.current = currentIndex;
      setIsAudioPlaying(true);
      setLastDialogShownForIndex(null); // Reset dialog state for new action
      
      const playAudioAndShowDialog = async () => {
        if (currentRole) {
          console.log('Playing audio for role:', currentRole);
          await audioService.current.playRoleBeginningAudio(currentRole);
          
          // Show action dialog after audio completes
          setIsAudioPlaying(false);
          setLastDialogShownForIndex(currentIndex);
          showActionDialogRef.current?.(currentRole);
        } else {
          // Night has ended - no more actions
          console.log('Playing night end audio');
          await audioService.current.playNightEndAudio();
          setIsAudioPlaying(false);
        }
      };
      
      playAudioAndShowDialog();
    }
  }, [room?.currentActionerIndex, room?.roomStatus, isHost, room]);
  
  const getMyRole = useCallback((): RoleName | null => {
    if (!room || mySeatNumber === null) return null;
    return room.template.roles[mySeatNumber];
  }, [room, mySeatNumber]);

  // Get the role currently being acted (for host controlling bots)
  const getActingRole = useCallback((): RoleName | null => {
    if (!room) return null;
    
    const currentActionRole = getCurrentActionRole(room);
    
    // If I'm the host and controlling a bot, return the current action role
    if (isHost && imActioner && currentActionRole) {
      // Check if my own role matches - if so, use my role
      const myRole = mySeatNumber !== null ? room.template.roles[mySeatNumber] : null;
      if (myRole === currentActionRole) {
        return myRole;
      }
      // Otherwise, I'm controlling a bot - use the current action role
      return currentActionRole;
    }
    
    // Otherwise return my own role
    return getMyRole();
  }, [room, isHost, imActioner, mySeatNumber, getMyRole]);
  
  // Function to show action dialog - update ref to always have latest version
  const showActionDialog = (role: RoleName) => {
    const roleInfo = ROLES[role];
    if (!roleInfo) return;
    
    const actionMessage = roleInfo.actionMessage || `请${roleInfo.displayName}行动`;
    
    if (role === 'witch') {
      showWitchDialog();
    } else if (role === 'hunter') {
      showHunterStatusDialog();
    } else if (role === 'darkWolfKing') {
      showDarkWolfKingStatusDialog();
    } else if (role === 'wolf') {
      showAlert('狼人行动', '请选择今晚猎杀对象', [{ text: '好', style: 'default' }]);
    } else {
      showAlert('行动', actionMessage, [{ text: '好', style: 'default' }]);
    }
  };
  // Keep ref updated with latest function
  showActionDialogRef.current = showActionDialog;
  
  const showWitchDialog = () => {
    if (!room) return;
    const killedIndex = getKilledIndex(room);
    
    if (killedIndex === -1) {
      showAlert('昨夜无人倒台', '', [
        { text: '好', onPress: () => {} }
      ]);
    } else {
      showAlert(
        `昨夜倒台玩家为${killedIndex + 1}号`,
        '是否救助?',
        [
          { 
            text: '救助', 
            onPress: () => {
              if (killedIndex === mySeatNumber) {
                showAlert('女巫无法自救');
              } else {
                proceedWithAction(killedIndex, false);
              }
            }
          },
          { 
            text: '不救助', 
            style: 'cancel',
            onPress: () => showWitchPoisonDialog() 
          },
        ]
      );
    }
  };
  
  const showWitchPoisonDialog = () => {
    showAlert(
      '请选择是否使用毒药',
      '点击玩家头像使用毒药，如不使用毒药，请点击下方「不使用技能」',
      [{ text: '好', style: 'default' }]
    );
  };
  
  const showHunterStatusDialog = () => {
    if (!room) return;
    const canUseSkill = getHunterStatus(room);
    
    console.log('[Hunter] Showing status dialog, canUseSkill:', canUseSkill);
    showAlert(
      '猎人技能状态',
      canUseSkill ? '可以发动' : '不可发动',
      [{ text: '好', onPress: () => {
        console.log('[Hunter] Button pressed, calling proceedWithAction(null)');
        proceedWithAction(null);
      }}]
    );
  };
  
  const showDarkWolfKingStatusDialog = () => {
    if (!room) return;
    const canUseSkill = getDarkWolfKingStatus(room);
    
    showAlert(
      '黑狼王技能状态',
      canUseSkill ? '可以发动' : '不可发动',
      [{ text: '好', onPress: () => proceedWithAction(null) }]
    );
  };
  
  const onSeatTapped = (index: number) => {
    console.log('Seat tapped:', index, 'room:', room?.roomNumber, 'status:', room?.roomStatus);
    if (!room) {
      console.log('No room!');
      return;
    }
    
    // Block seat actions while audio is playing during game
    if (room.roomStatus === RoomStatus.ongoing && isAudioPlaying) {
      console.log('Audio is playing, ignoring tap');
      return;
    }
    
    console.log('Room status:', room.roomStatus, 'RoomStatus.seating:', RoomStatus.seating);
    
    if (room.roomStatus === RoomStatus.seating) {
      console.log('In seating mode, isHost:', isHost, 'mySeatNumber:', mySeatNumber);
      // 如果点击的是自己的座位，询问是否站起
      if (mySeatNumber !== null && index === mySeatNumber) {
        showLeaveSeatDialog(index);
      } else {
        console.log('Showing enter seat dialog for index:', index);
        showEnterSeatDialog(index);
      }
    } else if (imActioner) {
      const actingRole = getActingRole();
      
      // Hunter and darkWolfKing only need to confirm status, not select target
      if (actingRole === 'hunter') {
        showHunterStatusDialog();
        return;
      }
      if (actingRole === 'darkWolfKing') {
        showDarkWolfKingStatusDialog();
        return;
      }
      
      if (actingRole === 'magician' && anotherIndex === null) {
        setAnotherIndex(index);
        showAlert('已选择第一位玩家', `${index + 1}号，请选择第二位玩家`);
      } else {
        showActionConfirmDialog(index);
      }
    }
  };
  
  const showEnterSeatDialog = (index: number) => {
    console.log('showEnterSeatDialog called for index:', index);
    setPendingSeatIndex(index);
    setModalType('enter');
    setSeatModalVisible(true);
  };
  
  const handleConfirmSeat = async () => {
    if (pendingSeatIndex === null) return;
    
    console.log('Confirm pressed, calling takeSeat for index:', pendingSeatIndex);
    const result = await backendService.current.takeSeat(roomNumber, pendingSeatIndex, mySeatNumber);
    console.log('takeSeat result:', result);
    
    setSeatModalVisible(false);
    
    if (result === -1) {
      // Seat already taken - show alert (or could use another modal)
      if (Platform.OS === 'web') {
        window.alert(`${pendingSeatIndex + 1}号座已被占用，请选择其他位置。`);
      } else {
        showAlert(`${pendingSeatIndex + 1}号座已被占用`, '请选择其他位置。');
      }
    }
    setPendingSeatIndex(null);
  };
  
  const handleCancelSeat = () => {
    setSeatModalVisible(false);
    setPendingSeatIndex(null);
  };
  
  const showLeaveSeatDialog = (index: number) => {
    setPendingSeatIndex(index);
    setModalType('leave');
    setSeatModalVisible(true);
  };
  
  const handleConfirmLeave = () => {
    if (pendingSeatIndex === null) return;
    
    backendService.current.leaveSeat(roomNumber, pendingSeatIndex);
    setMySeatNumber(null);
    setSeatModalVisible(false);
    setPendingSeatIndex(null);
  };
  
  const showActionConfirmDialog = (index: number) => {
    const actingRole = getActingRole();
    if (!actingRole) return;
    
    // 狼人投票使用单独的确认对话框
    if (actingRole === 'wolf') {
      // 找到需要投票的狼人座位
      let votingWolfSeat: number | null = null;
      
      // 首先检查自己是否是狼人且未投票
      if (mySeatNumber !== null) {
        const myRole = getMyRole();
        if (myRole && isWolfRole(myRole) && !hasWolfVoted(room!, mySeatNumber)) {
          votingWolfSeat = mySeatNumber;
        }
      }
      
      // 如果自己不是狼人或已投票，作为 host 找第一个未投票的机器人狼
      if (votingWolfSeat === null && isHost && room) {
        const wolfSeats = getAllWolfSeats(room);
        for (const seat of wolfSeats) {
          const player = room.players.get(seat);
          if (player && player.uid.startsWith('bot_') && !hasWolfVoted(room, seat)) {
            votingWolfSeat = seat;
            break;
          }
        }
      }
      
      if (votingWolfSeat !== null) {
        showWolfVoteConfirmDialog(index, votingWolfSeat);
        return;
      }
    }
    
    const roleInfo = ROLES[actingRole];
    const actionConfirmMessage = roleInfo?.actionConfirmMessage || '对';
    
    let msg: string;
    if (index === -1) {
      msg = '确定不发动技能吗？';
    } else if (anotherIndex !== null) {
      msg = `确定${actionConfirmMessage}${index + 1}号和${anotherIndex + 1}号玩家?`;
    } else {
      msg = `确定${actionConfirmMessage}${index + 1}号玩家?`;
    }
    
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
  };
  
  // 狼人投票确认对话框
  const showWolfVoteConfirmDialog = (targetIndex: number, wolfSeat: number) => {
    if (!room) return;
    
    const player = room.players.get(wolfSeat);
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
          onPress: () => {
            // 记录狼人投票
            const updatedRoom = recordWolfVote(room, wolfSeat, targetIndex);
            
            // 检查是否所有狼人都投票了
            if (allWolvesVoted(updatedRoom)) {
              // 计算最终目标并进入下一阶段
              const finalTarget = calculateWolfKillTarget(updatedRoom);
              const finalRoom = proceedToNextAction(updatedRoom, finalTarget);
              backendService.current.updateRoom(roomNumber, finalRoom);
            } else {
              // 还有狼人未投票，只更新投票记录
              backendService.current.updateRoom(roomNumber, updatedRoom);
            }
          }
        },
        { 
          text: '取消', 
          style: 'cancel'
        },
      ]
    );
  };
  
  const performAction = (targetIndex: number) => {
    if (!room) return;
    
    const actingRole = getActingRole();
    
    // Handle special roles
    if (actingRole === 'seer' || actingRole === 'psychic') {
      const result = actingRole === 'seer' 
        ? performSeerAction(room, targetIndex)
        : performPsychicAction(room, targetIndex);
      
      showAlert(
        `${targetIndex + 1}号是${result}`,
        '',
        [{ text: '确定', onPress: () => proceedWithAction(targetIndex) }]
      );
    } else if (actingRole === 'magician' && anotherIndex !== null) {
      const target = anotherIndex + targetIndex * 100;
      setAnotherIndex(null);
      proceedWithAction(target);
    } else {
      proceedWithAction(targetIndex);
    }
  };
  
  const proceedWithAction = (targetIndex: number | null, extra?: any) => {
    console.log('[proceedWithAction] called with targetIndex:', targetIndex, 'room:', room?.roomNumber);
    if (!room) {
      console.log('[proceedWithAction] No room, returning');
      return;
    }
    
    console.log('[proceedWithAction] Calling proceedToNextAction');
    const updatedRoom = proceedToNextAction(room, targetIndex, extra);
    console.log('[proceedWithAction] Updated room currentActionerIndex:', updatedRoom.currentActionerIndex);
    backendService.current.updateRoom(roomNumber, updatedRoom);
    
    // No need to reset dialog state - we track by action index now
  };
  
  const showPrepareToFlipDialog = () => {
    if (!room) return;
    
    let seatedCount = 0;
    room.players.forEach((player) => {
      if (player !== null) seatedCount++;
    });
    const totalSeats = room.template.roles.length;
    
    if (seatedCount !== totalSeats) {
      showAlert('无法开始游戏', '有座位尚未被占用。');
      return;
    }
    
    showAlert(
      '允许看牌？',
      '所有座位已被占用。',
      [
        { 
          text: '确定', 
          onPress: () => {
            const updatedRoom = { ...room, roomStatus: RoomStatus.seated };
            backendService.current.updateRoom(roomNumber, updatedRoom);
          }
        }
      ]
    );
  };
  
  const showStartGameDialog = () => {
    showAlert(
      '开始游戏？',
      '请将您的手机音量调整到最大。',
      [
        { 
          text: '确定', 
          onPress: async () => {
            setIsStartingGame(true); // Hide start button immediately
            await audioService.current.playNightBeginAudio();
            setTimeout(() => {
              if (room) {
                const startedRoom = startGame(room);
                backendService.current.updateRoom(roomNumber, startedRoom);
              }
            }, 5000);
          }
        }
      ]
    );
  };
  
  const showLastNightInfoDialog = () => {
    if (!room) return;
    
    showAlert(
      '确定查看昨夜信息？',
      '',
      [
        { 
          text: '确定', 
          onPress: () => {
            // Use roomRef.current to get the latest room state, not the stale closure value
            const latestRoom = roomRef.current;
            if (!latestRoom) return;
            
            const info = getLastNightInfo(latestRoom);
            showAlert('昨夜信息', info);
          }
        },
        { text: '取消', style: 'cancel' },
      ]
    );
  };
  
  const showRoleCardDialog = () => {
    const myRole = getMyRole();
    if (!myRole) return;
    
    const roleInfo = ROLES[myRole];
    const roleName = roleInfo?.displayName || myRole;
    const description = roleInfo?.description || '无技能描述';
    
    showAlert(
      `你的身份是：${roleName}`,
      `【技能介绍】\n${description}`,
      [{ text: '确定', style: 'default' }]
    );
  };
  
  const showRestartDialog = () => {
    showAlert(
      '重新开始游戏？',
      '使用相同板子开始新一局游戏。',
      [
        { 
          text: '确定', 
          onPress: () => {
            if (room) {
              const restarted = restartRoom(room);
              backendService.current.updateRoom(roomNumber, restarted);
            }
          }
        },
        { text: '取消', style: 'cancel' },
      ]
    );
  };
  
  const handleSkipAction = () => {
    showActionConfirmDialog(-1);
  };
  
  const handleLeaveRoom = () => {
    if (room?.roomStatus === RoomStatus.terminated) {
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
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>加载房间...</Text>
      </View>
    );
  }
  
  if (!room) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>房间不存在</Text>
        <Text style={styles.loadingSubtext}>房间号 {roomNumber} 不存在或已关闭</Text>
        <TouchableOpacity 
          style={styles.errorBackButton} 
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.errorBackButtonText}>返回首页</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const currentActionRole = getCurrentActionRole(room);
  
  // 生成行动消息，对于狼人包含投票状态
  const getActionMessage = () => {
    if (!currentActionRole) return '';
    
    const baseMessage = ROLES[currentActionRole]?.actionMessage || `请${ROLES[currentActionRole]?.name}行动`;
    
    // 如果是狼人回合，显示投票状态
    if (currentActionRole === 'wolf') {
      const voteSummary = getWolfVoteSummary(room);
      
      // 找到当前需要投票的狼人
      let currentVotingWolf: string | null = null;
      
      // 检查自己是否是狼人且未投票
      if (mySeatNumber !== null) {
        const myRole = getMyRole();
        if (myRole && isWolfRole(myRole) && !hasWolfVoted(room, mySeatNumber)) {
          return `${baseMessage}\n${voteSummary}`;
        } else if (myRole && isWolfRole(myRole) && hasWolfVoted(room, mySeatNumber)) {
          return `${baseMessage}\n${voteSummary} (你已投票，等待其他狼人)`;
        }
      }
      
      // Host 控制机器人狼的情况
      if (isHost) {
        const wolfSeats = getAllWolfSeats(room);
        for (const seat of wolfSeats) {
          const player = room.players.get(seat);
          if (player && player.uid.startsWith('bot_') && !hasWolfVoted(room, seat)) {
            currentVotingWolf = player.displayName || `${seat + 1}号`;
            break;
          }
        }
        if (currentVotingWolf) {
          return `${baseMessage}\n${voteSummary}\n当前: ${currentVotingWolf} 投票`;
        }
      }
      
      return `${baseMessage}\n${voteSummary}`;
    }
    
    return baseMessage;
  };
  
  const actionMessage = getActionMessage();

  // Calculate role statistics for board display
  const getRoleStats = () => {
    const roleCounts: Record<string, number> = {};
    const wolfRoles: string[] = [];
    const godRoles: string[] = [];
    const specialRoles: string[] = [];
    const villagerCount = { count: 0 };
    
    room.template.roles.forEach((role) => {
      const roleInfo = ROLES[role];
      if (!roleInfo) return;
      
      if (roleInfo.type === 'wolf') {
        roleCounts[roleInfo.displayName] = (roleCounts[roleInfo.displayName] || 0) + 1;
        if (!wolfRoles.includes(roleInfo.displayName)) {
          wolfRoles.push(roleInfo.displayName);
        }
      } else if (roleInfo.type === 'god') {
        roleCounts[roleInfo.displayName] = (roleCounts[roleInfo.displayName] || 0) + 1;
        if (!godRoles.includes(roleInfo.displayName)) {
          godRoles.push(roleInfo.displayName);
        }
      } else if (roleInfo.type === 'special') {
        roleCounts[roleInfo.displayName] = (roleCounts[roleInfo.displayName] || 0) + 1;
        if (!specialRoles.includes(roleInfo.displayName)) {
          specialRoles.push(roleInfo.displayName);
        }
      } else if (role === 'villager') {
        villagerCount.count++;
      }
    });
    
    return { roleCounts, wolfRoles, godRoles, specialRoles, villagerCount: villagerCount.count };
  };
  
  const { roleCounts, wolfRoles, godRoles, specialRoles, villagerCount } = getRoleStats();
  
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
        {/* Board Info - Role Configuration */}
        <View style={styles.boardInfoContainer}>
          <Text style={styles.boardInfoTitle}>板子配置 ({room.template.roles.length}人局)</Text>
          <View style={styles.boardInfoContent}>
            {/* Wolf roles */}
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>🐺 狼人：</Text>
              <Text style={styles.roleCategoryText}>
                {wolfRoles.map(r => `${r}${roleCounts[r] > 1 ? `×${roleCounts[r]}` : ''}`).join('、') || '无'}
              </Text>
            </View>
            {/* God roles */}
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>✨ 神职：</Text>
              <Text style={styles.roleCategoryText}>
                {godRoles.map(r => `${r}${roleCounts[r] > 1 ? `×${roleCounts[r]}` : ''}`).join('、') || '无'}
              </Text>
            </View>
            {/* Special roles */}
            {specialRoles.length > 0 && (
              <View style={styles.roleCategory}>
                <Text style={styles.roleCategoryLabel}>🎭 特殊：</Text>
                <Text style={styles.roleCategoryText}>
                  {specialRoles.map(r => `${r}${roleCounts[r] > 1 ? `×${roleCounts[r]}` : ''}`).join('、')}
                </Text>
              </View>
            )}
            {/* Villagers */}
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
          {room.template.roles.map((role, index) => {
            const player = room.players.get(index);
            const isWolf = showWolves && isWolfRole(role) && 
                          role !== 'wolfRobot' && role !== 'gargoyle';
            const isSelected = anotherIndex === index;
            const isMySpot = mySeatNumber === index;
            
            return (
              <View key={index} style={styles.tileWrapper}>
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
                  {/* Avatar background for seated players */}
                  {player && (
                    <View style={styles.avatarContainer}>
                      <Avatar 
                        value={player.uid} 
                        size={TILE_SIZE - 16} 
                        avatarUrl={player.avatarUrl}
                        seatNumber={player.seatNumber}
                        roomId={room.roomNumber}
                      />
                      {/* Overlay for wolf/selected state */}
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
                
                {/* Player name below tile */}
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
      </ScrollView>
      
      {/* Bottom Buttons */}
      <View style={styles.buttonContainer}>
        {/* Host: Prepare to Flip */}
        {isHost && room.roomStatus === RoomStatus.seating && (
          <TouchableOpacity style={styles.actionButton} onPress={showPrepareToFlipDialog}>
            <Text style={styles.buttonText}>准备看牌</Text>
          </TouchableOpacity>
        )}

        {/* Host: Fill with Bots (Demo Testing) */}
        {isHost && room.roomStatus === RoomStatus.seating && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#F59E0B' }]} 
            onPress={() => {
              showAlert(
                '填充测试机器人',
                '⚠️ 仅供测试使用\n\n将用机器人填满所有座位，房主作为法官观察流程。\n\n确定要继续吗？',
                [
                  { text: '取消', style: 'cancel' },
                  { 
                    text: '确定', 
                    onPress: () => {
                      backendService.current.fillWithBots(roomNumber).then((count) => {
                        if (count > 0) {
                          showAlert('已填充', `已用 ${count} 个机器人填满所有座位`);
                        }
                      });
                    }
                  },
                ]
              );
            }}
          >
            <Text style={styles.buttonText}>🤖 填充机器人 (测试)</Text>
          </TouchableOpacity>
        )}
        
        {/* Host: Start Game */}
        {isHost && room.roomStatus === RoomStatus.seated && !isStartingGame && (
          <TouchableOpacity style={styles.actionButton} onPress={showStartGameDialog}>
            <Text style={styles.buttonText}>开始游戏</Text>
          </TouchableOpacity>
        )}
        
        {/* Actioner: Skip Action - only for roles that can skip */}
        {imActioner && room.roomStatus === RoomStatus.ongoing && !isAudioPlaying && (() => {
          const actingRole = getActingRole();
          // These roles cannot skip their action:
          // - hunter: only confirms skill status (handled by dialog)
          // - darkWolfKing: only confirms skill status (handled by dialog)
          // - wolfRobot: must check a player
          // - slacker: only confirms identity
          // - seer/psychic: should check someone (but can technically skip)
          const noSkipRoles: RoleName[] = ['hunter', 'darkWolfKing', 'wolfRobot', 'slacker'];
          return actingRole && !noSkipRoles.includes(actingRole);
        })() && (
          <TouchableOpacity style={styles.actionButton} onPress={handleSkipAction}>
            <Text style={styles.buttonText}>
              {getActingRole() === 'wolf' ? '投票空刀' : '不使用技能'}
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
        {room.roomStatus !== RoomStatus.seating && mySeatNumber !== null && (
          <TouchableOpacity style={styles.actionButton} onPress={showRoleCardDialog}>
            <Text style={styles.buttonText}>查看身份</Text>
          </TouchableOpacity>
        )}
        
        {/* Greyed View Role (waiting for host) */}
        {room.roomStatus === RoomStatus.seating && mySeatNumber !== null && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.disabledButton]}
            onPress={() => showAlert('等待房主确认所有人已入座')}
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

      {/* Custom Alert Modal */}
      {alertConfig && (
        <AlertModal
          visible={true}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          onClose={() => setAlertConfig(null)}
        />
      )}
    </View>
  );
};

export default RoomScreen;

