/**
 * useGameRoom - Hook for managing game room with new Broadcast architecture
 * 
 * This hook combines SimplifiedRoomService (for DB) and GameStateService (for state).
 * Host device is the Single Source of Truth for all game state.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameStateService, LocalGameState, gameStatusToRoomStatus } from '../services/GameStateService';
import { GameStatus } from '../services/types/GameStateTypes';
import { SimplifiedRoomService, RoomRecord } from '../services/SimplifiedRoomService';
import { BroadcastService, type ConnectionStatus } from '../services/BroadcastService';
import { AuthService } from '../services/AuthService';
import { GameTemplate } from '../models/Template';
import { RoleName, isWolfRole } from '../models/roles';
import { RoomStatus } from '../models/Room';
import { isValidRoleId, getRoleSpec, getSchema, type ActionSchema, type SchemaId, getStepsByRoleStrict } from '../models/roles/spec';

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
  
  // Schema-driven UI (Phase 3)
  currentSchemaId: SchemaId | null;        // schemaId for current action role (null if no action)
  currentSchema: ActionSchema | null;       // Full schema (derived from schemaId, null if no schema)
  
  // Connection status
  connectionStatus: ConnectionStatus;
  stateRevision: number;
  
  // Status
  loading: boolean;
  error: string | null;
  
  // Actions
  createRoom: (template: GameTemplate, roomNumber?: string) => Promise<string | null>;
  joinRoom: (roomNumber: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  
  // Seat actions
  takeSeat: (seatNumber: number) => Promise<boolean>;
  takeSeatWithAck: (seatNumber: number) => Promise<{ success: boolean; reason?: string }>;
  leaveSeat: () => Promise<void>;
  leaveSeatWithAck: () => Promise<{ success: boolean; reason?: string }>;
  
  // Host game control
  updateTemplate: (template: GameTemplate) => Promise<void>;
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  
  // Player actions
  viewedRole: () => Promise<void>;
  submitAction: (target: number | null, extra?: any) => Promise<void>;
  submitWolfVote: (target: number) => Promise<void>;
  submitRevealAck: (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot') => Promise<void>;
  
  // Sync actions
  requestSnapshot: () => Promise<boolean>;
  
  // Info
  getLastNightInfo: () => string;
  
  // Seat error (BUG-2 fix)
  lastSeatError: { seat: number; reason: 'seat_taken' } | null;
  clearLastSeatError: () => void;
  
  // Utility
  hasWolfVoted: (seatNumber: number) => boolean;
  getAllWolfSeats: () => number[];
  
  // Private inbox (anti-cheat: Zero-Trust)
  getWitchContext: () => import('../services/types/PrivateBroadcast').WitchContextPayload | null;
  getSeerReveal: () => import('../services/types/PrivateBroadcast').SeerRevealPayload | null;
  getPsychicReveal: () => import('../services/types/PrivateBroadcast').PsychicRevealPayload | null;
  getGargoyleReveal: () => import('../services/types/PrivateBroadcast').GargoyleRevealPayload | null;
  getWolfRobotReveal: () => import('../services/types/PrivateBroadcast').WolfRobotRevealPayload | null;
  getActionRejected: () => import('../services/types/PrivateBroadcast').ActionRejectedPayload | null;
  // Async wait methods (handle network latency)
  waitForSeerReveal: (timeoutMs?: number) => Promise<import('../services/types/PrivateBroadcast').SeerRevealPayload | null>;
  waitForPsychicReveal: (timeoutMs?: number) => Promise<import('../services/types/PrivateBroadcast').PsychicRevealPayload | null>;
  waitForGargoyleReveal: (timeoutMs?: number) => Promise<import('../services/types/PrivateBroadcast').GargoyleRevealPayload | null>;
  waitForWolfRobotReveal: (timeoutMs?: number) => Promise<import('../services/types/PrivateBroadcast').WolfRobotRevealPayload | null>;
  waitForActionRejected: (timeoutMs?: number) => Promise<import('../services/types/PrivateBroadcast').ActionRejectedPayload | null>;
}

export const useGameRoom = (): UseGameRoomResult => {
  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);
  const [gameState, setGameState] = useState<LocalGameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track these in state so they trigger re-renders
  const [isHost, setIsHost] = useState(false);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [mySeatNumber, setMySeatNumber] = useState<number | null>(null);
  const [lastSeatError, setLastSeatError] = useState<{ seat: number; reason: 'seat_taken' } | null>(null);
  
  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [stateRevision, setStateRevision] = useState(0);

  const gameStateService = useRef(GameStateService.getInstance());
  const roomService = useRef(SimplifiedRoomService.getInstance());
  const authService = useRef(AuthService.getInstance());
  const broadcastService = useRef(BroadcastService.getInstance());

  // Subscribe to game state changes
  useEffect(() => {
    const unsubscribe = gameStateService.current.addListener((state) => {
      setGameState(state);
      // Update derived values when state changes
      setIsHost(gameStateService.current.isHostPlayer());
      setMyUid(gameStateService.current.getMyUid());
      setMySeatNumber(gameStateService.current.getMySeatNumber());
      // Update seat error (BUG-2 fix)
      setLastSeatError(gameStateService.current.getLastSeatError());
      // Update state revision
      setStateRevision(gameStateService.current.getStateRevision());
    });
    return unsubscribe;
  }, []);

  // Subscribe to connection status changes
  useEffect(() => {
    const unsubscribe = broadcastService.current.addStatusListener((status) => {
      setConnectionStatus(status);
    });
    return unsubscribe;
  }, []);

  const myRole = useMemo(() => {
    return gameStateService.current.getMyRole();
  }, [gameState]);
  
  // Map GameStatus to RoomStatus for UI compatibility
  const roomStatus = useMemo((): RoomStatus => {
    if (!gameState) return RoomStatus.unseated;
    return gameStatusToRoomStatus(gameState.status);
  }, [gameState]);
  
  // Current action role - only valid when game is ongoing (night phase)
  const currentActionRole = useMemo((): RoleName | null => {
    if (!gameState) return null;
    // Only return action role when game is in progress
    if (gameState.status !== GameStatus.ongoing) return null;
    const actionOrder = gameState.template.actionOrder;
    if (gameState.currentActionerIndex >= actionOrder.length) return null;
    return actionOrder[gameState.currentActionerIndex];
  }, [gameState]);

  // Schema-driven UI (Phase 3): derive schemaId from currentActionRole locally
  // No broadcast needed - schema is derived from local spec
  const currentSchemaId = useMemo((): SchemaId | null => {
    if (!currentActionRole) return null;
    if (!isValidRoleId(currentActionRole)) return null;
    const spec = getRoleSpec(currentActionRole);
    if (!spec.night1.hasAction) return null;
  // M3: schemaId is derived from NIGHT_STEPS single source of truth.
  // Current assumption (locked by contract tests): each role has at most one NightStep.
  const [step] = getStepsByRoleStrict(currentActionRole);
  return step?.id ?? null;  // step.id is the schemaId
  }, [currentActionRole]);

  // Schema-driven UI (Phase 3): derive full schema from schemaId
  const currentSchema = useMemo((): ActionSchema | null => {
    if (!currentSchemaId) return null;
    return getSchema(currentSchemaId);
  }, [currentSchemaId]);
  
  // Check if audio is currently playing
  const isAudioPlaying = useMemo((): boolean => {
    return gameState?.isAudioPlaying ?? false;
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

  // Take a seat (unified API)
  const takeSeat = useCallback(async (seatNumber: number): Promise<boolean> => {
    try {
      const displayName = await authService.current.getCurrentDisplayName();
      const avatarUrl = await authService.current.getCurrentAvatarUrl();
      
      return await gameStateService.current.takeSeat(
        seatNumber,
        displayName ?? undefined,
        avatarUrl ?? undefined
      );
    } catch (err) {
      console.error('[useGameRoom] Error taking seat:', err);
      return false;
    }
  }, []);

  // Leave seat (unified API)
  const leaveSeat = useCallback(async (): Promise<void> => {
    try {
      await gameStateService.current.leaveSeat();
    } catch (err) {
      console.error('[useGameRoom] Error leaving seat:', err);
    }
  }, []);

  // Take seat with ack (unified API)
  const takeSeatWithAck = useCallback(async (seatNumber: number): Promise<{ success: boolean; reason?: string }> => {
    try {
      const displayName = await authService.current.getCurrentDisplayName();
      const avatarUrl = await authService.current.getCurrentAvatarUrl();
      
      return await gameStateService.current.takeSeatWithAck(
        seatNumber,
        displayName ?? undefined,
        avatarUrl ?? undefined
      );
    } catch (err) {
      console.error('[useGameRoom] Error taking seat with ack:', err);
      return { success: false, reason: String(err) };
    }
  }, []);

  // Leave seat with ack (unified API)
  const leaveSeatWithAck = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    try {
      return await gameStateService.current.leaveSeatWithAck();
    } catch (err) {
      console.error('[useGameRoom] Error leaving seat with ack:', err);
      return { success: false, reason: String(err) };
    }
  }, []);

  // Request snapshot from host (force sync)
  const requestSnapshot = useCallback(async (): Promise<boolean> => {
    try {
      setConnectionStatus('syncing');
      const result = await gameStateService.current.requestSnapshot();
      if (result) {
        setConnectionStatus('live');
      } else {
        setConnectionStatus('disconnected');
      }
      return result;
    } catch (err) {
      console.error('[useGameRoom] Error requesting snapshot:', err);
      setConnectionStatus('disconnected');
      return false;
    }
  }, []);

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

  // Reveal acknowledge (seer/psychic/gargoyle/wolfRobot)
  const submitRevealAck = useCallback(async (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot'): Promise<void> => {
    await gameStateService.current.submitRevealAck(role);
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

  // Clear seat error (BUG-2 fix)
  const clearLastSeatError = useCallback(() => {
    gameStateService.current.clearLastSeatError();
    setLastSeatError(null);
  }, []);

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
  currentSchemaId,
  currentSchema,
    loading,
    error,
    connectionStatus,
    stateRevision,
    createRoom,
    joinRoom,
    leaveRoom,
    takeSeat,
    leaveSeat,
    takeSeatWithAck,
    leaveSeatWithAck,
    requestSnapshot,
    updateTemplate,
    assignRoles,
    startGame,
    restartGame,
    viewedRole,
    submitAction,
    submitWolfVote,
  submitRevealAck,
    getLastNightInfo,
    lastSeatError,
    clearLastSeatError,
    hasWolfVoted: hasWolfVotedFn,
    getAllWolfSeats: getAllWolfSeatsFn,
    getWitchContext: () => gameStateService.current.getWitchContext(),
    getSeerReveal: () => gameStateService.current.getSeerReveal(),
    getPsychicReveal: () => gameStateService.current.getPsychicReveal(),
    getGargoyleReveal: () => gameStateService.current.getGargoyleReveal(),
    getWolfRobotReveal: () => gameStateService.current.getWolfRobotReveal(),
    getActionRejected: () => gameStateService.current.getActionRejected(),
    waitForSeerReveal: (timeoutMs?: number) => gameStateService.current.waitForSeerReveal(timeoutMs),
    waitForPsychicReveal: (timeoutMs?: number) => gameStateService.current.waitForPsychicReveal(timeoutMs),
    waitForGargoyleReveal: (timeoutMs?: number) => gameStateService.current.waitForGargoyleReveal(timeoutMs),
    waitForWolfRobotReveal: (timeoutMs?: number) => gameStateService.current.waitForWolfRobotReveal(timeoutMs),
    waitForActionRejected: (timeoutMs?: number) => gameStateService.current.waitForActionRejected(timeoutMs),
  };
};

export default useGameRoom;
