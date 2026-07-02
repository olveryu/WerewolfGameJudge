/**
 * useRoomShellController — shared controller for room-like seat-board screens.
 *
 * Owns room connection, seat operations, profile-card state, sharing, bot takeover,
 * header menu items, and bottom layout wiring. Game adapters provide domain
 * state selectors and action callbacks; this hook never mutates game state directly.
 */
import type { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';
import { useCallback, useMemo } from 'react';

import type { RoomLifecycleCapabilities } from '@/components/room/policy/roomLifecycle';
import { getRoomSeatPressResult } from '@/components/room/policy/roomSeatInteraction';
import type { RoomBottomLayout } from '@/components/room/RoomBottomActionPanel';
import type { RoomHeaderActionItem } from '@/components/room/RoomHeaderActions';
import type { RoomSeatViewModel } from '@/components/room/RoomSeatBoard';
import { showAlert } from '@/utils/alert';

import { usePlayerProfileController } from './usePlayerProfileController';
import type { RoomActionResultLike } from './useRoomActionRunner';
import { useRoomBotControl } from './useRoomBotControl';
import {
  type RoomConnectionLifecycleFacade,
  useRoomConnectionLifecycle,
} from './useRoomConnectionLifecycle';
import { type RoomSeatOperation, useRoomSeatOperations } from './useRoomSeatOperations';
import { useRoomShareActions } from './useRoomShareActions';

export interface RoomShellLifecycle {
  status: GameStatus;
  capabilities: RoomLifecycleCapabilities;
}

export interface RoomShellLifecycleInput<TState> {
  state: TState;
  filled: number;
  isHost: boolean;
  hasBots: boolean;
}

export interface RoomShellHeaderOperationInput {
  filled: number;
  isFull: boolean;
  canManageSeats: boolean;
  onFillBots: () => void;
  onClearSeats: () => void;
}

export interface RoomShellBottomLayoutInput<TState, TBottomContext> {
  state: TState;
  isHost: boolean;
  isFull: boolean;
  effectiveSeat: number | null;
  context: TBottomContext;
}

export interface RoomShellCopy {
  authRequiredTitle: string;
  authRequiredMessage: string;
  enterFailureTitle: string;
  leaveFailureTitle: string;
  kickFailureTitle: string;
  clearSeatsConfirmTitle: string;
  clearSeatsConfirmText: string;
  clearSeatsFailureTitle: string;
  fillBotsConfirmTitle: string;
  fillBotsConfirmMessage: string;
  fillBotsConfirmText: string;
  fillBotsFailureTitle: string;
  exitConfirmTitle: string;
  exitConfirmMessage: string;
  exitConfirmText: string;
  invalidBotTargetTitle: string;
  invalidBotTargetMessage: string;
}

export interface RoomShellOperations<TUser, TProfile> {
  toRosterProfile: (user: TUser) => TProfile;
  sit: (seat: number, profile: TProfile) => Promise<RoomActionResultLike>;
  leaveSeat: () => Promise<RoomActionResultLike>;
  kick: (seat: number) => Promise<RoomActionResultLike>;
  clearSeats: () => Promise<RoomActionResultLike>;
  fillBots: () => Promise<RoomActionResultLike>;
}

export interface UseRoomShellControllerParams<TState, TUser, TProfile, TBottomContext> {
  facade: RoomConnectionLifecycleFacade<TState>;
  roomCode: string;
  gameName: string;
  user: TUser | null;
  myUserId: string | null;
  initialHost: boolean;
  bottomContext: TBottomContext;
  copy: RoomShellCopy;
  operations: RoomShellOperations<TUser, TProfile>;
  runAction: (fn: () => Promise<RoomActionResultLike>, failureTitle: string) => Promise<boolean>;
  onBack: () => void;
  onConnectError: (err: unknown) => void;
  onLeaveError: (err: unknown) => void;
  getHostUserId: (state: TState) => string;
  getPlayerCount: (state: TState) => number;
  countSeatedPlayers: (state: TState) => number;
  getSeatByUserId: (state: TState, userId: string | null) => number | null;
  getSeatOccupantUserId: (state: TState, seat: number) => string | null;
  getDisplayName: (state: TState, seat: number, userId: string) => string;
  hasBots: (state: TState) => boolean;
  isBotSeat: (state: TState, seat: number) => boolean;
  getLifecycle: (input: RoomShellLifecycleInput<TState>) => RoomShellLifecycle;
  createSeatViewModels: (state: TState, mySeat: number | null) => RoomSeatViewModel[];
  createHeaderActionItems: (input: { onShareRoom: () => void }) => RoomHeaderActionItem[];
  createHeaderOperationItems: (input: RoomShellHeaderOperationInput) => RoomHeaderActionItem[];
  createBottomLayout: (
    input: RoomShellBottomLayoutInput<TState, TBottomContext>,
  ) => RoomBottomLayout;
}

export function useRoomShellController<TState, TUser, TProfile, TBottomContext>({
  facade,
  roomCode,
  gameName,
  user,
  myUserId,
  initialHost,
  bottomContext,
  copy,
  operations,
  runAction,
  onBack,
  onConnectError,
  onLeaveError,
  getHostUserId,
  getPlayerCount,
  countSeatedPlayers,
  getSeatByUserId,
  getSeatOccupantUserId,
  getDisplayName,
  hasBots,
  isBotSeat,
  getLifecycle,
  createSeatViewModels,
  createHeaderActionItems,
  createHeaderOperationItems,
  createBottomLayout,
}: UseRoomShellControllerParams<TState, TUser, TProfile, TBottomContext>) {
  const { state, connectionStatus, manualReconnect } = useRoomConnectionLifecycle({
    facade,
    roomCode,
    userId: myUserId,
    onConnectError,
    onLeaveError,
  });

  const isHost = state !== null && myUserId !== null && getHostUserId(state) === myUserId;
  const mySeat = useMemo(
    () => (state ? getSeatByUserId(state, myUserId) : null),
    [getSeatByUserId, myUserId, state],
  );

  const filled = state ? countSeatedPlayers(state) : 0;
  const playerCount = state ? getPlayerCount(state) : 0;
  const isFull = state ? filled === playerCount : false;
  const hasRoomBots = useMemo(() => (state ? hasBots(state) : false), [hasBots, state]);

  const lifecycle = useMemo(
    () => (state ? getLifecycle({ state, filled, isHost, hasBots: hasRoomBots }) : null),
    [filled, getLifecycle, hasRoomBots, isHost, state],
  );
  const roomStatus = lifecycle?.status;
  const roomCapabilities = lifecycle?.capabilities;

  const runSeatOperation = useCallback(
    async (operation: RoomSeatOperation): Promise<boolean> => {
      switch (operation.kind) {
        case 'enter':
        case 'move':
          if (!user) {
            showAlert(copy.authRequiredTitle, copy.authRequiredMessage);
            return false;
          }
          return runAction(
            () => operations.sit(operation.seat, operations.toRosterProfile(user)),
            copy.enterFailureTitle,
          );
        case 'leave':
          return runAction(() => operations.leaveSeat(), copy.leaveFailureTitle);
        case 'kick':
          return runAction(() => operations.kick(operation.seat), copy.kickFailureTitle);
        default: {
          const _exhaustive: never = operation.kind;
          throw new Error(`useRoomShellController: unsupported seat operation ${_exhaustive}`);
        }
      }
    },
    [copy, operations, runAction, user],
  );

  const {
    operation: seatOperation,
    isSubmitting: isSeatSubmitting,
    openOperation,
    cancelOperation,
    confirmOperation,
  } = useRoomSeatOperations({ runOperation: runSeatOperation });

  const openKickOperation = useCallback(
    (seat: number): void => {
      openOperation({ kind: 'kick', seat });
    },
    [openOperation],
  );

  const openLeaveOperation = useCallback(
    (seat: number): void => {
      openOperation({ kind: 'leave', seat });
    },
    [openOperation],
  );

  const getProfileDisplayName = useCallback(
    (seat: number, userId: string): string => {
      if (!state) throw new Error('useRoomShellController.getProfileDisplayName: missing state');
      return getDisplayName(state, seat, userId);
    },
    [getDisplayName, state],
  );

  const profile = usePlayerProfileController({
    myUserId,
    getDisplayName: getProfileDisplayName,
    onKickSeat: openKickOperation,
    onLeaveSeat: openLeaveOperation,
  });

  const isControlledBotSeat = useCallback(
    (seat: number): boolean => {
      if (!state) return false;
      return isBotSeat(state, seat);
    },
    [isBotSeat, state],
  );

  const { activeControlledSeat, effectiveSeat, releaseControlledSeat, toggleControlledSeat } =
    useRoomBotControl({
      enabled: roomCapabilities?.canTakeOverBots ?? false,
      mySeat,
      isBotSeat: isControlledBotSeat,
    });

  const controlledSeatDisplayName = useMemo(() => {
    if (!state || activeControlledSeat === null) return null;
    const occupantUserId = getSeatOccupantUserId(state, activeControlledSeat);
    if (occupantUserId === null) return null;
    return getDisplayName(state, activeControlledSeat, occupantUserId);
  }, [activeControlledSeat, getDisplayName, getSeatOccupantUserId, state]);

  const share = useRoomShareActions({
    roomCode,
    gameName,
    autoShowWhen: state !== null && isHost && initialHost,
  });

  const handleClearSeats = useCallback((): void => {
    showAlert(copy.clearSeatsConfirmTitle, undefined, [
      { text: '取消', style: 'cancel' },
      {
        text: copy.clearSeatsConfirmText,
        style: 'destructive',
        onPress: () => void runAction(() => operations.clearSeats(), copy.clearSeatsFailureTitle),
      },
    ]);
  }, [copy, operations, runAction]);

  const handleFillBots = useCallback((): void => {
    showAlert(copy.fillBotsConfirmTitle, copy.fillBotsConfirmMessage, [
      { text: '取消', style: 'cancel' },
      {
        text: copy.fillBotsConfirmText,
        onPress: () => void runAction(() => operations.fillBots(), copy.fillBotsFailureTitle),
      },
    ]);
  }, [copy, operations, runAction]);

  const actionItems = useMemo(
    () =>
      createHeaderActionItems({
        onShareRoom: share.openQRCode,
      }),
    [createHeaderActionItems, share.openQRCode],
  );

  const operationItems = useMemo(
    () =>
      createHeaderOperationItems({
        filled,
        isFull,
        canManageSeats: roomCapabilities?.canManageSeats ?? false,
        onFillBots: handleFillBots,
        onClearSeats: handleClearSeats,
      }),
    [
      createHeaderOperationItems,
      filled,
      handleClearSeats,
      handleFillBots,
      isFull,
      roomCapabilities?.canManageSeats,
    ],
  );

  const seatViewModels = useMemo(
    () => (state ? createSeatViewModels(state, mySeat) : []),
    [createSeatViewModels, mySeat, state],
  );

  const onSeatPress = useCallback(
    (seat: number): void => {
      if (!state) throw new Error('useRoomShellController.onSeatPress: missing state');
      const result = getRoomSeatPressResult({
        status: roomStatus,
        seat,
        occupantUserId: getSeatOccupantUserId(state, seat),
        mySeat,
        myUserId,
      });

      switch (result.kind) {
        case 'VIEW_PROFILE':
          profile.openProfile(result.seat, result.targetUserId);
          return;
        case 'OPEN_SEAT_OPERATION':
          openOperation({ kind: result.operationKind, seat: result.seat });
          return;
        case 'AUTH_REQUIRED':
          showAlert(copy.authRequiredTitle, copy.authRequiredMessage);
          return;
        case 'NOOP':
          return;
        default: {
          const _exhaustive: never = result;
          throw new Error(`useRoomShellController.onSeatPress: unhandled result ${_exhaustive}`);
        }
      }
    },
    [
      copy.authRequiredMessage,
      copy.authRequiredTitle,
      getSeatOccupantUserId,
      mySeat,
      myUserId,
      openOperation,
      profile,
      roomStatus,
      state,
    ],
  );

  const onSeatLongPress = useCallback(
    (seat: number): void => {
      const result = toggleControlledSeat(seat);
      switch (result.kind) {
        case 'controlled':
        case 'released':
        case 'ignored':
          return;
        case 'invalid_target':
          showAlert(copy.invalidBotTargetTitle, copy.invalidBotTargetMessage);
          return;
        default: {
          const _exhaustive: never = result;
          throw new Error(
            `useRoomShellController.onSeatLongPress: unhandled result ${_exhaustive}`,
          );
        }
      }
    },
    [copy.invalidBotTargetMessage, copy.invalidBotTargetTitle, toggleControlledSeat],
  );

  const handleBack = useCallback((): void => {
    if (roomCapabilities?.shouldConfirmExit === true) {
      showAlert(copy.exitConfirmTitle, copy.exitConfirmMessage, [
        { text: '取消', style: 'cancel' },
        { text: copy.exitConfirmText, style: 'destructive', onPress: onBack },
      ]);
      return;
    }
    onBack();
  }, [
    copy.exitConfirmMessage,
    copy.exitConfirmText,
    copy.exitConfirmTitle,
    onBack,
    roomCapabilities?.shouldConfirmExit,
  ]);

  const bottomLayout = useMemo(() => {
    if (!state) return { primary: [], secondary: [], ghost: [] };
    return createBottomLayout({
      state,
      isHost,
      isFull,
      effectiveSeat,
      context: bottomContext,
    });
  }, [bottomContext, createBottomLayout, effectiveSeat, isFull, isHost, state]);

  return useMemo(
    () => ({
      state,
      connectionStatus,
      manualReconnect,
      mySeat,
      effectiveSeat,
      isHost,
      filled,
      playerCount,
      isFull,
      roomStatus,
      roomCapabilities,
      activeControlledSeat,
      controlledSeatDisplayName,
      releaseControlledSeat,
      actionItems,
      operationItems,
      seatViewModels,
      onSeatPress,
      onSeatLongPress,
      handleBack,
      bottomLayout,
      seatOperation,
      isSeatSubmitting,
      cancelOperation,
      confirmOperation,
      profile,
      share,
    }),
    [
      actionItems,
      activeControlledSeat,
      bottomLayout,
      cancelOperation,
      confirmOperation,
      connectionStatus,
      controlledSeatDisplayName,
      effectiveSeat,
      filled,
      handleBack,
      isFull,
      isHost,
      isSeatSubmitting,
      manualReconnect,
      mySeat,
      onSeatLongPress,
      onSeatPress,
      operationItems,
      playerCount,
      profile,
      releaseControlledSeat,
      roomCapabilities,
      roomStatus,
      seatOperation,
      seatViewModels,
      share,
      state,
    ],
  );
}
