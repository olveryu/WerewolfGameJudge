/**
 * useWerewolfRoom - Composition hook for game room management
 *
 * Orchestrates 6 sub-hooks into a single flat interface:
 * - useWerewolfRoomLifecycle: room connection/joining/leaving + seat management
 * - useWerewolfActions: game control + night actions
 * - useConnectionStatus: connection status subscription (FSM-driven)
 * - useWerewolfBgmControl: BGM state management
 * - useWerewolfDebugMode: debug bot control
 * - useWerewolfNightDerived: pure night-phase derivations
 *
 * Server is the Single Source of Truth for all game state.
 * Composes sub-hooks, subscribes to facade state, derives identity/roomStatus.
 * Does not call the service layer directly; contains no business callback logic (belongs in sub-hooks).
 */

import { useIsFocused } from '@react-navigation/native';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import type { ActionSchema, SchemaId } from '@werewolf/game-engine/werewolf/models/roles/spec';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useWerewolfFacade } from '@/contexts';
import { useAuthContext } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import type { LocalWerewolfState } from '@/hooks/adapters/werewolfStateTypes';
import type { IWerewolfFacade } from '@/services/games/werewolf/IWerewolfFacade';
import { ConnectionStatus } from '@/services/room/ConnectionStatus';
import type { RoomRecord } from '@/services/types/IRoomService';
import { setAlertBlocked } from '@/utils/alert';
import { gameRoomLog } from '@/utils/logger';

import { toLocalState } from '../adapters/toLocalState';
import { useConnectionStatus } from '../useConnectionStatus';
import { useWerewolfActions } from './useWerewolfActions';
import { useWerewolfBgmControl } from './useWerewolfBgmControl';
import { useWerewolfDebugMode } from './useWerewolfDebugMode';
import { useWerewolfLastActionToast } from './useWerewolfLastActionToast';
import { useWerewolfNightDerived } from './useWerewolfNightDerived';
import { type RoomInitResult, useWerewolfRoomLifecycle } from './useWerewolfRoomLifecycle';
import { useWerewolfSettleToast } from './useWerewolfSettleToast';

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

interface UseWerewolfRoomResult {
  // Core facade (for sub-hooks that need direct facade access)
  facade: IWerewolfFacade;

  // Room info
  roomRecord: RoomRecord | null;

  // Game state (from WerewolfFacade)
  gameState: LocalWerewolfState | null;

  // Player info
  isHost: boolean;
  myUserId: string | null;
  mySeat: number | null;
  myRole: RoleId | null;

  // Debug mode (from useWerewolfDebugMode)
  controlledSeat: number | null;
  effectiveSeat: number | null;
  effectiveRole: RoleId | null;
  setControlledSeat: (seat: number | null) => void;
  isDebugMode: boolean;
  fillWithBots: () => Promise<ActionResult>;
  markAllBotsViewed: () => Promise<ActionResult>;
  markAllBotsGroupConfirmed: () => Promise<ActionResult>;

  // Night-derived (from useWerewolfNightDerived)
  roomStatus: GameStatus;
  currentActionRole: RoleId | null;
  isAudioPlaying: boolean;
  currentSchemaId: SchemaId | null;
  currentSchema: ActionSchema | null;
  currentStepId: SchemaId | null;

  // Connection (from useConnectionStatus)
  connectionStatus: ConnectionStatus;

  // Manual reconnect (from facade)
  manualReconnect: () => void;

  // Sync status
  lastStateReceivedAt: number | null;

  // Status (from useWerewolfRoomLifecycle)
  loading: boolean;
  error: string | null;

  // Room lifecycle (from useWerewolfRoomLifecycle)
  initializeRoom: (roomCode: string) => Promise<RoomInitResult>;
  joinRoom: (roomCode: string) => Promise<RoomInitResult>;
  leaveRoom: () => Promise<void>;
  takeSeatWithAck: (seat: number) => Promise<ActionResult>;
  leaveSeatWithAck: () => Promise<ActionResult>;
  kickPlayer: (targetSeat: number) => Promise<ActionResult>;
  requestSnapshot: () => Promise<boolean>;
  needsAuth: boolean;
  clearNeedsAuth: () => void;

