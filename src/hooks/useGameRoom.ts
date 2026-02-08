/**
 * useGameRoom - Hook for managing game room with Broadcast architecture
 *
 * This hook combines:
 * - GameFacade (via useGameFacade) for all game operations
 * - SimplifiedRoomService (for DB)
 * - Sub-hooks for focused concerns:
 *   - useNightDerived: pure derivations for night phase UI
 *   - useConnectionSync: connection status + Player auto-recovery
 *   - useBgmControl: BGM state management
 *   - useDebugMode: debug bot control
 *
 * Host device is the Single Source of Truth for all game state.
 *
 * ✅ 允许：组合子 hooks、通过 facade 操作游戏、派生 UI 状态
 * ❌ 禁止：直接调用 Supabase、绕过 facade 修改状态
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { LocalGameState } from '../services/types/GameStateTypes';
import { GameStatus } from '../models/GameStatus';
import { SimplifiedRoomService, RoomRecord } from '../services/infra/RoomService';
import type { ConnectionStatus } from '../services/transport/BroadcastService';
import { AuthService } from '../services/infra/AuthService';
import { GameTemplate } from '../models/Template';
import { RoleId } from '../models/roles';
import type { ActionSchema, SchemaId } from '../models/roles/spec';
import { gameRoomLog } from '../utils/logger';
import { useGameFacade } from '../contexts';
import { broadcastToLocalState } from './adapters/broadcastToLocalState';
import type {
  RoleRevealAnimation,
  ResolvedRoleRevealAnimation,
} from '../services/types/RoleRevealAnimation';
import { useNightDerived } from './useNightDerived';
import { useConnectionSync } from './useConnectionSync';
import { useBgmControl } from './useBgmControl';
import { useDebugMode } from './useDebugMode';

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

  // Debug mode: controlled seat (Host takes over a bot seat)
  controlledSeat: number | null;
  effectiveSeat: number | null; // = controlledSeat ?? mySeatNumber
  effectiveRole: RoleId | null; // role of effectiveSeat
  setControlledSeat: (seat: number | null) => void;

  // Debug mode: bot actions
  isDebugMode: boolean;
  fillWithBots: () => Promise<{ success: boolean; reason?: string }>;
  markAllBotsViewed: () => Promise<{ success: boolean; reason?: string }>;

  // Computed values
  roomStatus: GameStatus;
  currentActionRole: RoleId | null;
  isAudioPlaying: boolean;

  // Role reveal animation (Host controlled, all players use)
  roleRevealAnimation: RoleRevealAnimation;

  // Resolved animation for UI rendering (never 'random')
  resolvedRoleRevealAnimation: ResolvedRoleRevealAnimation;

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
  /** Create room record in DB only (no facade init). Returns confirmed roomNumber or null. */
  createRoomRecord: () => Promise<string | null>;
  /** Initialize host room (facade only, no DB). Call AFTER createRoomRecord + navigation. */
  initializeHostRoom: (roomNumber: string, template: GameTemplate) => Promise<boolean>;
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
  setRoleRevealAnimation: (animation: RoleRevealAnimation) => Promise<void>;

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
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;

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

  const roomService = useRef(SimplifiedRoomService.getInstance());
  const authService = useRef(AuthService.getInstance());

  // =========================================================================
  // Sub-hooks: focused concerns extracted for SRP
  // =========================================================================

  // Connection status + Player auto-recovery
  const connection = useConnectionSync(facade, isHost, roomRecord);

  // BGM state management
  const bgm = useBgmControl(isHost, gameState?.status ?? null);

  // Debug mode: bot control
  const debug = useDebugMode(facade, isHost, mySeatNumber, gameState);

  // Night-phase derived values (pure computation)
  const nightDerived = useNightDerived(gameState);

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
        connection.setStateRevision(facade.getStateRevision());
        // Notify connection sync (resets throttle + clears timer)
        connection.onStateReceived();
      } else {
        setGameState(null);
        setIsHost(false);
        setMyUid(null);
        setMySeatNumber(null);
        connection.setStateRevision(0);
        connection.setLastStateReceivedAt(null);
      }
    });
    return unsubscribe;
  }, [facade, connection]);

  // Derive myRole from gameState
  const myRole = useMemo(() => {
    if (mySeatNumber === null || !gameState) return null;
    return gameState.players.get(mySeatNumber)?.role ?? null;
  }, [gameState, mySeatNumber]);

  // GameStatus
  const roomStatus = useMemo((): GameStatus => {
    if (!gameState) return GameStatus.unseated;
    return gameState.status;
  }, [gameState]);

  // =========================================================================
  // Phase 1B: createRoom / joinRoom 使用 facade
  // =========================================================================

  // Create room record in DB only (optimistic insert with retry on conflict).
  // Returns the confirmed/final roomNumber, or null on failure.
  // ConfigScreen calls this BEFORE navigating to RoomScreen.
  const createRoomRecord = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      await authService.current.waitForInit();
      const hostUid = authService.current.getCurrentUserId();
      if (!hostUid) {
        throw new Error('User not authenticated');
      }

      const record = await roomService.current.createRoom(hostUid);
      // NOTE: roomRecord state is set here for this hook instance.
      // RoomScreen mounts a separate instance, so initializeHostRoom also sets it.
      setRoomRecord(record);
      return record.roomNumber;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize host room: facade only, no DB creation.
  // RoomScreen/useRoomInit calls this AFTER navigation with the confirmed roomNumber.
  const initializeHostRoom = useCallback(
    async (roomNumber: string, template: GameTemplate): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        await authService.current.waitForInit();
        const hostUid = authService.current.getCurrentUserId();
        if (!hostUid) {
          throw new Error('User not authenticated');
        }

        // Set roomRecord for connection sync & leaveRoom cleanup
        setRoomRecord({ roomNumber, hostUid, createdAt: new Date() });

        await facade.initializeAsHost(roomNumber, hostUid, template);

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize room';
        setError(message);
        return false;
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
  // NOTE: Room record is NOT deleted here — GitHub Actions cleanup-rooms.yml
  // automatically deletes rooms older than 24 hours, so host can rejoin after leaving.
  const leaveRoom = useCallback(async (): Promise<void> => {
    try {
      // Phase 1B: 使用 facade 离开房间
      await facade.leaveRoom();
      setRoomRecord(null);
      setGameState(null);
    } catch (err) {
      gameRoomLog.error(' Error leaving room:', err);
    }
  }, [facade]);

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
      connection.setConnectionStatus('syncing');
      const result = await facade.requestSnapshot();
      if (result) {
        connection.setConnectionStatus('live');
      } else {
        connection.setConnectionStatus('disconnected');
      }
      return result;
    } catch (err) {
      gameRoomLog.error(' Error requesting snapshot:', err);
      connection.setConnectionStatus('disconnected');
      return false;
    }
  }, [facade, connection]);

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
    bgm.startBgmIfEnabled();
    await facade.startNight();
  }, [isHost, facade, bgm]);

  // Restart game (host only)
  const restartGame = useCallback(async (): Promise<void> => {
    if (!isHost) return;
    // Stop BGM on restart
    bgm.stopBgm();
    // Clear controlled seat on restart
    debug.setControlledSeat(null);
    await facade.restartGame();
  }, [isHost, facade, bgm, debug]);

  // =========================================================================
  // Debug Mode & BGM: delegated to sub-hooks
  // =========================================================================

  // Set role reveal animation (host only)
  const setRoleRevealAnimation = useCallback(
    async (animation: RoleRevealAnimation): Promise<void> => {
      if (!isHost) return;
      await facade.setRoleRevealAnimation(animation);
    },
    [isHost, facade],
  );

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
  // Debug mode: when delegating (controlledSeat !== null), mark the bot's seat as viewed
  // Normal mode: mark my own seat as viewed
  const viewedRole = useCallback(async (): Promise<void> => {
    const seat = debug.controlledSeat ?? mySeatNumber;
    if (seat === null) return;
    await facade.markViewedRole(seat);
  }, [debug.controlledSeat, mySeatNumber, facade]);

  // Submit action (uses effectiveSeat/effectiveRole for debug bot control)
  const submitAction = useCallback(
    async (target: number | null, extra?: unknown): Promise<void> => {
      const seat = debug.effectiveSeat;
      const role = debug.effectiveRole;
      if (seat === null || !role) return;
      await facade.submitAction(seat, role, target, extra);
    },
    [debug.effectiveSeat, debug.effectiveRole, facade],
  );

  // Submit wolf vote (uses effectiveSeat for debug bot control)
  const submitWolfVote = useCallback(
    async (target: number): Promise<void> => {
      const seat = debug.effectiveSeat;
      if (seat === null) return;
      await facade.submitWolfVote(seat, target);
    },
    [debug.effectiveSeat, facade],
  );

  // Reveal acknowledge (seer/psychic/gargoyle/wolfRobot)
  const submitRevealAck = useCallback(
    async (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot'): Promise<void> => {
      await facade.submitRevealAck(role);
    },
    [facade],
  );

  // WolfRobot hunter status viewed gate
  // seat 参数由调用方传入 effectiveSeat，以支持 debug bot 接管模式
  const sendWolfRobotHunterStatusViewed = useCallback(
    async (seat: number): Promise<void> => {
      await facade.sendWolfRobotHunterStatusViewed(seat);
    },
    [facade],
  );

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

  return {
    roomRecord,
    gameState,
    isHost,
    myUid,
    mySeatNumber,
    myRole,
    // Debug mode (from useDebugMode)
    controlledSeat: debug.controlledSeat,
    effectiveSeat: debug.effectiveSeat,
    effectiveRole: debug.effectiveRole,
    setControlledSeat: debug.setControlledSeat,
    isDebugMode: debug.isDebugMode,
    fillWithBots: debug.fillWithBots,
    markAllBotsViewed: debug.markAllBotsViewed,
    // Computed values (from useNightDerived)
    roomStatus,
    currentActionRole: nightDerived.currentActionRole,
    isAudioPlaying: nightDerived.isAudioPlaying,
    roleRevealAnimation: nightDerived.roleRevealAnimation,
    resolvedRoleRevealAnimation: nightDerived.resolvedRoleRevealAnimation,
    currentSchemaId: nightDerived.currentSchemaId,
    currentSchema: nightDerived.currentSchema,
    currentStepId: nightDerived.currentStepId,
    loading,
    error,
    // Connection (from useConnectionSync)
    connectionStatus: connection.connectionStatus,
    stateRevision: connection.stateRevision,
    lastStateReceivedAt: connection.lastStateReceivedAt,
    isStateStale: connection.isStateStale,
    createRoomRecord,
    initializeHostRoom,
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
    setRoleRevealAnimation,
    setAudioPlaying,
    // BGM (from useBgmControl)
    isBgmEnabled: bgm.isBgmEnabled,
    toggleBgm: bgm.toggleBgm,
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
