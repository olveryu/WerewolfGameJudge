/**
 * useWerewolfRoom - Composition hook for game room management
 *
 * Orchestrates 6 sub-hooks into a single flat interface:
 * - shared RoomSession snapshot + canonical seat commands
 * - useWerewolfGameActions: game control + night actions
 * - useWerewolfBgmControl: BGM state management
 * - useWerewolfDebugMode: debug bot control
 * - useWerewolfNightDerived: pure night-phase derivations
 *
 * Server is the Single Source of Truth for all game state.
 * Composes sub-hooks around the shared immutable session snapshot.
 * Does not call the service layer directly; contains no business callback logic (belongs in sub-hooks).
 */

import { useIsFocused } from '@react-navigation/native';
import type { WerewolfActionInput } from '@werewolf/game-engine';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema, SchemaId } from '@werewolf/game-engine/models/roles/spec';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import type { RoomConnectionStatus } from '@/features/room/model/RoomConnection';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { getWerewolfUserSeat } from '@/games/werewolf/state/getWerewolfUserSeat';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { toWerewolfLocalState } from '@/games/werewolf/state/toWerewolfLocalState';
import { setAlertBlocked } from '@/utils/alert';
import { gameRoomLog } from '@/utils/logger';

import { useWerewolfBgmControl } from './useWerewolfBgmControl';
import { useWerewolfDebugMode } from './useWerewolfDebugMode';
import { useWerewolfGameActions } from './useWerewolfGameActions';
import { useWerewolfLastActionToast } from './useWerewolfLastActionToast';
import { useWerewolfNightDerived } from './useWerewolfNightDerived';
import { useWerewolfSeatCommands } from './useWerewolfSeatCommands';
import { useWerewolfSettleToast } from './useWerewolfSettleToast';

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

interface UseWerewolfRoomResult {
  gameState: LocalGameState;
  stateRevision: number;

  // Player info
  isHost: boolean;
  myUserId: string;
  mySeat: number | null;
  myRole: RoleId | null;

  // Debug mode (from useWerewolfDebugMode)
  controlledSeat: number | null;
  effectiveSeat: number | null;
  effectiveRole: RoleId | null;
  takeOverBot: (seat: number) => void;
  releaseBot: () => void;
  isDebugMode: boolean;
  fillWithBots: () => Promise<RoomOperationResult>;
  markAllBotsViewed: () => Promise<ActionResult>;
  markAllBotsGroupConfirmed: () => Promise<ActionResult>;

  // Night-derived (from useWerewolfNightDerived)
  roomStatus: GameStatus;
  currentActionRole: RoleId | null;
  isAudioPlaying: boolean;
  currentSchemaId: SchemaId | null;
  currentSchema: ActionSchema | null;
  currentStepId: SchemaId | null;

  // Connection (from shared RoomSession)
  connectionStatus: RoomConnectionStatus;

  takeSeat: (seat: number) => Promise<RoomOperationResult>;
  leaveSeat: () => Promise<RoomOperationResult>;
  kickPlayer: (targetSeat: number) => Promise<RoomOperationResult>;

  // Game actions (from useWerewolfGameActions)
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  clearAllSeats: () => Promise<RoomOperationResult>;
  shareNightReview: (allowedSeats: number[]) => Promise<void>;
  viewedRole: () => Promise<ActionResult>;
  submitAction: (input: WerewolfActionInput) => Promise<void>;
  submitRevealAck: () => Promise<ActionResult>;
  submitGroupConfirmAck: () => Promise<ActionResult>;
  sendWolfRobotHunterStatusViewed: () => Promise<void>;
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
 * Composition hook for WerewolfRoomScreen — orchestrates 6 sub-hooks into a unified game room interface.
 *
 * Responsible for assembling lifecycle, connection status, game state, actions, night-phase derivations, and BGM.
 */ export const useWerewolfRoom = (facade: WerewolfGameClient): UseWerewolfRoomResult => {
  // =========================================================================
  // Core: facade + services
  // =========================================================================
  const session = facade.roomSession;
  const isFocused = useIsFocused();
  const { user } = useAuthContext();
  const sessionSnapshot = useRoomSessionSnapshot(session, isFocused);
  if (sessionSnapshot.phase !== 'ready') {
    throw new Error('[FAIL-FAST] Werewolf room hooks mounted before the room session was ready');
  }
  if (user === null || user.id !== sessionSnapshot.identity.userId) {
    throw new Error('[FAIL-FAST] Auth profile does not match the ready room session');
  }

  // =========================================================================
  // Sub-hooks
  // =========================================================================

  // Rejoin overlay state: shown when Host rejoins an ongoing game
  const [showContinueOverlay, setShowContinueOverlay] = useState(false);

  const snapshot = sessionSnapshot.snapshot.state;
  const gameState = useMemo(() => toWerewolfLocalState(snapshot), [snapshot]);
  const { identity } = sessionSnapshot;
  const myUserId = identity.userId;
  const isHost = identity.room.hostUserId === identity.userId;
  const mySeat = getWerewolfUserSeat(snapshot, myUserId);

  // Toast notifications for passive actions (kick, clearAllSeats, assignRoles, etc.)
  useWerewolfLastActionToast({
    lastCommand: sessionSnapshot.lastCommand,
    isHost,
    mySeat,
    isFocused,
  });

  // Toast notifications for XP gain / level-up after valid game settlement
  useWerewolfSettleToast({ session, isFocused });

  useEffect(() => {
    if (!isFocused) return; // hidden (blurred) screens do not run side effects
    gameRoomLog.debug('State update from room session', {
      roomCode: snapshot.roomCode,
      status: snapshot.status,
    });

    if (isHost && snapshot.status === GameStatus.Ongoing && facade.wasAudioInterrupted) {
      setAlertBlocked(true);
      setShowContinueOverlay(true);
    }
  }, [facade, isFocused, isHost, snapshot]);

  // BGM state management (needs isHost + gameState derived above)
  const bgm = useWerewolfBgmControl(isHost, gameState.status, gameState.isAudioPlaying);

  const seatCommands = useWerewolfSeatCommands({ session, user });

  // Debug mode: bot control
  const debug = useWerewolfDebugMode(
    facade,
    mySeat,
    gameState,
    seatCommands.leaveSeat,
    seatCommands.fillBots,
  );

  // Night-phase derived values (pure computation)
  const nightDerived = useWerewolfNightDerived(gameState);

  // Game actions: game control + night actions
  const actions = useWerewolfGameActions({
    facade,
    bgm,
    debug,
    isHost,
    mySeat,
    gameState,
    clearSeats: seatCommands.clearSeats,
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
    mySeat !== null ? (gameState.players.get(mySeat)?.role ?? null) : null;

  const roomStatus = gameState.status;

  // =========================================================================
  // Return flat bag
  // =========================================================================
  return {
    gameState,
    stateRevision: sessionSnapshot.snapshot.revision,
    isHost,
    myUserId,
    mySeat,
    myRole,
    // Debug mode
    controlledSeat: debug.controlledSeat,
    effectiveSeat: debug.effectiveSeat,
    effectiveRole: debug.effectiveRole,
    takeOverBot: debug.takeOverBot,
    releaseBot: debug.releaseBot,
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
    connectionStatus: sessionSnapshot.connection,
    takeSeat: seatCommands.takeSeat,
    leaveSeat: seatCommands.leaveSeat,
    kickPlayer: seatCommands.kickSeat,
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
