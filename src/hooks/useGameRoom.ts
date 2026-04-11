/**
 * useGameRoom - Composition hook for game room management
 *
 * Orchestrates 6 sub-hooks into a single flat interface:
 * - useRoomLifecycle: room creation/joining/leaving + seat management
 * - useGameActions: game control + night actions
 * - useConnectionStatus: connection status subscription (FSM-driven)
 * - useBgmControl: BGM state management
 * - useDebugMode: debug bot control
 * - useNightDerived: pure night-phase derivations
 *
 * Server is the Single Source of Truth for all game state.
 * 组合子 hooks、订阅 facade state、派生 identity/roomStatus。
 * 不直接调用服务层，不包含业务 callback 逻辑（应在子 hooks 中）。
 */

import { useIsFocused } from '@react-navigation/native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema, SchemaId } from '@werewolf/game-engine/models/roles/spec';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type {
  ResolvedRoleRevealAnimation,
  RoleRevealAnimation,
} from '@werewolf/game-engine/types/RoleRevealAnimation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useGameFacade } from '@/contexts';
import { useAuthContext } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import type { ConnectionStatus, IGameFacade } from '@/services/types/IGameFacade';
import type { RoomRecord } from '@/services/types/IRoomService';
import type { LocalGameState } from '@/types/GameStateTypes';
import { setAlertBlocked } from '@/utils/alert';
import { gameRoomLog } from '@/utils/logger';

import { toLocalState } from './adapters/toLocalState';
import { useBgmControl } from './useBgmControl';
import { useConnectionStatus } from './useConnectionStatus';
import { useDebugMode } from './useDebugMode';
import { useGameActions } from './useGameActions';
import { useLastActionToast } from './useLastActionToast';
import { useNightDerived } from './useNightDerived';
import { useRoomLifecycle } from './useRoomLifecycle';
import { useSettleToast } from './useSettleToast';

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

interface UseGameRoomResult {
  // Core facade (for sub-hooks that need direct facade access)
  facade: IGameFacade;

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
  markAllBotsGroupConfirmed: () => Promise<{ success: boolean; reason?: string }>;

  // Night-derived (from useNightDerived)
  roomStatus: GameStatus;
  currentActionRole: RoleId | null;
  isAudioPlaying: boolean;
  roleRevealAnimation: RoleRevealAnimation;
  resolvedRoleRevealAnimation: ResolvedRoleRevealAnimation;
  currentSchemaId: SchemaId | null;
  currentSchema: ActionSchema | null;
  currentStepId: SchemaId | null;

  // Connection (from useConnectionStatus)
  connectionStatus: ConnectionStatus;

  // Sync status
  lastStateReceivedAt: number | null;

  // Status (from useRoomLifecycle)
  loading: boolean;
  error: string | null;

  // Room lifecycle (from useRoomLifecycle)
  initializeRoom: (roomNumber: string, template: GameTemplate) => Promise<boolean>;
  joinRoom: (roomNumber: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  takeSeat: (seatNumber: number) => Promise<boolean>;
  leaveSeat: () => Promise<void>;
  takeSeatWithAck: (seatNumber: number) => Promise<{ success: boolean; reason?: string }>;
  leaveSeatWithAck: () => Promise<{ success: boolean; reason?: string }>;
  kickPlayer: (targetSeat: number) => Promise<{ success: boolean; reason?: string }>;
  requestSnapshot: () => Promise<boolean>;
  lastSeatError: { seat: number; reason: 'seat_taken' } | null;
  clearLastSeatError: () => void;
  needsAuth: boolean;
  clearNeedsAuth: () => void;

  // Game actions (from useGameActions)
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  clearAllSeats: () => Promise<void>;
  shareNightReview: (allowedSeats: number[]) => Promise<void>;
  setRoleRevealAnimation: (animation: RoleRevealAnimation) => Promise<void>;
  viewedRole: () => Promise<{ success: boolean; reason?: string }>;
  submitAction: (target: number | null, extra?: unknown) => Promise<void>;
  submitRevealAck: () => Promise<void>;
  submitGroupConfirmAck: () => Promise<void>;
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;
  getLastNightInfo: () => string;
  getCurseInfo: () => string | null;
  hasWolfVoted: (seatNumber: number) => boolean;
  /** Host: wolf vote deadline 到期后触发服务端推进。返回是否成功（用于 retry guard）。 */
  postProgression: () => Promise<boolean>;

  // Board nomination (任意已连接玩家)
  boardNominate: (displayName: string, roles: RoleId[]) => Promise<void>;
  boardUpvote: (targetUid: string) => Promise<void>;
  boardWithdraw: () => Promise<void>;

  // BGM manual control (for ended-phase UI)
  isBgmPlaying: boolean;
  playBgm: () => void;
  stopBgm: () => void;

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
  const isFocused = useIsFocused();
  const { user } = useAuthContext();

  // roomRecord is owned here so useRoomLifecycle can set it and screens can read it
  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);

