/**
 * useGameRoom - Composition hook for game room management
 *
 * Orchestrates 6 sub-hooks into a single flat interface:
 * - useRoomLifecycle: room creation/joining/leaving + seat management
 * - useHostGameActions: host game control + night actions
 * - useConnectionSync: connection status + Player auto-recovery
 * - useBgmControl: BGM state management
 * - useDebugMode: debug bot control
 * - useNightDerived: pure night-phase derivations
 *
 * Host device is the Single Source of Truth for all game state.
 *
 * ✅ 允许：组合子 hooks、订阅 facade state、派生 identity/roomStatus
 * ❌ 禁止：直接调用 Supabase、包含业务 callback 逻辑（应在子 hooks 中）
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema, SchemaId } from '@werewolf/game-engine/models/roles/spec';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type {
  ResolvedRoleRevealAnimation,
  RoleRevealAnimation,
} from '@werewolf/game-engine/types/RoleRevealAnimation';
import { useCallback, useEffect, useState } from 'react';

import { useGameFacade } from '@/contexts';
import { useServices } from '@/contexts/ServiceContext';
import type { RoomRecord } from '@/services/infra/RoomService';
import type { ConnectionStatus } from '@/services/types/IGameFacade';
import type { LocalGameState } from '@/types/GameStateTypes';
import { gameRoomLog } from '@/utils/logger';

import { broadcastToLocalState } from './adapters/broadcastToLocalState';
import { useBgmControl } from './useBgmControl';
import { useConnectionSync } from './useConnectionSync';
import { useDebugMode } from './useDebugMode';
import { useHostGameActions } from './useHostGameActions';
import { useNightDerived } from './useNightDerived';
import { useRoomLifecycle } from './useRoomLifecycle';

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

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

  // Debug mode (from useDebugMode)
  controlledSeat: number | null;
  effectiveSeat: number | null;
  effectiveRole: RoleId | null;
  setControlledSeat: (seat: number | null) => void;
  isDebugMode: boolean;
  fillWithBots: () => Promise<{ success: boolean; reason?: string }>;
  markAllBotsViewed: () => Promise<{ success: boolean; reason?: string }>;

  // Night-derived (from useNightDerived)
  roomStatus: GameStatus;
  currentActionRole: RoleId | null;
  isAudioPlaying: boolean;
  resolvedRoleRevealAnimation: ResolvedRoleRevealAnimation;
  currentSchemaId: SchemaId | null;
  currentSchema: ActionSchema | null;
  currentStepId: SchemaId | null;

  // Connection (from useConnectionSync)
  connectionStatus: ConnectionStatus;

  // Sync status (Player reconnection)
  lastStateReceivedAt: number | null;
  isStateStale: boolean;

  // Status (from useRoomLifecycle)
  loading: boolean;
  error: string | null;

  // Room lifecycle (from useRoomLifecycle)
  initializeHostRoom: (roomNumber: string, template: GameTemplate) => Promise<boolean>;
  joinRoom: (roomNumber: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  takeSeat: (seatNumber: number) => Promise<boolean>;
  leaveSeat: () => Promise<void>;
  takeSeatWithAck: (seatNumber: number) => Promise<{ success: boolean; reason?: string }>;
  leaveSeatWithAck: () => Promise<{ success: boolean; reason?: string }>;
  requestSnapshot: () => Promise<boolean>;
  lastSeatError: { seat: number; reason: 'seat_taken' } | null;
  clearLastSeatError: () => void;

  // Host game actions (from useHostGameActions)
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  setRoleRevealAnimation: (animation: RoleRevealAnimation) => Promise<void>;
  viewedRole: () => Promise<void>;
  submitAction: (target: number | null, extra?: unknown) => Promise<void>;
  submitWolfVote: (target: number) => Promise<void>;
  submitRevealAck: () => Promise<void>;
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;
  getLastNightInfo: () => string;
  hasWolfVoted: (seatNumber: number) => boolean;
  /** Host: wolf vote deadline 到期后触发服务端推进 */
  postProgression: () => Promise<void>;

  // Rejoin recovery
  resumeAfterRejoin: () => void;
  needsContinueOverlay: boolean;
  dismissContinueOverlay: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const useGameRoom = (): UseGameRoomResult => {
  // =========================================================================
  // Core: facade + services
  // =========================================================================
  const facade = useGameFacade();
  const { roomService, authService } = useServices();

  // Identity state (set by facade listener)
  const [gameState, setGameState] = useState<LocalGameState | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [mySeatNumber, setMySeatNumber] = useState<number | null>(null);

  // roomRecord is owned here so both useConnectionSync and useRoomLifecycle can use it
  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);

  // =========================================================================
  // Sub-hooks
  // =========================================================================

  // Connection status + Player auto-recovery
  const connection = useConnectionSync(facade, isHost, roomRecord);

  // BGM state management
  const bgm = useBgmControl(isHost, gameState?.status ?? null);

  // Rejoin overlay state: shown when Host rejoins an ongoing game
  const [showContinueOverlay, setShowContinueOverlay] = useState(false);

  // Debug mode: bot control
  const debug = useDebugMode(facade, mySeatNumber, gameState);

  // Night-phase derived values (pure computation)
  const nightDerived = useNightDerived(gameState);

  // Stable setGameState(null) callback for lifecycle.leaveRoom
  const clearGameState = useCallback(() => setGameState(null), []);

  // Room lifecycle: creation/joining/leaving + seats
  const lifecycle = useRoomLifecycle({
    facade,
    authService,
    roomService,
    connection,
    setGameState: clearGameState,
    setIsHost,
    setMyUid,
    setRoomRecord,
  });

  // Host game actions: game control + night actions
  const actions = useHostGameActions({
    facade,
    bgm,
    debug,
    mySeatNumber,
    gameState,
  });

  // =========================================================================
  // Facade state subscription → identity derivation
  // =========================================================================
  useEffect(() => {
    const unsubscribe = facade.addListener((broadcastState) => {
      if (broadcastState) {
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

        // Host rejoin to ongoing game → show "continue game" overlay
        // wasAudioInterrupted is a one-shot flag set during joinRoom(isHost=true) DB restore,
        // cleared after resumeAfterRejoin(). setState(true) is idempotent.
        if (
          facade.isHostPlayer() &&
          broadcastState.status === 'ongoing' &&
          facade.wasAudioInterrupted
        ) {
          setShowContinueOverlay(true);
        }
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

  // =========================================================================
  // Rejoin recovery
  // =========================================================================

  const resumeAfterRejoin = useCallback(() => {
    setShowContinueOverlay(false);
    bgm.startBgmIfEnabled();
    // Fire-and-forget: 音频后台播放，overlay 已立即消失
    void facade.resumeAfterRejoin();
  }, [facade, bgm]);

  const dismissContinueOverlay = useCallback(() => {
    setShowContinueOverlay(false);
  }, []);

  // =========================================================================
  // Derived values
  // =========================================================================

  const myRole: RoleId | null =
    mySeatNumber !== null && gameState ? (gameState.players.get(mySeatNumber)?.role ?? null) : null;

  const roomStatus: GameStatus = gameState?.status ?? GameStatus.unseated;

  // =========================================================================
  // Return flat bag
  // =========================================================================
  return {
    roomRecord,
    gameState,
    isHost,
    myUid,
    mySeatNumber,
    myRole,
    // Debug mode
    controlledSeat: debug.controlledSeat,
    effectiveSeat: debug.effectiveSeat,
    effectiveRole: debug.effectiveRole,
    setControlledSeat: debug.setControlledSeat,
    isDebugMode: debug.isDebugMode,
    fillWithBots: debug.fillWithBots,
    markAllBotsViewed: debug.markAllBotsViewed,
    // Night-derived
    roomStatus,
    currentActionRole: nightDerived.currentActionRole,
    isAudioPlaying: nightDerived.isAudioPlaying,
    resolvedRoleRevealAnimation: nightDerived.resolvedRoleRevealAnimation,
    currentSchemaId: nightDerived.currentSchemaId,
    currentSchema: nightDerived.currentSchema,
    currentStepId: nightDerived.currentStepId,
    // Connection
    connectionStatus: connection.connectionStatus,
    lastStateReceivedAt: connection.lastStateReceivedAt,
    isStateStale: connection.isStateStale,
    // Lifecycle
    loading: lifecycle.loading,
    error: lifecycle.error,
    initializeHostRoom: lifecycle.initializeHostRoom,
    joinRoom: lifecycle.joinRoom,
    leaveRoom: lifecycle.leaveRoom,
    takeSeat: lifecycle.takeSeat,
    leaveSeat: lifecycle.leaveSeat,
    takeSeatWithAck: lifecycle.takeSeatWithAck,
    leaveSeatWithAck: lifecycle.leaveSeatWithAck,
    requestSnapshot: lifecycle.requestSnapshot,
    lastSeatError: lifecycle.lastSeatError,
    clearLastSeatError: lifecycle.clearLastSeatError,
    // Host game actions
    assignRoles: actions.assignRoles,
    startGame: actions.startGame,
    restartGame: actions.restartGame,
    setRoleRevealAnimation: actions.setRoleRevealAnimation,
    viewedRole: actions.viewedRole,
    submitAction: actions.submitAction,
    submitWolfVote: actions.submitWolfVote,
    submitRevealAck: actions.submitRevealAck,
    sendWolfRobotHunterStatusViewed: actions.sendWolfRobotHunterStatusViewed,
    getLastNightInfo: actions.getLastNightInfo,
    hasWolfVoted: actions.hasWolfVoted,
    postProgression: actions.postProgression,
    // Rejoin recovery
    resumeAfterRejoin,
    needsContinueOverlay: showContinueOverlay,
    dismissContinueOverlay,
  };
};