  // Game actions (from useWerewolfActions)
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  clearAllSeats: () => Promise<void>;
  shareNightReview: (allowedSeats: number[]) => Promise<void>;
  viewedRole: () => Promise<ActionResult>;
  submitAction: (target: number | null, extra?: unknown) => Promise<void>;
  submitRevealAck: () => Promise<ActionResult>;
  submitGroupConfirmAck: () => Promise<ActionResult>;
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;
  getLastNightInfo: () => string;
  getCurseInfo: () => string | null;
  hasWolfVoted: (seat: number) => boolean;
  /** Host: triggers server progression after wolf vote deadline expires. Returns whether successful (used by retry guard). */
  postProgression: () => Promise<boolean>;

  // Board nomination (any connected player)
  boardNominate: (displayName: string, roles: RoleId[]) => Promise<void>;
  boardUpvote: (targetUserId: string) => Promise<void>;
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
/**
 * Composition hook for RoomScreen — orchestrates 6 sub-hooks into a unified game room interface.
 *
 * Responsible for assembling lifecycle, connection status, game state, actions, night-phase derivations, and BGM.
 */ export const useWerewolfRoom = (): UseWerewolfRoomResult => {
  // =========================================================================
  // Core: facade + services
  // =========================================================================
  const facade = useWerewolfFacade();
  const { authService } = useServices();
  const isFocused = useIsFocused();
  const { user } = useAuthContext();

  // roomRecord is owned here so useWerewolfRoomLifecycle can set it and screens can read it
  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);

  // =========================================================================
  // Phase C safety net: keep facade userId in sync with auth state.
  // Phase A prevents userId change during anonymous→register, but if userId
  // changes for any other reason (e.g. sign-out → sign-in while room
  // screen is mounted via Settings modal), we patch facade immediately.
  // =========================================================================
  useEffect(() => {
    if (user?.id) {
      facade.updateMyUserId(user.id);
    }
  }, [user?.id, facade]);

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
  // On Web, NativeStackNavigator popped screens are hidden via CSS rather than unmounted,
  // so useEffect cleanup won't run. Use useIsFocused to gate subscription:
  // - Focused: real subscribe -> state updates live
  // - Blurred: empty subscribe -> 0 listeners accumulate
  // - Refocus: isFocused changes -> subscribe changes -> React re-subscribes
  //   -> immediately calls getSnapshot() to read latest state (covers changes during blur)
  // =========================================================================

