/**
 * useGameRoom - Hook for managing game room with new Broadcast architecture
 *
 * Phase 1: 使用 v2 facade 处理房间生命周期和座位操作
 *
 * This hook combines:
 * - V2GameFacade (via useGameFacade) for room/seating
 * - SimplifiedRoomService (for DB)
 * - Legacy GameStateService (for Night-1, to be migrated in Phase 2)
 *
 * Host device is the Single Source of Truth for all game state.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameStateService, LocalGameState } from '../services/GameStateService';
import { GameStatus } from '../services/types/GameStateTypes';
import { SimplifiedRoomService, RoomRecord } from '../services/SimplifiedRoomService';
import { BroadcastService, type ConnectionStatus } from '../services/BroadcastService';
import { AuthService } from '../services/AuthService';
import { GameTemplate } from '../models/Template';
import { RoleId, buildNightPlan } from '../models/roles';
import {
  isValidRoleId,
  getRoleSpec,
  getSchema,
  type ActionSchema,
  type SchemaId,
  getStepsByRoleStrict,
} from '../models/roles/spec';
import { gameRoomLog } from '../utils/logger';
import { useGameFacade } from '../contexts';
import { broadcastToLocalState } from './adapters/broadcastToLocalState';

export interface UseGameRoomResult {
  // Room info
  roomRecord: RoomRecord | null;

  // Game state (from GameStateService)
  gameState: LocalGameState | null;

  // Player info
  isHost: boolean;
  myUid: string | null;
  mySeatNumber: number | null;
  myRole: RoleId | null;

  // Computed values
  roomStatus: GameStatus;
  currentActionRole: RoleId | null;
  isAudioPlaying: boolean;

  // Schema-driven UI (Phase 3)
  currentSchemaId: SchemaId | null; // schemaId for current action role (null if no action)
  currentSchema: ActionSchema | null; // Full schema (derived from schemaId, null if no schema)

  // Schema-driven UI (Phase 3.5): authoritative current stepId from Host ROLE_TURN
  currentStepId: SchemaId | null;

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

  // Role-specific context is now read directly from gameState:
  // - gameState.witchContext (only display to witch)
  // - gameState.seerReveal (only display to seer)
  // - gameState.psychicReveal (only display to psychic)
  // - gameState.gargoyleReveal (only display to gargoyle)
  // - gameState.wolfRobotReveal (only display to wolfRobot)
  // - gameState.confirmStatus (only display to hunter/darkWolfKing)
  // - gameState.actionRejected (only display to targetUid)
}

export const useGameRoom = (): UseGameRoomResult => {
  // =========================================================================
  // Phase 1: 获取 v2 facade（通过 Context 注入）
  // =========================================================================
  const facade = useGameFacade();

  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);
  const [gameState, setGameState] = useState<LocalGameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track these in state so they trigger re-renders
  const [isHost, setIsHost] = useState(false);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [mySeatNumber, setMySeatNumber] = useState<number | null>(null);
  const [lastSeatError, setLastSeatError] = useState<{ seat: number; reason: 'seat_taken' } | null>(
    null,
  );

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [stateRevision, setStateRevision] = useState(0);

  const gameStateService = useRef(GameStateService.getInstance());
  const roomService = useRef(SimplifiedRoomService.getInstance());
  const authService = useRef(AuthService.getInstance());
  const broadcastService = useRef(BroadcastService.getInstance());

  // =========================================================================
  // Phase 1A: 订阅 v2 facade state（转换为 LocalGameState）
  // =========================================================================
  useEffect(() => {
    const unsubscribe = facade.addListener((broadcastState) => {
      if (broadcastState) {
        // Phase 1 证据：state 来源是 v2 facade
        gameRoomLog.debug('[v2] State update from facade', {
          roomCode: broadcastState.roomCode,
          status: broadcastState.status,
        });
        const localState = broadcastToLocalState(broadcastState);
        setGameState(localState);
        // 从 facade 派生 identity
        setIsHost(facade.isHostPlayer());
        setMyUid(facade.getMyUid());
        setMySeatNumber(facade.getMySeatNumber());
        setStateRevision(facade.getStateRevision());
      } else {
        setGameState(null);
        setIsHost(false);
        setMyUid(null);
        setMySeatNumber(null);
        setStateRevision(0);
      }
    });
    return unsubscribe;
  }, [facade]);

  // Subscribe to connection status changes
  useEffect(() => {
    const unsubscribe = broadcastService.current.addStatusListener((status) => {
      setConnectionStatus(status);
    });
    return unsubscribe;
  }, []);

  // Phase 1: myRole 从 gameState 派生，不再依赖 legacy service
  const myRole = useMemo(() => {
    if (mySeatNumber === null || !gameState) return null;
    return gameState.players.get(mySeatNumber)?.role ?? null;
  }, [gameState, mySeatNumber]);

  // GameStatus is now an alias for GameStatus (Phase 5)
  const roomStatus = useMemo((): GameStatus => {
    if (!gameState) return GameStatus.unseated;
    return gameState.status;
  }, [gameState]);

  // Current action role - only valid when game is ongoing (night phase)
  // Phase 5: actionOrder removed from template, now derived from NightPlan
  const currentActionRole = useMemo((): RoleId | null => {
    if (!gameState) return null;
    // Only return action role when game is in progress
    if (gameState.status !== GameStatus.ongoing) return null;
    // Derive action order dynamically from template.roles via NightPlan
    const nightPlan = buildNightPlan(gameState.template.roles);
    if (gameState.currentActionerIndex >= nightPlan.steps.length) return null;
    return nightPlan.steps[gameState.currentActionerIndex].roleId;
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
    return step?.id ?? null; // step.id is the schemaId
  }, [currentActionRole]);

  // Schema-driven UI (Phase 3): derive full schema from schemaId
  const currentSchema = useMemo((): ActionSchema | null => {
    if (!currentSchemaId) return null;
    return getSchema(currentSchemaId);
  }, [currentSchemaId]);

  // Authoritative stepId from Host ROLE_TURN (UI-only)
  const currentStepId = useMemo((): SchemaId | null => {
    return gameState?.currentStepId ?? null;
  }, [gameState]);

  // Check if audio is currently playing
  const isAudioPlaying = useMemo((): boolean => {
    return gameState?.isAudioPlaying ?? false;
  }, [gameState]);

  // =========================================================================
  // Phase 1B: createRoom / joinRoom 使用 v2 facade
  // =========================================================================

  // Create a new room as host
  const createRoom = useCallback(
    async (template: GameTemplate, providedRoomNumber?: string): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        await authService.current.waitForInit();
        const hostUid = authService.current.getCurrentUserId();
        if (!hostUid) {
          throw new Error('User not authenticated');
        }

        // Use provided room number or generate a new one
        const roomNumber = providedRoomNumber || (await roomService.current.generateRoomNumber());

        // Create room record in Supabase
        const record = await roomService.current.createRoom(roomNumber, hostUid);
        setRoomRecord(record);

        // Phase 1B: 使用 v2 facade 初始化房间
        await facade.initializeAsHost(roomNumber, hostUid, template);

        return roomNumber;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create room';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [facade],
  );

  // Join an existing room as player
  const joinRoom = useCallback(
    async (roomNumber: string): Promise<boolean> => {
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

        // Phase 1B: 使用 v2 facade 加入房间
        // Phase 1 明确不支持 Host rejoin，直接报错
        if (record.hostUid === playerUid) {
          gameRoomLog.error('Host rejoin not supported in Phase 1');
          setError('房主重新加入暂不支持，请重新创建房间');
          return false;
        }

        await facade.joinAsPlayer(
          roomNumber,
          playerUid,
          displayName ?? undefined,
          avatarUrl ?? undefined,
        );

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to join room';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facade],
  );

  // Leave the current room
  const leaveRoom = useCallback(async (): Promise<void> => {
    try {
      // If host, also delete room record
      if (isHost && roomRecord) {
        await roomService.current.deleteRoom(roomRecord.roomNumber);
      }

      // Phase 1B: 使用 v2 facade 离开房间
      await facade.leaveRoom();
      setRoomRecord(null);
      setGameState(null);
    } catch (err) {
      gameRoomLog.error(' Error leaving room:', err);
    }
  }, [facade, isHost, roomRecord]);

  // =========================================================================
  // Phase 1B: takeSeat / leaveSeat 使用 v2 facade
  // =========================================================================

  // Take a seat (unified API)
  const takeSeat = useCallback(
    async (seatNumber: number): Promise<boolean> => {
      try {
        const displayName = await authService.current.getCurrentDisplayName();
        const avatarUrl = await authService.current.getCurrentAvatarUrl();

        // Phase 1B: 使用 v2 facade 入座
        return await facade.takeSeat(seatNumber, displayName ?? undefined, avatarUrl ?? undefined);
      } catch (err) {
        gameRoomLog.error(' Error taking seat:', err);
        return false;
      }
    },
    [facade],
  );

  // Leave seat (unified API)
  const leaveSeat = useCallback(async (): Promise<void> => {
    try {
      // Phase 1B: 使用 v2 facade 离座
      await facade.leaveSeat();
    } catch (err) {
      gameRoomLog.error(' Error leaving seat:', err);
    }
  }, [facade]);

  // Take seat with ack (unified API)
  // Phase 1: 使用 v2 facade（ACK 机制已实现，reason 透传）
  const takeSeatWithAck = useCallback(
    async (seatNumber: number): Promise<{ success: boolean; reason?: string }> => {
      try {
        const displayName = await authService.current.getCurrentDisplayName();
        const avatarUrl = await authService.current.getCurrentAvatarUrl();

        // v2 facade 的 takeSeatWithAck 直接返回 {success, reason}
        return await facade.takeSeatWithAck(
          seatNumber,
          displayName ?? undefined,
          avatarUrl ?? undefined,
        );
      } catch (err) {
        gameRoomLog.error(' Error taking seat with ack:', err);
        return { success: false, reason: String(err) };
      }
    },
    [facade],
  );

  // Leave seat with ack (unified API)
  // Phase 1: 使用 v2 facade（ACK 机制已实现，reason 透传）
  const leaveSeatWithAck = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    try {
      // v2 facade 的 leaveSeatWithAck 直接返回 {success, reason}
      return await facade.leaveSeatWithAck();
    } catch (err) {
      gameRoomLog.error(' Error leaving seat with ack:', err);
      return { success: false, reason: String(err) };
    }
  }, [facade]);

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
      gameRoomLog.error(' Error requesting snapshot:', err);
      setConnectionStatus('disconnected');
      return false;
    }
  }, []);

  // Update template (host only)
  const updateTemplate = useCallback(
    async (template: GameTemplate): Promise<void> => {
      if (!isHost) return;
      await gameStateService.current.updateTemplate(template);
    },
    [isHost],
  );

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
  const submitRevealAck = useCallback(
    async (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot'): Promise<void> => {
      await gameStateService.current.submitRevealAck(role);
    },
    [],
  );

  // Get last night info
  const getLastNightInfo = useCallback((): string => {
    return gameStateService.current.getLastNightInfo();
  }, []);

  // Check if a wolf has voted
  const hasWolfVotedFn = useCallback(
    (seatNumber: number): boolean => {
      if (!gameState) return false;
      return gameState.wolfVotes.has(seatNumber);
    },
    [gameState],
  );

  // Clear seat error (BUG-2 fix)
  // Phase 1: 只更新本地状态，不再调用 legacy service
  const clearLastSeatError = useCallback(() => {
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
    currentStepId,
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
    // Role-specific context is now read directly from gameState
  };
};

export default useGameRoom;
