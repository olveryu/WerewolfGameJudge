/**
 * useGameRoom - Hook for managing game room with Broadcast architecture
 *
 * This hook combines:
 * - GameFacade (via useGameFacade) for all game operations
 * - SimplifiedRoomService (for DB)
 *
 * Host device is the Single Source of Truth for all game state.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { LocalGameState } from '../services/types/GameStateTypes';
import { GameStatus } from '../services/types/GameStateTypes';
import { SimplifiedRoomService, RoomRecord } from '../services/infra/RoomService';
import { BroadcastService, type ConnectionStatus } from '../services/transport/BroadcastService';
import { AuthService } from '../services/infra/AuthService';
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
import SettingsService from '../services/infra/SettingsService';
import AudioService from '../services/infra/AudioService';

export interface UseGameRoomResult {
  // Room info
  roomRecord: RoomRecord | null;

  // Game state (from GameFacade)
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

  // Host audio control (PR7: 音频时序控制)
  setAudioPlaying: (isPlaying: boolean) => Promise<{ success: boolean; reason?: string }>;

  // BGM control (Host only)
  isBgmEnabled: boolean;
  toggleBgm: () => Promise<void>;

  // Player actions
  viewedRole: () => Promise<void>;
  submitAction: (target: number | null, extra?: any) => Promise<void>;
  submitWolfVote: (target: number) => Promise<void>;
  submitRevealAck: (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot') => Promise<void>;
  sendWolfRobotHunterStatusViewed: () => Promise<void>;

  // Sync actions
  requestSnapshot: () => Promise<boolean>;

  // Info
  getLastNightInfo: () => string;

  // Seat error (BUG-2 fix)
  lastSeatError: { seat: number; reason: 'seat_taken' } | null;
  clearLastSeatError: () => void;

  // Utility
  hasWolfVoted: (seatNumber: number) => boolean;

  // Sync status (Player reconnection)
  lastStateReceivedAt: number | null; // timestamp of last STATE_UPDATE
  isStateStale: boolean; // true if connection not live or state possibly outdated

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
  // Phase 1: 获取 facade（通过 Context 注入）
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

  // Sync status for Player reconnection
  const [lastStateReceivedAt, setLastStateReceivedAt] = useState<number | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle: only request once per live session (reset when state is received)
  const hasRequestedInSessionRef = useRef<boolean>(false);

  // BGM state
  const [isBgmEnabled, setIsBgmEnabled] = useState(true);
  const settingsService = useRef(SettingsService.getInstance());
  const audioService = useRef(AudioService.getInstance());

  const roomService = useRef(SimplifiedRoomService.getInstance());
  const authService = useRef(AuthService.getInstance());
  const broadcastService = useRef(BroadcastService.getInstance());

  // =========================================================================
  // Load settings on mount
  // =========================================================================
  useEffect(() => {
    const loadSettings = async () => {
      await settingsService.current.load();
      setIsBgmEnabled(settingsService.current.isBgmEnabled());
    };
    void loadSettings();
  }, []);

  // =========================================================================
  // Phase 1A: 订阅 facade state（转换为 LocalGameState）
  // =========================================================================
  useEffect(() => {
    const unsubscribe = facade.addListener((broadcastState) => {
      if (broadcastState) {
        // Phase 1 证据：state 来源是 facade
        gameRoomLog.debug('[facade] State update from facade', {
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
        // 更新 lastStateReceivedAt（Player 同步状态追踪）
        setLastStateReceivedAt(Date.now());
        // 重置 throttle flag（收到状态后允许下次 auto-recovery）
        hasRequestedInSessionRef.current = false;
        // 清除 reconnect timer（收到新状态说明同步成功）
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      } else {
        setGameState(null);
        setIsHost(false);
        setMyUid(null);
        setMySeatNumber(null);
        setStateRevision(0);
        setLastStateReceivedAt(null);
      }
    });
    return unsubscribe;
  }, [facade]);

  // =========================================================================
  // BGM control: Stop BGM when game ends (Host only)
  // =========================================================================
  const prevStatusRef = useRef<GameStatus | null>(null);
  useEffect(() => {
    if (!isHost) return;
    const currentStatus = gameState?.status ?? null;
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = currentStatus;

    // Stop BGM when transitioning from ongoing to ended
    if (prevStatus === GameStatus.ongoing && currentStatus === GameStatus.ended) {
      audioService.current.stopBgm();
    }
  }, [isHost, gameState?.status]);

  // Subscribe to connection status changes
  useEffect(() => {
    const unsubscribe = broadcastService.current.addStatusListener((status) => {
      setConnectionStatus(status);
    });
    return unsubscribe;
  }, []);

  // Player 自动恢复：断线重连后自动请求状态
  // Throttle: 只在同一 live session 中请求一次（收到 STATE_UPDATE 后重置）
  useEffect(() => {
    // 只有 Player 需要自动恢复（Host 是权威）
    if (isHost) return;
    // 只在连接恢复时触发
    if (connectionStatus !== 'live') return;
    // 如果没有 roomRecord，说明还没加入房间
    if (!roomRecord) return;
    // Throttle: 已经请求过，跳过（避免 REQUEST_STATE spam）
    if (hasRequestedInSessionRef.current) {
      gameRoomLog.debug('Player auto-recovery: already requested in this session, skipping');
      return;
    }

    // 启动定时器：如果 2 秒内没有收到 STATE_UPDATE，主动请求
    reconnectTimerRef.current = setTimeout(() => {
      if (hasRequestedInSessionRef.current) return; // 双重保险
      hasRequestedInSessionRef.current = true;
      gameRoomLog.debug('Player auto-recovery: requesting state after reconnect');
      void facade.requestSnapshot();
    }, 2000);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connectionStatus, isHost, roomRecord, facade]);

  // Derive myRole from gameState
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
  // Phase 1B: createRoom / joinRoom 使用 facade
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

        // Phase 1B: 使用 facade 初始化房间
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

        // Phase 1B: 使用 facade 加入房间
        // Host rejoin: 使用 joinAsHost 恢复
        if (record.hostUid === playerUid) {
          gameRoomLog.debug('Host rejoin detected, attempting recovery');
          const result = await facade.joinAsHost(roomNumber, playerUid);
          if (!result.success) {
            gameRoomLog.error('Host rejoin failed', { reason: result.reason });
            setError('房间状态已丢失，请重新创建房间');
            return false;
          }
          gameRoomLog.debug('Host rejoin successful');
          return true;
        }

        // Player: 正常加入

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

      // Phase 1B: 使用 facade 离开房间
      await facade.leaveRoom();
      setRoomRecord(null);
      setGameState(null);
    } catch (err) {
      gameRoomLog.error(' Error leaving room:', err);
    }
  }, [facade, isHost, roomRecord]);

  // =========================================================================
  // Phase 1B: takeSeat / leaveSeat 使用 facade
  // =========================================================================

  // Take a seat (unified API)
  const takeSeat = useCallback(
    async (seatNumber: number): Promise<boolean> => {
      try {
        const displayName = await authService.current.getCurrentDisplayName();
        const avatarUrl = await authService.current.getCurrentAvatarUrl();

        // Phase 1B: 使用 facade 入座
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
      // Phase 1B: 使用 facade 离座
      await facade.leaveSeat();
    } catch (err) {
      gameRoomLog.error(' Error leaving seat:', err);
    }
  }, [facade]);

  // Take seat with ack (unified API)
  // Phase 1: 使用 facade（ACK 机制已实现，reason 透传）
  const takeSeatWithAck = useCallback(
    async (seatNumber: number): Promise<{ success: boolean; reason?: string }> => {
      try {
        const displayName = await authService.current.getCurrentDisplayName();
        const avatarUrl = await authService.current.getCurrentAvatarUrl();

        // facade 的 takeSeatWithAck 直接返回 {success, reason}
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
  // Phase 1: 使用 facade（ACK 机制已实现，reason 透传）
  const leaveSeatWithAck = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    try {
      // facade 的 leaveSeatWithAck 直接返回 {success, reason}
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
      const result = await facade.requestSnapshot();
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
  }, [facade]);

  // Update template (host only)
  const updateTemplate = useCallback(
    async (template: GameTemplate): Promise<void> => {
      if (!isHost) return;
      await facade.updateTemplate(template);
    },
    [isHost, facade],
  );

  // Assign roles (host only)
  const assignRoles = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    await facade.assignRoles();
  }, [isHost, facade]);

  // Start game (host only) - now uses startNight + BGM
  const startGame = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    // Start BGM if enabled
    if (settingsService.current.isBgmEnabled()) {
      void audioService.current.startBgm();
    }
    await facade.startNight();
  }, [isHost, facade]);

  // Restart game (host only)
  const restartGame = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    // Stop BGM on restart
    audioService.current.stopBgm();
    await facade.restartGame();
  }, [isHost, facade]);

  // Toggle BGM setting (host only)
  const toggleBgm = useCallback(async (): Promise<void> => {
    const newValue = await settingsService.current.toggleBgm();
    setIsBgmEnabled(newValue);
    // If currently playing, stop/start based on new setting
    if (newValue) {
      // Only start if game is ongoing
      if (gameState?.status === GameStatus.ongoing) {
        void audioService.current.startBgm();
      }
    } else {
      audioService.current.stopBgm();
    }
  }, [gameState?.status]);

  // Set audio playing (host only) - PR7 音频时序控制
  const setAudioPlaying = useCallback(
    async (isPlaying: boolean): Promise<{ success: boolean; reason?: string }> => {
      if (!isHost) {
        return { success: false, reason: 'host_only' };
      }
      return facade.setAudioPlaying(isPlaying);
    },
    [isHost, facade],
  );

  // Mark role as viewed
  const viewedRole = useCallback(async (): Promise<void> => {
    const seat = mySeatNumber;
    if (seat === null) return;
    await facade.markViewedRole(seat);
  }, [mySeatNumber, facade]);

  // Submit action
  const submitAction = useCallback(
    async (target: number | null, extra?: unknown): Promise<void> => {
      const seat = mySeatNumber;
      const role = myRole;
      if (seat === null || !role) return;
      await facade.submitAction(seat, role, target, extra);
    },
    [mySeatNumber, myRole, facade],
  );

  // Submit wolf vote
  const submitWolfVote = useCallback(
    async (target: number): Promise<void> => {
      const seat = mySeatNumber;
      if (seat === null) return;
      await facade.submitWolfVote(seat, target);
    },
    [mySeatNumber, facade],
  );

  // Reveal acknowledge (seer/psychic/gargoyle/wolfRobot)
  const submitRevealAck = useCallback(
    async (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot'): Promise<void> => {
      await facade.submitRevealAck(role);
    },
    [facade],
  );

  // WolfRobot hunter status viewed gate
  const sendWolfRobotHunterStatusViewed = useCallback(async (): Promise<void> => {
    await facade.sendWolfRobotHunterStatusViewed();
  }, [facade]);

  // Get last night info - now derived from gameState
  const getLastNightInfo = useCallback((): string => {
    if (!gameState) return '无信息';
    // deaths are stored in lastNightDeaths field
    const deaths = gameState.lastNightDeaths;
    if (!deaths || deaths.length === 0) return '昨夜平安夜';
    const deathList = deaths.map((d: number) => (d + 1).toString() + '号').join(', ');
    return '昨夜死亡: ' + deathList;
  }, [gameState]);

  // Check if a wolf has voted
  const hasWolfVotedFn = useCallback(
    (seatNumber: number): boolean => {
      if (!gameState) return false;
      return gameState.wolfVotes.has(seatNumber);
    },
    [gameState],
  );

  // Clear seat error (BUG-2 fix)
  const clearLastSeatError = useCallback(() => {
    setLastSeatError(null);
  }, []);

  // 一致性提示：状态是否可能过时
  // - connectionStatus 不是 'live' 时可能过时
  // - 超过 30 秒没收到状态更新时可能过时
  const STALE_THRESHOLD_MS = 30000;
  const isStateStale = useMemo(() => {
    if (connectionStatus !== 'live') return true;
    if (!lastStateReceivedAt) return true;
    return Date.now() - lastStateReceivedAt > STALE_THRESHOLD_MS;
  }, [connectionStatus, lastStateReceivedAt]);

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
    lastStateReceivedAt,
    isStateStale,
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
    setAudioPlaying,
    isBgmEnabled,
    toggleBgm,
    viewedRole,
    submitAction,
    submitWolfVote,
    submitRevealAck,
    sendWolfRobotHunterStatusViewed,
    getLastNightInfo,
    lastSeatError,
    clearLastSeatError,
    hasWolfVoted: hasWolfVotedFn,
    // Role-specific context is now read directly from gameState
  };
};

export default useGameRoom;