  const subscribe = useCallback(
    (cb: () => void) => {
      if (!isFocused) return () => {}; // not focused -> empty subscribe (prevent listener accumulation)
      return facade.subscribe(cb);
    },
    [facade, isFocused],
  );
  const getSnapshot = useCallback(() => facade.getState(), [facade]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  // Derive local state (pure computation, zero useState for identity)
  const gameState = useMemo(() => (snapshot ? toLocalState(snapshot) : null), [snapshot]);
  const isHost = snapshot !== null && facade.isHostPlayer();
  const myUserId = snapshot !== null ? facade.getMyUserId() : null;
  const mySeat = snapshot !== null ? facade.getMySeat() : null;

  // Toast notifications for passive actions (kick, clearAllSeats, assignRoles, etc.)
  useWerewolfLastActionToast({ facade, isHost, mySeat, isFocused });

  // Toast notifications for XP gain / level-up after valid game settlement
  useWerewolfSettleToast({ facade, isFocused });

  // Side effects: sync metadata + rejoin overlay
  const { setStateRevision, onStateReceived, setLastStateReceivedAt } = connection;

  useEffect(() => {
    if (!isFocused) return; // hidden (blurred) screens do not run side effects
    if (snapshot) {
      gameRoomLog.debug('State update from facade', {
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
  const bgm = useWerewolfBgmControl(
    isHost,
    gameState?.status ?? null,
    gameState?.isAudioPlaying ?? false,
  );

  // Debug mode: bot control
  const debug = useWerewolfDebugMode(facade, mySeat, gameState);

  // Night-phase derived values (pure computation)
  const nightDerived = useWerewolfNightDerived(gameState);

  // Manual reconnect (stable ref — facade is from context, identity never changes)
  const manualReconnect = useCallback(() => facade.manualReconnect(), [facade]);

  // Room lifecycle: creation/joining/leaving + seats
  const lifecycle = useWerewolfRoomLifecycle({
    facade,
    authService,
    user,
    setRoomRecord,
  });

  // =========================================================================
  // Profile sync on reconnect
  //
  // When connection is restored (Live) and player is seated, pull the latest profile from D1
  // and push it to the DO roster. Covers: rejoining a room, and auto-reconnect after WS drop
  // when the roster still caches stale data.
  // Fire-and-forget: failure only warns, does not block game flow.
  // =========================================================================
  useEffect(() => {
    if (connection.connectionStatus !== ConnectionStatus.Live) return;
    if (mySeat === null) return;
    if (!user) return;

    const displayName = user.displayName ?? undefined;
    facade
      .updatePlayerProfile(
        displayName,
        user.avatarUrl ?? undefined,
        user.avatarFrame ?? '',
        user.seatFlair ?? '',
        user.nameStyle ?? '',
        user.equippedEffect ?? '',
        user.seatAnimation ?? '',
      )
      .catch((err: unknown) => {
        gameRoomLog.warn('Profile sync on reconnect failed', err);
      });
  }, [connection.connectionStatus, mySeat, facade, user]);

  // Game actions: game control + night actions
  const actions = useWerewolfActions({
    facade,
    bgm,
    debug,
    mySeat,
    gameState,
  });

  // =========================================================================
  // Rejoin recovery
  // =========================================================================

  const resumeAfterRejoin = useCallback(() => {
    setAlertBlocked(false);
    setShowContinueOverlay(false);
    bgm.startBgmIfEnabled();
    // Fire-and-forget: audio plays in background; overlay has already been dismissed immediately
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
    mySeat !== null && gameState ? (gameState.players.get(mySeat)?.role ?? null) : null;

  const roomStatus: GameStatus = gameState?.status ?? GameStatus.Unseated;

  // =========================================================================
  // Return flat bag
  // =========================================================================
  return {
    facade,
    roomRecord,
    gameState,
    isHost,
    myUserId,
    mySeat,
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
    currentSchemaId: nightDerived.currentSchemaId,
    currentSchema: nightDerived.currentSchema,
    currentStepId: nightDerived.currentStepId,
    // Connection
    connectionStatus: connection.connectionStatus,
    manualReconnect,
    lastStateReceivedAt: connection.lastStateReceivedAt,
    // Lifecycle
    loading: lifecycle.loading,
    error: lifecycle.error,
    initializeRoom: lifecycle.initializeRoom,
    joinRoom: lifecycle.joinRoom,
    leaveRoom: lifecycle.leaveRoom,
    takeSeatWithAck: lifecycle.takeSeatWithAck,
    leaveSeatWithAck: lifecycle.leaveSeatWithAck,
    kickPlayer: lifecycle.kickPlayer,
    requestSnapshot: lifecycle.requestSnapshot,
    needsAuth: lifecycle.needsAuth,
    clearNeedsAuth: lifecycle.clearNeedsAuth,
    // Game actions
    assignRoles: actions.assignRoles,
    startGame: actions.startGame,
    restartGame: actions.restartGame,
    clearAllSeats: actions.clearAllSeats,
    shareNightReview: actions.shareNightReview,
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
    // Hidden (blurred) screens must not render Modal (on Web, Modals float on top and are not affected by CSS hiding)
    needsContinueOverlay: isFocused && showContinueOverlay,
    dismissContinueOverlay,
  };
};