  // =========================================================================
  // Phase C safety net: keep facade uid in sync with auth state.
  // Phase A prevents uid change during anonymous→register, but if uid
  // changes for any other reason (e.g. sign-out → sign-in while room
  // screen is mounted via Settings modal), we patch facade immediately.
  // =========================================================================
  useEffect(() => {
    if (user?.uid) {
      facade.updateMyUid(user.uid);
    }
  }, [user?.uid, facade]);

  // =========================================================================
  // Sub-hooks
  // =========================================================================

  // Connection status subscription (FSM-driven)
  const connection = useConnectionStatus(facade);

  // Rejoin overlay state: shown when Host rejoins an ongoing game
  const [showContinueOverlay, setShowContinueOverlay] = useState(false);

  // =========================================================================
  // Facade state subscription (useSyncExternalStore + useIsFocused)
  //
  // Web 上 NativeStackNavigator pop 的 screen 用 CSS 隐藏而非 unmount，
  // 因此 useEffect cleanup 不会执行。用 useIsFocused 控制订阅：
  // - 聚焦时：真订阅 → state 实时更新
  // - 失焦时：空订阅 → 0 listener 累积
  // - 再聚焦时：isFocused 变 → subscribe 变 → React re-subscribe
  //   → 立即调 getSnapshot() 读最新 state（补上 blur 期间的变更）
  // =========================================================================

