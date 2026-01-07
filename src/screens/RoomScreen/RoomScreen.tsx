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
  Room, 
  RoomStatus, 
  createRoom, 
  getCurrentActionRole,
  getKilledIndex,
  getHunterStatus,
  getDarkWolfKingStatus,
  getAllWolfSeats,
  getLastNightInfo,
  getActionLog,
  performSeerAction,
  performPsychicAction,
  getWolfVoteSummary,
  hasWolfVoted,
  getPlayersNotViewedRole,
} from '../../models/Room';
import { RoleName, ROLES, isWolfRole } from '../../constants/roles';
import AudioService from '../../services/AudioService';
import { AuthService } from '../../services/AuthService';
import { RoomService } from '../../services/RoomService';
import { SeatService } from '../../services/SeatService';
import { showAlert } from '../../utils/alert';
import { Avatar } from '../../components/Avatar';
import { styles, TILE_SIZE } from './RoomScreen.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

// Helper function to check if current actioner is a bot (or all bots for wolf turn)
function checkIfCurrentActionerBot(room: Room, currentActionRole: RoleName | null): boolean {
  if (!currentActionRole) return false;
  
  // For wolf turn, check if there are any bot wolves that haven't voted yet
  if (currentActionRole === 'wolf') {
    let hasUnvotedBotWolf = false;
    for (const [seat, player] of room.players.entries()) {
      if (player?.role && isWolfRole(player.role) && player.uid.startsWith('bot_')) {
        if (!hasWolfVoted(room, seat)) {
          hasUnvotedBotWolf = true;
          break;
        }
      }
    }
    return hasUnvotedBotWolf;
  }
  
  // For other roles, find the player with the current action role
  // and check if they are a bot
  for (const [, player] of room.players.entries()) {
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
  room: Room,
  isHost: boolean
): ActionerState {
  if (!currentActionRole) {
    return { imActioner: false, showWolves: false };
  }
  
  // My role matches current action
  if (myRole === currentActionRole) {
    return handleMatchingRole(myRole, mySeatNumber, room);
  }
  
  // Wolf team members during wolf turn
  if (currentActionRole === 'wolf' && myRole && isWolfRole(myRole)) {
    return handleWolfTeamTurn(mySeatNumber, room);
  }
  
  // Bot players auto-act randomly, so we don't set imActioner for host
  // This means bots will be handled by the auto-bot-action effect instead
  
  return { imActioner: false, showWolves: false };
}

function handleMatchingRole(myRole: RoleName, mySeatNumber: number | null, room: Room): ActionerState {
  // For wolves, check if already voted
  if (myRole === 'wolf' && mySeatNumber !== null && hasWolfVoted(room, mySeatNumber)) {
    return { imActioner: false, showWolves: true };
  }
  
  // Show wolves to wolf team (except nightmare, gargoyle, wolfRobot)
  const showWolves = isWolfRole(myRole) && 
    myRole !== 'nightmare' && 
    myRole !== 'gargoyle' && 
    myRole !== 'wolfRobot';
  
  return { imActioner: true, showWolves };
}

function handleWolfTeamTurn(mySeatNumber: number | null, room: Room): ActionerState {
  // Check if this wolf has already voted
  const hasVoted = mySeatNumber !== null && hasWolfVoted(room, mySeatNumber);
  return { imActioner: !hasVoted, showWolves: true };
}

export const RoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const { roomNumber, isHost, template } = route.params;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('加载房间...');
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [firstNightEnded, setFirstNightEnded] = useState(false);
  const [anotherIndex, setAnotherIndex] = useState<number | null>(null); // For Magician
  const [isStartingGame, setIsStartingGame] = useState(false); // Hide start button after clicking

  // Modal state for web compatibility
  const [seatModalVisible, setSeatModalVisible] = useState(false);
  const [pendingSeatIndex, setPendingSeatIndex] = useState<number | null>(null);
  const [modalType, setModalType] = useState<'enter' | 'leave'>('enter');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const audioService = useRef(AudioService.getInstance());
  const authService = useRef(AuthService.getInstance());
  const roomService = useRef(RoomService.getInstance());
  const seatService = useRef(SeatService.getInstance());
  const lastPlayedActionIndex = useRef<number | null>(null);
  const roomRef = useRef<Room | null>(null); // Keep latest room for closures

  // Initialize currentUserId and refresh when needed
  useEffect(() => {
    const initUserId = async () => {
      await authService.current.waitForInit();
      setCurrentUserId(authService.current.getCurrentUserId());
    };
    initUserId();
  }, []);
  
  // Derived state: is audio currently playing (from room state, synced across all clients)
  const isAudioPlaying = room?.isAudioPlaying ?? false;

  // Computed values using useMemo - these are synchronously derived from room state
  // No more race conditions between effects
  const mySeatNumber = useMemo(() => {
    if (!room || !currentUserId) return null;
    const myUserId = currentUserId || 'anonymous';
    for (const [seat, player] of room.players.entries()) {
      if (player?.uid === myUserId) return seat;
    }
    return null;
  }, [room, currentUserId]);

  const myRole = useMemo((): RoleName | null => {
    if (!room || mySeatNumber === null) return null;
    // Get role from player.role (assigned during "准备看牌")
    // In seating status, player.role is null
    const player = room.players.get(mySeatNumber);
    return player?.role ?? null;
  }, [room, mySeatNumber]);

  const currentActionRole = useMemo((): RoleName | null => {
    if (!room) return null;
    return getCurrentActionRole(room);
  }, [room]);

  const { imActioner, showWolves } = useMemo(() => {
    if (!room || room.roomStatus !== RoomStatus.ongoing || !currentActionRole) {
      return { imActioner: false, showWolves: false };
    }
    return determineActionerState(myRole, currentActionRole, mySeatNumber, room, isHost);
  }, [room, myRole, currentActionRole, mySeatNumber, isHost]);

  // Check if room has any bots (fill with bot mode)
  const hasBots = useMemo(() => {
    if (!room) return false;
    for (const [, player] of room.players.entries()) {
      if (player?.uid.startsWith('bot_')) {
        return true;
      }
    }
    return false;
  }, [room]);

  // Get action log for bot mode display
  const actionLog = useMemo(() => {
    if (!room || !hasBots || room.roomStatus !== RoomStatus.ongoing) {
      return [];
    }
    return getActionLog(room);
  }, [room, hasBots]);

  // Keep roomRef in sync with room state
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // Subscribe to room updates
  useEffect(() => {
    if (!roomNumber) return;
    
    console.log('Subscribing to room:', roomNumber);
    const unsubscribe = roomService.current.subscribeToRoom(
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
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  
  const createRoomAndSit = useCallback(async () => {
    // Only create once
    if (hasCreatedRoom.current || isCreatingRoom) return;
    if (!isHost || !template) return;
    
    hasCreatedRoom.current = true;
    setIsCreatingRoom(true);
    setLoadingMessage('正在登录...');
    
    try {
      // Wait for backend to be ready (auth initialized) with timeout
      await authService.current.waitForInit?.();
      const userId = authService.current.getCurrentUserId() || 'anonymous';
      
      setLoadingMessage('正在创建房间...');
      console.log('Creating room as host:', roomNumber, 'userId:', userId);
      const newRoom = createRoom(userId, roomNumber, template);
      console.log('Room created:', newRoom.roomNumber, 'status:', newRoom.roomStatus);
      
      // Try to create room - if it already exists (409/400), delete and recreate
      try {
        await roomService.current.createRoom(roomNumber, newRoom);
      } catch (createError: unknown) {
        const errorMessage = createError instanceof Error ? createError.message : String(createError);
        // Room might already exist from a previous session - delete and recreate
        if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
          console.log('Room already exists, deleting and recreating...');
          setLoadingMessage('重新创建房间...');
          await roomService.current.deleteRoom(roomNumber);
          await roomService.current.createRoom(roomNumber, newRoom);
        } else {
          throw createError;
        }
      }
      
      // Auto-sit host on seat 1 (index 0)
      setLoadingMessage('正在入座...');
      console.log('Auto-seating host on seat 1');
      await seatService.current.takeSeat(roomNumber, 0, null);
    } catch (error) {
      console.error('Failed to create room:', error);
      hasCreatedRoom.current = false; // Allow retry
      setLoadingMessage('创建失败');
      const errorMessage = error instanceof Error ? error.message : '创建房间失败';
      showAlert('创建失败', errorMessage, [
        { text: '重试', onPress: () => { createRoomAndSit(); } },
        { text: '返回', style: 'cancel', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setIsCreatingRoom(false);
    }
  }, [isHost, template, roomNumber, isCreatingRoom, navigation]);
  
  useEffect(() => {
    createRoomAndSit();
  }, [createRoomAndSit]);
  
  // Loading timeout - show retry button after 5 seconds
  useEffect(() => {
    if (!loading) {
      setShowRetryButton(false);
      return;
    }
    
    const timeout = setTimeout(() => {
      if (loading) {
        setShowRetryButton(true);
        setLoadingMessage('加载超时');
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [loading]);
  
  // Track when first night ends (one-time trigger)
  // Also reset isStartingGame when game is restarted
  useEffect(() => {
    if (!room) return;
    
    // Reset when game is restarted (goes back to unseated or seated status)
    if (room.roomStatus === RoomStatus.unseated || room.roomStatus === RoomStatus.seated) {
      setFirstNightEnded(false);
      setIsStartingGame(false);  // Reset so buttons show again after restart
      return;
    }
    
    if (room.roomStatus === RoomStatus.ongoing && !currentActionRole) {
      setFirstNightEnded(true);
    }
  }, [room, currentActionRole]);
  
  // Ref to store the latest showActionDialog callback
  const showActionDialogRef = useRef<((role: RoleName) => void) | null>(null);
  
  // Ref to store the latest handleBotAction callback
  const handleBotActionRef = useRef<((role: RoleName) => void) | null>(null);
  
  // Track which action index we've already shown dialog for (to avoid duplicates)
  const lastShownDialogIndex = useRef<number | null>(null);
  
  // Play audio for current action role (host only) and handle post-audio actions
  // This is the main flow controller - after audio completes, it directly triggers:
  // 1. For bots: auto-action
  // 2. For host player: show action dialog
  // Non-host players listen to isAudioPlaying state separately
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
      
      const playAudioAndHandleAction = async () => {
        // Use roomRef for the latest local state to avoid overwriting concurrent updates
        // roomRef is updated by the subscription, so it has the latest state
        const currentRoomState = roomRef.current;
        if (!currentRoomState) return;
        
        // Set isAudioPlaying = true in room (sync to all clients)
        // V2: Use atomic RPC update instead of full room update
        await roomService.current.setAudioPlaying(roomNumber, true);
        
        if (currentRole) {
          console.log('[Host Audio] Playing audio for role:', currentRole);
          await audioService.current.playRoleBeginningAudio(currentRole);
        } else {
          // Night has ended - no more actions
          console.log('[Host Audio] Playing night end audio');
          await audioService.current.playNightEndAudio();
        }
        
        // Audio finished - get latest room state from ref (not database)
        // This ensures we have all concurrent updates (like wolf votes)
        const latestRoom = roomRef.current;
        if (latestRoom) {
          console.log('[Host Audio] Setting isAudioPlaying=false. roomStatus:', latestRoom.roomStatus);
          // V2: Use atomic RPC update instead of full room update
          await roomService.current.setAudioPlaying(roomNumber, false);
          
          // === POST-AUDIO ACTION (Host only) ===
          // After audio completes and isAudioPlaying is set to false,
          // immediately handle the action without waiting for state sync
          if (currentRole) {
            // Check if current actioner is a bot
            const isBot = checkIfCurrentActionerBot(latestRoom, currentRole);
            console.log('[Host Audio] Audio finished. Role:', currentRole, 'isBot:', isBot);
            
            if (isBot) {
              // Bot turn - trigger auto-action
              console.log('[Host Audio] Triggering bot auto-action for:', currentRole);
              handleBotActionRef.current?.(currentRole);
            } else {
              // Check if host is the actioner
              const hostIsActioner = determineActionerState(
                roomRef.current ? (roomRef.current.players.get(mySeatNumber ?? -1)?.role ?? null) : null,
                currentRole,
                mySeatNumber,
                latestRoom,
                true
              ).imActioner;
              
              if (hostIsActioner) {
                console.log('[Host Audio] Host is actioner, showing dialog for:', currentRole);
                lastShownDialogIndex.current = currentIndex;
                showActionDialogRef.current?.(currentRole);
              }
            }
          }
        }
      };
      
      playAudioAndHandleAction();
    }
  }, [room?.currentActionerIndex, room?.roomStatus, isHost, roomNumber, mySeatNumber]);
  
  // Show action dialog for NON-HOST players when audio finishes (isAudioPlaying becomes false)
  // Host handles their own dialog in the audio effect above
  // Each player shows dialog only once per action index
  useEffect(() => {
    // Skip for host - host handles dialog in audio effect
    if (isHost) return;
    
    if (!room || room.roomStatus !== RoomStatus.ongoing) {
      lastShownDialogIndex.current = null;
      return;
    }
    
    const currentIndex = room.currentActionerIndex;
    const currentRole = getCurrentActionRole(room);
    
    // Debug log
    console.log('[ActionDialog Effect] (non-host) currentIndex:', currentIndex, 
      'currentRole:', currentRole, 
      'isAudioPlaying:', room.isAudioPlaying, 
      'imActioner:', imActioner,
      'myRole:', myRole,
      'mySeatNumber:', mySeatNumber,
      'lastShownDialogIndex:', lastShownDialogIndex.current);
    
    // Show dialog when:
    // 1. Audio is not playing (finished or never started)
    // 2. I'm an actioner for this role
    // 3. We haven't shown dialog for this index yet
    if (!room.isAudioPlaying && imActioner && currentRole && 
        lastShownDialogIndex.current !== currentIndex) {
      console.log('[ActionDialog Effect] Showing action dialog for role:', currentRole, 'at index:', currentIndex);
      lastShownDialogIndex.current = currentIndex;
      showActionDialogRef.current?.(currentRole);
    }
  }, [room?.isAudioPlaying, room?.currentActionerIndex, room?.roomStatus, imActioner, room, myRole, mySeatNumber, isHost]);

  // Bot auto-view role: When bots haven't viewed their roles, automatically mark them as having viewed
  // Only host handles bot role viewing to avoid duplicates
  // Note: Bot mode is single-user testing only, so no concurrency issues
  useEffect(() => {
    if (!room || !isHost) return;
    
    // Check if there are any bots that haven't viewed their roles and have a role assigned
    const botsNotViewed: number[] = [];
    room.players.forEach((player, seat) => {
      if (player?.uid.startsWith('bot_') && player.role && !player.hasViewedRole) {
        botsNotViewed.push(seat);
      }
    });
    
    if (botsNotViewed.length === 0) return;
    
    console.log('[Bot Auto-View] Found bots that need to view roles:', botsNotViewed);
    
    // Small delay to make it feel natural
    const timer = setTimeout(async () => {
      console.log('[Bot Auto-View] Marking all bots as having viewed their roles via RPC');
      
      // Use atomic RPC for each bot (sequential to be safe)
      for (const seat of botsNotViewed) {
        await roomService.current.markPlayerViewedRole(roomNumber, seat);
      }
    }, 800);
    
    return () => clearTimeout(timer);
  }, [room?.roomStatus, room?.players, isHost, roomNumber]);

  // Bot auto-action function - called by host after audio finishes
  // This handles the actual bot action logic
  const handleBotAction = useCallback((role: RoleName) => {
    const latestRoom = roomRef.current;
    if (!latestRoom || latestRoom.roomStatus !== RoomStatus.ongoing) {
      console.log('[Bot Action] Room not ready, skipping');
      return;
    }
    
    console.log('[Bot Action] Executing bot action for role:', role);
    const numberOfPlayers = latestRoom.template.numberOfPlayers;
    
    // Small delay to make it feel natural
    const delay = 500 + Math.random() * 1000;
    
    setTimeout(async () => {
      // Re-fetch latest room state
      const currentRoom = roomRef.current;
      if (!currentRoom || currentRoom.roomStatus !== RoomStatus.ongoing) {
        console.log('[Bot Action] Room no longer ongoing, skipping');
        return;
      }
      
      const currentIndex = currentRoom.currentActionerIndex;
      
      // Different handling based on role
      if (role === 'witch') {
        console.log('[Bot Action] Witch bot skipping action');
        await roomService.current.proceedAction(roomNumber, null, 'witch_skip', currentIndex, role);
      } else if (role === 'hunter' || role === 'darkWolfKing') {
        console.log('[Bot Action] Hunter/DarkWolfKing bot proceeding');
        await roomService.current.proceedAction(roomNumber, null, 'normal', currentIndex, role);
      } else if (role === 'magician') {
        const shouldAct = Math.random() > 0.3;
        if (shouldAct && numberOfPlayers >= 2) {
          const first = Math.floor(Math.random() * numberOfPlayers);
          let second = Math.floor(Math.random() * numberOfPlayers);
          while (second === first) {
            second = Math.floor(Math.random() * numberOfPlayers);
          }
          const target = first + second * 100;
          console.log('[Bot Action] Magician bot swapping:', first, 'and', second);
          await roomService.current.proceedAction(roomNumber, target, 'normal', currentIndex, role);
        } else {
          console.log('[Bot Action] Magician bot skipping');
          await roomService.current.proceedAction(roomNumber, null, 'normal', currentIndex, role);
        }
      } else if (role === 'wolf') {
        // All bot wolves auto-vote for random target using RPC
        const allWolfSeats = getAllWolfSeats(currentRoom);
        const botWolves: number[] = [];
        currentRoom.players.forEach((player, seat) => {
          if (player?.role && isWolfRole(player.role) && player.uid.startsWith('bot_')) {
            if (!hasWolfVoted(currentRoom, seat)) {
              botWolves.push(seat);
            }
          }
        });
        
        console.log('[Bot Action] Bot wolves that need to vote:', botWolves);
        
        if (botWolves.length > 0) {
          const target = Math.floor(Math.random() * numberOfPlayers);
          console.log('[Bot Action] Bot wolves voting for target:', target);
          
          // Record votes for all bot wolves using RPC
          for (const wolfSeat of botWolves) {
            const result = await roomService.current.recordWolfVote(roomNumber, wolfSeat, target, allWolfSeats);
            console.log(`[Bot Action] Wolf ${wolfSeat} vote result:`, result);
            // RPC will auto-advance when all wolves have voted
            if (result.allWolvesVoted) {
              console.log('[Bot Action] All wolves voted, new index:', result.newIndex);
              break;  // No need to continue, game has advanced
            }
          }
        }
      } else {
        // Other roles: random target or skip
        const shouldAct = Math.random() > 0.2;
        if (shouldAct) {
          const target = Math.floor(Math.random() * numberOfPlayers);
          console.log('[Bot Action] Bot', role, 'targeting:', target);
          await roomService.current.proceedAction(roomNumber, target, 'normal', currentIndex, role);
        } else {
          console.log('[Bot Action] Bot', role, 'skipping');
          await roomService.current.proceedAction(roomNumber, null, 'normal', currentIndex, role);
        }
      }
    }, delay);
  }, [roomNumber]);
  
  // Keep handleBotActionRef updated
  handleBotActionRef.current = handleBotAction;
  
  const getMyRole = useCallback((): RoleName | null => {
    if (!room || mySeatNumber === null) return null;
    // Get role from player.role (assigned during "准备看牌")
    const player = room.players.get(mySeatNumber);
    return player?.role ?? null;
  }, [room, mySeatNumber]);

  // Get the role currently being acted (for host controlling bots)
  const getActingRole = useCallback((): RoleName | null => {
    if (!room) return null;
    
    const currentActionRole = getCurrentActionRole(room);
    
    // If I'm the host and controlling a bot, return the current action role
    if (isHost && imActioner && currentActionRole) {
      // Check if my own role matches - if so, use my role
      const player = mySeatNumber === null ? null : room.players.get(mySeatNumber);
      const myRoleValue = player?.role ?? null;
      if (myRoleValue === currentActionRole) {
        return myRoleValue;
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
  
  const handleSeatingTap = (index: number) => {
    console.log('In seating mode, isHost:', isHost, 'mySeatNumber:', mySeatNumber);
    // 如果点击的是自己的座位，询问是否站起
    if (mySeatNumber !== null && index === mySeatNumber) {
      showLeaveSeatDialog(index);
    } else {
      console.log('Showing enter seat dialog for index:', index);
      showEnterSeatDialog(index);
    }
  };

  const handleActionTap = (index: number) => {
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
    
    console.log('Room status:', room.roomStatus, 'RoomStatus.unseated:', RoomStatus.unseated);
    
    if (room.roomStatus === RoomStatus.unseated || room.roomStatus === RoomStatus.seated) {
      handleSeatingTap(index);
    } else if (room.roomStatus === RoomStatus.ongoing && imActioner) {
      handleActionTap(index);
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
    const result = await seatService.current.takeSeat(roomNumber, pendingSeatIndex, mySeatNumber);
    console.log('takeSeat result:', result);
    
    setSeatModalVisible(false);
    
    if (result === -1) {
      // Seat already taken - show alert
      showAlert(`${pendingSeatIndex + 1}号座已被占用`, '请选择其他位置。');
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
    
    seatService.current.leaveSeat(roomNumber, pendingSeatIndex);
    // Note: mySeatNumber is now computed from room state, no need to manually set
    setSeatModalVisible(false);
    setPendingSeatIndex(null);
  };
  
  // 找到需要投票的狼人座位
  const findVotingWolfSeat = (): number | null => {
    // 首先检查自己是否是狼人且未投票
    if (mySeatNumber !== null) {
      const myRole = getMyRole();
      if (myRole && isWolfRole(myRole) && !hasWolfVoted(room!, mySeatNumber)) {
        return mySeatNumber;
      }
    }
    
    // 如果自己不是狼人或已投票，作为 host 找第一个未投票的机器人狼
    if (!isHost || !room) return null;
    
    const wolfSeats = getAllWolfSeats(room);
    for (const seat of wolfSeats) {
      const player = room.players.get(seat);
      if (player && player.uid.startsWith('bot_') && !hasWolfVoted(room, seat)) {
        return seat;
      }
    }
    return null;
  };

  const buildActionMessage = (index: number, actingRole: RoleName): string => {
    const roleInfo = ROLES[actingRole];
    const actionConfirmMessage = roleInfo?.actionConfirmMessage || '对';
    
    if (index === -1) {
      return '确定不发动技能吗？';
    }
    if (anotherIndex === null) {
      return `确定${actionConfirmMessage}${index + 1}号玩家?`;
    }
    return `确定${actionConfirmMessage}${index + 1}号和${anotherIndex + 1}号玩家?`;
  };

  const showActionConfirmDialog = (index: number) => {
    const actingRole = getActingRole();
    if (!actingRole) return;
    
    // 狼人投票使用单独的确认对话框
    if (actingRole === 'wolf') {
      const votingWolfSeat = findVotingWolfSeat();
      if (votingWolfSeat !== null) {
        showWolfVoteConfirmDialog(index, votingWolfSeat);
        return;
      }
    }
    
    const msg = buildActionMessage(index, actingRole);
    
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
    const allWolfSeats = getAllWolfSeats(room);
    
    const msg = targetIndex === -1 
      ? `${wolfName} 确定投票空刀吗？` 
      : `${wolfName} 确定要猎杀${targetIndex + 1}号玩家吗？`;
    
    showAlert(
      '狼人投票',
      msg,
      [
        { 
          text: '确定', 
          onPress: async () => {
            // 使用 RPC 记录狼人投票，自动处理所有狼人投票完成后的推进
            const result = await roomService.current.recordWolfVote(
              roomNumber,
              wolfSeat,
              targetIndex,
              allWolfSeats
            );
            
            if (!result.success) {
              console.error('[Wolf Vote] RPC failed:', result.error);
            } else {
              console.log('[Wolf Vote] RPC success, allWolvesVoted:', result.allWolvesVoted);
              // Real-time subscription will update the UI
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
  
  const proceedWithAction = async (targetIndex: number | null, extra?: any) => {
    console.log('[proceedWithAction] called with targetIndex:', targetIndex, 'extra:', extra);
    if (!room) {
      console.log('[proceedWithAction] No room, returning');
      return;
    }
    
    const currentIndex = room.currentActionerIndex;
    const currentRole = getCurrentActionRole(room);
    
    // Determine action type for witch
    let actionType: 'normal' | 'witch_save' | 'witch_poison' | 'witch_skip' | 'skip' = 'normal';
    if (currentRole === 'witch') {
      if (targetIndex === null) {
        actionType = 'witch_skip';
      } else if (extra === false) {
        actionType = 'witch_save';
      } else {
        actionType = 'witch_poison';
      }
    }
    
    console.log('[proceedWithAction] Calling RPC with index:', currentIndex, 'actionType:', actionType, 'role:', currentRole);
    const result = await roomService.current.proceedAction(
      roomNumber,
      targetIndex,
      actionType,
      currentIndex,
      currentRole ?? undefined
    );
    
    if (!result.success) {
      console.error('[proceedWithAction] RPC failed:', result.error);
      // State was already updated by another client, subscription will sync
    } else {
      console.log('[proceedWithAction] RPC success, new index:', result.newIndex);
    }
    
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
      '所有座位已被占用。将洗牌并分配角色。',
      [
        { 
          text: '确定', 
          onPress: async () => {
            // IMPORTANT: Use roomRef.current to get latest room state
            const latestRoom = roomRef.current;
            if (!latestRoom) {
              console.error('[AssignRoles] No latestRoom available!');
              return;
            }
            console.log('[AssignRoles] Current roomStatus:', latestRoom.roomStatus, 'Players count:', latestRoom.players.size);
            
            // V2: Use RPC to assign roles atomically on server side
            try {
              const result = await roomService.current.assignRoles(roomNumber, currentUserId ?? '');
              if (result.success) {
                console.log('[AssignRoles] RPC assignRoles succeeded');
              } else {
                console.error('[AssignRoles] RPC assignRoles failed:', result.error);
              }
            } catch (error) {
              console.error('[AssignRoles] assignRoles failed:', error);
            }
          }
        }
      ]
    );
  };
  
  const handleStartGame = async () => {
    console.log('[handleStartGame] Starting game...');
    setIsStartingGame(true); // Hide start button immediately
    try {
      console.log('[handleStartGame] Playing night begin audio...');
      await audioService.current.playNightBeginAudio();
      console.log('[handleStartGame] Night begin audio finished, waiting 5s...');
    } catch (error) {
      console.error('[handleStartGame] Audio error:', error);
    }
    setTimeout(async () => {
      console.log('[handleStartGame] 5s timeout reached, starting game...');
      if (currentUserId) {
        const result = await roomService.current.startGame(roomNumber, currentUserId);
        console.log('[handleStartGame] startGame result:', result);
        if (!result.success) {
          console.error('[handleStartGame] startGame failed:', result.error);
        }
      }
    }, 5000);
  };

  const showStartGameDialog = () => {
    showAlert(
      '开始游戏？',
      '请将您的手机音量调整到最大。',
      [
        { 
          text: '确定', 
          onPress: () => { handleStartGame(); }
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
  
  const showRoleCardDialog = async () => {
    const myRole = getMyRole();
    if (!myRole) return;
    
    const roleInfo = ROLES[myRole];
    const roleName = roleInfo?.displayName || myRole;
    const description = roleInfo?.description || '无技能描述';
    
    // Mark player as having viewed their role using ATOMIC RPC operation
    // This prevents race conditions when multiple players view simultaneously
    // ALWAYS call RPC - don't check local state because it may be stale after room restart
    // The RPC is IDEMPOTENT (server-side check), so multiple calls are safe
    // IMPORTANT: Must await RPC before showing dialog to ensure DB is updated
    // before the next player tries to view their role
    if (mySeatNumber !== null) {
      const latestRoom = roomRef.current;
      if (latestRoom) {
        const myPlayer = latestRoom.players.get(mySeatNumber);
        console.log(`[ViewRole] Seat ${mySeatNumber}: hasViewedRole=${myPlayer?.hasViewedRole}, roomStatus=${latestRoom.roomStatus}`);
        // Use atomic RPC instead of read-modify-write pattern
        // Don't skip based on local hasViewedRole - it may be stale after restart
        try {
          const result = await roomService.current.markPlayerViewedRole(roomNumber, mySeatNumber);
          console.log(`[ViewRole] Seat ${mySeatNumber}: RPC result:`, JSON.stringify(result));
        } catch (err) {
          console.error(`[ViewRole] Seat ${mySeatNumber}: RPC error:`, err);
        }
      }
    }
    
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
          onPress: async () => {
            if (currentUserId) {
              console.log('[Restart] Calling restartGame RPC...');
              const result = await roomService.current.restartGame(roomNumber, currentUserId);
              console.log('[Restart] restartGame result:', result);
              if (!result.success) {
                console.error('[Restart] restartGame failed:', result.error);
              }
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
    // If game is in progress (ongoing), leave without confirmation
    if (room?.roomStatus === RoomStatus.ongoing) {
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
        <Text style={styles.loadingText}>{loadingMessage}</Text>
        {showRetryButton && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <TouchableOpacity 
              style={[styles.errorBackButton, { backgroundColor: '#FF9800' }]} 
              onPress={() => {
                hasCreatedRoom.current = false;
                setShowRetryButton(false);
                setLoadingMessage('重试中...');
                createRoomAndSit();
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
  
  // Use the computed currentActionRole from useMemo
  
  // 生成行动消息，对于狼人包含投票状态
  // 获取我的狼人投票状态消息
  const getMyWolfVoteStatus = (baseMessage: string, voteSummary: string): string | null => {
    if (mySeatNumber === null) return null;
    
    const myRole = getMyRole();
    if (!myRole || !isWolfRole(myRole)) return null;
    
    if (hasWolfVoted(room, mySeatNumber)) {
      return `${baseMessage}\n${voteSummary} (你已投票，等待其他狼人)`;
    }
    return `${baseMessage}\n${voteSummary}`;
  };

  // 获取机器人狼的投票状态消息
  const getBotWolfVoteStatus = (baseMessage: string, voteSummary: string): string | null => {
    if (!isHost) return null;
    
    const wolfSeats = getAllWolfSeats(room);
    for (const seat of wolfSeats) {
      const player = room.players.get(seat);
      if (player && player.uid.startsWith('bot_') && !hasWolfVoted(room, seat)) {
        const wolfName = player.displayName || `${seat + 1}号`;
        return `${baseMessage}\n${voteSummary}\n当前: ${wolfName} 投票`;
      }
    }
    return null;
  };

  const getActionMessage = () => {
    if (!currentActionRole) return '';
    
    const baseMessage = ROLES[currentActionRole]?.actionMessage || `请${ROLES[currentActionRole]?.name}行动`;
    
    // 非狼人回合直接返回基础消息
    if (currentActionRole !== 'wolf') {
      return baseMessage;
    }
    
    // 狼人回合，显示投票状态
    const voteSummary = getWolfVoteSummary(room);
    
    // 检查自己是否是狼人
    const myStatus = getMyWolfVoteStatus(baseMessage, voteSummary);
    if (myStatus) return myStatus;
    
    // Host 控制机器人狼的情况
    const botStatus = getBotWolfVoteStatus(baseMessage, voteSummary);
    if (botStatus) return botStatus;
    
    return `${baseMessage}\n${voteSummary}`;
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

  // Helper function to format role list with counts
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
        {/* Board Info - Role Configuration */}
        <View style={styles.boardInfoContainer}>
          <Text style={styles.boardInfoTitle}>板子配置 ({room.template.roles.length}人局)</Text>
          <View style={styles.boardInfoContent}>
            {/* Wolf roles */}
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>🐺 狼人：</Text>
              <Text style={styles.roleCategoryText}>
                {formatRoleList(wolfRoles, roleCounts)}
              </Text>
            </View>
            {/* God roles */}
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>✨ 神职：</Text>
              <Text style={styles.roleCategoryText}>
                {formatRoleList(godRoles, roleCounts)}
              </Text>
            </View>
            {/* Special roles */}
            {specialRoles.length > 0 && (
              <View style={styles.roleCategory}>
                <Text style={styles.roleCategoryLabel}>🎭 特殊：</Text>
                <Text style={styles.roleCategoryText}>
                  {formatRoleList(specialRoles, roleCounts)}
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
                  {/* Avatar background for seated players */}
                  {player && (
                    <View style={styles.avatarContainer}>
                      <Avatar 
                        value={player.uid} 
                        size={TILE_SIZE - 16} 
                        avatarUrl={player.avatarUrl}
                        seatNumber={player.seatNumber + 1}
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
        
        {/* Show players who haven't viewed their roles yet */}
        {isHost && room.roomStatus === RoomStatus.assigned && (() => {
          const notViewed = getPlayersNotViewedRole(room);
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
        {isHost && hasBots && room.roomStatus === RoomStatus.ongoing && actionLog.length > 0 && (
          <View style={styles.actionLogContainer}>
            <Text style={styles.actionLogTitle}>📋 行动记录</Text>
            {actionLog.map((log, index) => (
              <Text key={index} style={styles.actionLogItem}>{log}</Text>
            ))}
          </View>
        )}
      </ScrollView>
      
      {/* Bottom Buttons */}
      <View style={styles.buttonContainer}>
        {/* Host: Settings - modify room config (available before game is ongoing) */}
        {isHost && !isStartingGame && !isAudioPlaying && (room.roomStatus === RoomStatus.unseated || room.roomStatus === RoomStatus.seated || room.roomStatus === RoomStatus.assigned || room.roomStatus === RoomStatus.ready) && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#6B7280' }]} 
            onPress={() => navigation.navigate('Config', { existingRoomNumber: roomNumber })}
          >
            <Text style={styles.buttonText}>⚙️ 设置</Text>
          </TouchableOpacity>
        )}

        {/* Host: Prepare to Flip - show when seated (players joined but roles not assigned) */}
        {isHost && room.roomStatus === RoomStatus.seated && (
          <TouchableOpacity style={styles.actionButton} onPress={showPrepareToFlipDialog}>
            <Text style={styles.buttonText}>准备看牌</Text>
          </TouchableOpacity>
        )}
        
        {/* Host: Start Game - show when ready (all players have viewed their roles) */}
        {isHost && room.roomStatus === RoomStatus.ready && !isStartingGame && (
          <TouchableOpacity style={styles.actionButton} onPress={showStartGameDialog}>
            <Text style={styles.buttonText}>开始游戏</Text>
          </TouchableOpacity>
        )}
        
        {/* Actioner: Skip Action - only for roles that can skip (during ongoing game) */}
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
        
        {/* View Role Card - when roles are assigned, ready, or game is ongoing */}
        {(room.roomStatus === RoomStatus.assigned || room.roomStatus === RoomStatus.ready || room.roomStatus === RoomStatus.ongoing) && mySeatNumber !== null && (
          <TouchableOpacity style={styles.actionButton} onPress={showRoleCardDialog}>
            <Text style={styles.buttonText}>查看身份</Text>
          </TouchableOpacity>
        )}
        
        {/* Greyed View Role (waiting for host to assign roles) */}
        {(room.roomStatus === RoomStatus.unseated || room.roomStatus === RoomStatus.seated) && mySeatNumber !== null && (
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

