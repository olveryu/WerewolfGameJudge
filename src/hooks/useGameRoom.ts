/**
 * useGameRoom - Hook for managing game room with new Broadcast architecture
 * 
 * This hook combines SimplifiedRoomService (for DB) and GameStateService (for state).
 * Host device is the Single Source of Truth for all game state.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameStateService, LocalGameState, gameStatusToRoomStatus } from '../services/GameStateService';
import { SimplifiedRoomService, RoomRecord } from '../services/SimplifiedRoomService';
import { AuthService } from '../services/AuthService';
import { GameTemplate } from '../models/Template';
import { RoleName, isWolfRole } from '../models/roles';
import { RoomStatus } from '../models/Room';

export interface UseGameRoomResult {
  // Room info
  roomRecord: RoomRecord | null;
  
  // Game state (from GameStateService)
  gameState: LocalGameState | null;
  
  // Player info
  isHost: boolean;
  myUid: string | null;
  mySeatNumber: number | null;
  myRole: RoleName | null;
  
  // Computed values
  roomStatus: RoomStatus; // Maps GameStatus to RoomStatus for UI compatibility
  currentActionRole: RoleName | null;
  isAudioPlaying: boolean;
  hasBots: boolean;
  
  // Status
  loading: boolean;
  error: string | null;
  
  // Actions
  createRoom: (template: GameTemplate, roomNumber?: string) => Promise<string | null>;
  joinRoom: (roomNumber: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  
  // Seat actions
  takeSeat: (seatNumber: number) => Promise<boolean>;
  leaveSeat: () => Promise<void>;
  fillWithBots: () => Promise<void>;
  
  // Host game control
  updateTemplate: (template: GameTemplate) => Promise<void>;
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  
  // Player actions
  viewedRole: () => Promise<void>;
  submitAction: (target: number | null, extra?: any) => Promise<void>;
  submitWolfVote: (target: number) => Promise<void>;
  
  // Info
  getLastNightInfo: () => string;
  
  // Utility
  hasWolfVoted: (seatNumber: number) => boolean;
  getAllWolfSeats: () => number[];
}

export const useGameRoom = (): UseGameRoomResult => {
  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);
  const [gameState, setGameState] = useState<LocalGameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track these in state so they trigger re-renders
  const [isHost, setIsHost] = useState(false);
  const [myUid, setMyUid] = useState<string | null>(null);

  const gameStateService = useRef(GameStateService.getInstance());
  const roomService = useRef(SimplifiedRoomService.getInstance());
  const authService = useRef(AuthService.getInstance());

  // Subscribe to game state changes
  useEffect(() => {
    const unsubscribe = gameStateService.current.addListener((state) => {
      setGameState(state);
      // Update derived values when state changes
      setIsHost(gameStateService.current.isHostPlayer());
      setMyUid(gameStateService.current.getMyUid());
    });
    return unsubscribe;
  }, []);

  // Derived values that depend on gameState - use useMemo for reactivity
  const mySeatNumber = useMemo(() => {
    return gameStateService.current.getMySeatNumber();
  }, [gameState]);
  
  const myRole = useMemo(() => {
    return gameStateService.current.getMyRole();
  }, [gameState]);
  
  // Map GameStatus to RoomStatus for UI compatibility
  const roomStatus = useMemo((): RoomStatus => {
    if (!gameState) return RoomStatus.unseated;
    return gameStatusToRoomStatus(gameState.status);
  }, [gameState]);
  
  // Current action role
  const currentActionRole = useMemo((): RoleName | null => {
    if (!gameState) return null;
    const actionOrder = gameState.template.actionOrder;
    if (gameState.currentActionerIndex >= actionOrder.length) return null;
    return actionOrder[gameState.currentActionerIndex];
  }, [gameState]);
  
  // Check if audio is currently playing
  const isAudioPlaying = useMemo((): boolean => {
    return gameState?.isAudioPlaying ?? false;
  }, [gameState]);
  
  // Check if there are any bots in the room
  const hasBots = useMemo((): boolean => {
    if (!gameState) return false;
    for (const [, player] of gameState.players.entries()) {
      if (player?.uid.startsWith('bot_')) {
        return true;
      }
    }
    return false;
  }, [gameState]);

  // Create a new room as host
  const createRoom = useCallback(async (template: GameTemplate, providedRoomNumber?: string): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      await authService.current.waitForInit();
      const hostUid = authService.current.getCurrentUserId();
      if (!hostUid) {
        throw new Error('User not authenticated');
      }

      // Use provided room number or generate a new one
      const roomNumber = providedRoomNumber || await roomService.current.generateRoomNumber();

      // Create room record in Supabase
      const record = await roomService.current.createRoom(roomNumber, hostUid);
      setRoomRecord(record);

      // Initialize game state as host
      await gameStateService.current.initializeAsHost(roomNumber, hostUid, template);

      return roomNumber;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Join an existing room as player
  const joinRoom = useCallback(async (roomNumber: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await authService.current.waitForInit();
      const playerUid = authService.current.getCurrentUserId();
      if (!playerUid) {
        throw new Error('User not authenticated');
      }

      // Check if room exists
      const record = await roomService.current.getRoom(roomNumber);
      if (!record) {
        setError('房间不存在');
        return false;
      }
      setRoomRecord(record);

      // Get user info
      const displayName = await authService.current.getCurrentDisplayName();
      const avatarUrl = await authService.current.getCurrentAvatarUrl();

      // Join as player (or host if we're the host)
      if (record.hostUid === playerUid) {
        // We're the host, reinitialize
        // Note: Template needs to come from somewhere - for now we can't rejoin as host
        setError('Host cannot rejoin via joinRoom');
        return false;
      }

      await gameStateService.current.joinAsPlayer(
        roomNumber,
        playerUid,
        displayName ?? undefined,
        avatarUrl ?? undefined
      );

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Leave the current room
  const leaveRoom = useCallback(async (): Promise<void> => {
    try {
      // If host, also delete room record
      if (isHost && roomRecord) {
        await roomService.current.deleteRoom(roomRecord.roomNumber);
      }
      
      await gameStateService.current.leaveRoom();
      setRoomRecord(null);
      setGameState(null);
    } catch (err) {
      console.error('[useGameRoom] Error leaving room:', err);
    }
  }, [isHost, roomRecord]);

  // Take a seat
  const takeSeat = useCallback(async (seatNumber: number): Promise<boolean> => {
    try {
      const displayName = await authService.current.getCurrentDisplayName();
      const avatarUrl = await authService.current.getCurrentAvatarUrl();
      
      await gameStateService.current.playerTakeSeat(
        seatNumber,
        displayName ?? undefined,
        avatarUrl ?? undefined
      );
      return true;
    } catch (err) {
      console.error('[useGameRoom] Error taking seat:', err);
      return false;
    }
  }, []);

  // Leave seat
  const leaveSeat = useCallback(async (): Promise<void> => {
    try {
      await gameStateService.current.playerLeaveSeat();
    } catch (err) {
      console.error('[useGameRoom] Error leaving seat:', err);
    }
  }, []);

  // Fill remaining seats with bots (host only)
  const fillWithBots = useCallback(async (): Promise<void> => {
    if (!isHost || !gameState) return;

    const displayName = await authService.current.getCurrentDisplayName();
    const avatarUrl = await authService.current.getCurrentAvatarUrl();

    // Host takes seat 0 first
    if (mySeatNumber === null) {
      await gameStateService.current.hostTakeSeat(0, displayName ?? 'Host', avatarUrl ?? undefined);
    }

    // Fill remaining seats with bots
    for (let i = 0; i < gameState.template.numberOfPlayers; i++) {
      const player = gameState.players.get(i);
      if (player === null) {
        await gameStateService.current.hostAddBot(i, `机器人 ${i + 1}`);
      }
    }
  }, [isHost, gameState, mySeatNumber]);

  // Update template (host only)
  const updateTemplate = useCallback(async (template: GameTemplate): Promise<void> => {
    if (!isHost) return;
    await gameStateService.current.updateTemplate(template);
  }, [isHost]);

  // Assign roles (host only)
  const assignRoles = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    await gameStateService.current.assignRoles();
  }, [isHost]);

  // Start game (host only)
  const startGame = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    await gameStateService.current.startGame();
  }, [isHost]);

  // Restart game (host only)
  const restartGame = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    await gameStateService.current.restartGame();
  }, [isHost]);

  // Mark role as viewed
  const viewedRole = useCallback(async (): Promise<void> => {
    await gameStateService.current.playerViewedRole();
  }, []);

  // Submit action
  const submitAction = useCallback(async (target: number | null, extra?: any): Promise<void> => {
    await gameStateService.current.submitAction(target, extra);
  }, []);

  // Submit wolf vote
  const submitWolfVote = useCallback(async (target: number): Promise<void> => {
    await gameStateService.current.submitWolfVote(target);
  }, []);

  // Get last night info
  const getLastNightInfo = useCallback((): string => {
    return gameStateService.current.getLastNightInfo();
  }, []);
  
  // Check if a wolf has voted
  const hasWolfVotedFn = useCallback((seatNumber: number): boolean => {
    if (!gameState) return false;
    return gameState.wolfVotes.has(seatNumber);
  }, [gameState]);
  
  // Get all wolf seats
  const getAllWolfSeatsFn = useCallback((): number[] => {
    if (!gameState) return [];
    const wolfSeats: number[] = [];
    gameState.players.forEach((player, seat) => {
      if (player?.role && isWolfRole(player.role)) {
        wolfSeats.push(seat);
      }
    });
    return wolfSeats;
  }, [gameState]);

  return {
    roomRecord,
    gameState,
    isHost,
    myUid,
    mySeatNumber,
    myRole,
    roomStatus,
    currentActionRole,
    isAudioPlaying,
    hasBots,
    loading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    takeSeat,
    leaveSeat,
    fillWithBots,
    updateTemplate,
    assignRoles,
    startGame,
    restartGame,
    viewedRole,
    submitAction,
    submitWolfVote,
    getLastNightInfo,
    hasWolfVoted: hasWolfVotedFn,
    getAllWolfSeats: getAllWolfSeatsFn,
  };
};

export default useGameRoom;