  const subscribe = useCallback(
    (cb: () => void) => {
      if (!isFocused) return () => {}; // 不聚焦 → 空订阅（防止 listener 累积）
      return facade.subscribe(cb);
    },
    [facade, isFocused],
  );
  const getSnapshot = useCallback(() => facade.getState(), [facade]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  // Derive local state (pure computation, zero useState for identity)
  const gameState = useMemo(() => (snapshot ? toLocalState(snapshot) : null), [snapshot]);
  const isHost = snapshot !== null && facade.isHostPlayer();
  const myUid = snapshot !== null ? facade.getMyUid() : null;
  const mySeatNumber = snapshot !== null ? facade.getMySeatNumber() : null;

  // Toast notifications for passive actions (kick, clearAllSeats, assignRoles, etc.)
  useLastActionToast({ facade, isHost, mySeatNumber, isFocused });

  // Toast notifications for XP gain / level-up after valid game settlement
  useSettleToast({ facade, isFocused });

  // Side effects: sync metadata + rejoin overlay
  const { setStateRevision, onStateReceived, setLastStateReceivedAt } = connection;

  useEffect(() => {
    if (!isFocused) return; // 不聚焦的隐藏 screen 不执行副作用
    if (snapshot) {
      gameRoomLog.debug('[facade] State update from facade', {
        roomCode: snapshot.roomCode,
        status: snapshot.status,
      });
      setStateRevision(facade.getStateRevision());
      onStateReceived();

      // Host rejoin to ongoing game → show "continue game" overlay
      // wasAudioInterrupted is a one-shot flag set during joinRoom(isHost=true) DB restore,
      // cleared after resumeAfterRejoin(). setState(true) is idempotent.
      if (
        facade.isHostPlayer() &&
        snapshot.status === GameStatus.Ongoing &&
        facade.wasAudioInterrupted
      ) {
        setAlertBlocked(true);
        setShowContinueOverlay(true);
      }
    } else {
      setStateRevision(0);
      setLastStateReceivedAt(null);
    }
  }, [isFocused, snapshot, facade, setStateRevision, onStateReceived, setLastStateReceivedAt]);

  // BGM state management (needs isHost + gameState derived above)
  const bgm = useBgmControl(isHost, gameState?.status ?? null, gameState?.isAudioPlaying ?? false);

  // Debug mode: bot control
  const debug = useDebugMode(facade, mySeatNumber, gameState);

  // Night-phase derived values (pure computation)
  const nightDerived = useNightDerived(gameState);

  // Room lifecycle: creation/joining/leaving + seats
  const lifecycle = useRoomLifecycle({
    facade,
    authService,
    roomService,
    setRoomRecord,
  });

  // Game actions: game control + night actions
  const actions = useGameActions({
    facade,
    bgm,
    debug,
    mySeatNumber,
    gameState,
  });

  // =========================================================================
  // Rejoin recovery
  // =========================================================================

  const resumeAfterRejoin = useCallback(() => {
    setAlertBlocked(false);
    setShowContinueOverlay(false);
    bgm.startBgmIfEnabled();
    // Fire-and-forget: 音频后台播放，overlay 已立即消失
    void facade.resumeAfterRejoin();
  }, [facade, bgm]);

  const dismissContinueOverlay = useCallback(() => {
    setAlertBlocked(false);
    setShowContinueOverlay(false);
  }, []);

  // =========================================================================
  // Derived values
  // =========================================================================

  const myRole: RoleId | null =
    mySeatNumber !== null && gameState ? (gameState.players.get(mySeatNumber)?.role ?? null) : null;

  const roomStatus: GameStatus = gameState?.status ?? GameStatus.Unseated;

  // =========================================================================
  // Return flat bag
  // =========================================================================
  return {
    facade,
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
    markAllBotsGroupConfirmed: debug.markAllBotsGroupConfirmed,
    // Night-derived
    roomStatus,
    currentActionRole: nightDerived.currentActionRole,
    isAudioPlaying: nightDerived.isAudioPlaying,
    roleRevealAnimation: nightDerived.roleRevealAnimation,
    resolvedRoleRevealAnimation: nightDerived.resolvedRoleRevealAnimation,
    currentSchemaId: nightDerived.currentSchemaId,
    currentSchema: nightDerived.currentSchema,
    currentStepId: nightDerived.currentStepId,
    // Connection
    connectionStatus: connection.connectionStatus,
    lastStateReceivedAt: connection.lastStateReceivedAt,
    // Lifecycle
    loading: lifecycle.loading,
    error: lifecycle.error,
    initializeRoom: lifecycle.initializeRoom,
    joinRoom: lifecycle.joinRoom,
    leaveRoom: lifecycle.leaveRoom,
    takeSeat: lifecycle.takeSeat,
    leaveSeat: lifecycle.leaveSeat,
    takeSeatWithAck: lifecycle.takeSeatWithAck,
    leaveSeatWithAck: lifecycle.leaveSeatWithAck,
    kickPlayer: lifecycle.kickPlayer,
    requestSnapshot: lifecycle.requestSnapshot,
    lastSeatError: lifecycle.lastSeatError,
    clearLastSeatError: lifecycle.clearLastSeatError,
    needsAuth: lifecycle.needsAuth,
    clearNeedsAuth: lifecycle.clearNeedsAuth,
    // Game actions
    assignRoles: actions.assignRoles,
    startGame: actions.startGame,
    restartGame: actions.restartGame,
    clearAllSeats: actions.clearAllSeats,
    shareNightReview: actions.shareNightReview,
    setRoleRevealAnimation: actions.setRoleRevealAnimation,
    viewedRole: actions.viewedRole,
    submitAction: actions.submitAction,
    submitRevealAck: actions.submitRevealAck,
    submitGroupConfirmAck: actions.submitGroupConfirmAck,
    sendWolfRobotHunterStatusViewed: actions.sendWolfRobotHunterStatusViewed,
    getLastNightInfo: actions.getLastNightInfo,
    getCurseInfo: actions.getCurseInfo,
    hasWolfVoted: actions.hasWolfVoted,
    postProgression: actions.postProgression,
    // Board nomination
    boardNominate: actions.boardNominate,
    boardUpvote: actions.boardUpvote,
    boardWithdraw: actions.boardWithdraw,
    // BGM manual control
    isBgmPlaying: bgm.isBgmPlaying,
    playBgm: bgm.playBgm,
    stopBgm: bgm.stopBgm,
    // Rejoin recovery
    resumeAfterRejoin,
    // 失焦的隐藏 screen 不渲染 Modal（Web 上 Modal 浮于顶层不受 CSS 隐藏控制）
    needsContinueOverlay: isFocused && showContinueOverlay,
    dismissContinueOverlay,
  };
};
