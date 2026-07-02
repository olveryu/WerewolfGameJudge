/**
 * useFibRoomScreenState — FibRoomScreen adapter over the shared room shell controller.
 *
 * Maps FibState selectors and FibFacade actions into game-agnostic room shell
 * inputs. Does not render JSX and does not duplicate shared room hooks.
 */
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FibState } from '@werewolf/game-engine/fibking/types';
import { useCallback, useMemo, useState } from 'react';

import { useRoomActionRunner } from '@/components/room/hooks/useRoomActionRunner';
import {
  type RoomShellBottomLayoutInput,
  type RoomShellLifecycleInput,
  useRoomShellController,
} from '@/components/room/hooks/useRoomShellController';
import { useFibFacade } from '@/contexts';
import { useAuthContext } from '@/contexts/AuthContext';
import type { RootStackParamList } from '@/navigation/types';
import { handleError } from '@/utils/errorPipeline';
import { isExpectedError } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

import { createFibBottomLayout } from '../fibBottomLayout';
import { createFibHeaderActionItems, createFibHeaderOperationItems } from '../fibHeaderItems';
import { getFibRoomLifecycle } from '../fibRoomLifecycle';
import {
  countFibSeatedPlayers,
  createFibSeatViewModels,
  findFibSeatByUserId,
  getFibDisplayName,
  getFibReasonMessage,
  isFibBotUserId,
  userToFibRosterProfile,
} from '../fibRoomView';

interface FibRoomRouteParams {
  roomCode: string;
  isHost: boolean;
}

type FibRoomNavigation = NativeStackNavigationProp<RootStackParamList, 'FibRoom'>;

interface FibBottomActionContext {
  onOpenSettings: () => void;
  onOpenIdentity: () => void;
  onStartRound: () => void;
  onReveal: () => void;
  onRestart: () => void;
  onNextRound: () => void;
}

const FIB_ROOM_COPY = {
  authRequiredTitle: '入座失败',
  authRequiredMessage: '请先登录',
  enterFailureTitle: '入座失败',
  leaveFailureTitle: '离座失败',
  kickFailureTitle: '移出失败',
  clearSeatsConfirmTitle: '清空所有座位?',
  clearSeatsConfirmText: '清空',
  clearSeatsFailureTitle: '清空失败',
  fillBotsConfirmTitle: '填充机器人?',
  fillBotsConfirmMessage: '将用机器人填满空座位',
  fillBotsConfirmText: '填充',
  fillBotsFailureTitle: '填充失败',
  exitConfirmTitle: '退出房间?',
  exitConfirmMessage: '本局进行中',
  exitConfirmText: '退出',
  invalidBotTargetTitle: '无法接管',
  invalidBotTargetMessage: '只能接管机器人座位',
} as const;

function getFibSeatOccupantUserId(state: FibState, seat: number): string | null {
  return state.seats[seat]?.userId ?? null;
}

function getFibSeatByUserId(state: FibState, userId: string | null): number | null {
  return findFibSeatByUserId(state, userId);
}

function hasFibBots(state: FibState): boolean {
  return Object.values(state.seats).some((seat) => isFibBotUserId(seat.userId));
}

function isFibBotSeat(state: FibState, seat: number): boolean {
  const occupant = state.seats[seat] ?? null;
  return occupant !== null && isFibBotUserId(occupant.userId);
}

export function useFibRoomScreenState(params: FibRoomRouteParams, navigation: FibRoomNavigation) {
  const facade = useFibFacade();
  const { user } = useAuthContext();
  const { roomCode, isHost: initialHost } = params;
  const myUserId = user?.id ?? null;
  const [identityOpen, setIdentityOpen] = useState(false);

  const runAction = useRoomActionRunner({
    reasonToMessage: getFibReasonMessage,
    logger: roomScreenLog,
    isExpectedError,
  });

  const handleConnectError = useCallback((err: unknown): void => {
    handleError(err, {
      label: '连接房间',
      logger: roomScreenLog,
      alertMessage: '无法连接房间，请稍后重试',
    });
  }, []);

  const handleLeaveError = useCallback((err: unknown): void => {
    handleError(err, {
      label: '离开房间',
      logger: roomScreenLog,
      feedback: false,
    });
  }, []);

  const goBack = useCallback((): void => {
    navigation.goBack();
  }, [navigation]);

  const openSettings = useCallback((): void => {
    navigation.navigate('FibConfig', { existingRoomCode: roomCode });
  }, [navigation, roomCode]);

  const openIdentity = useCallback((): void => {
    setIdentityOpen(true);
  }, []);

  const closeIdentity = useCallback((): void => {
    setIdentityOpen(false);
  }, []);

  const startRound = useCallback((): void => {
    void runAction(() => facade.startRound(), '开始失败');
  }, [facade, runAction]);

  const reveal = useCallback((): void => {
    void runAction(() => facade.reveal(), '公布失败');
  }, [facade, runAction]);

  const restart = useCallback((): void => {
    void runAction(() => facade.restart(), '重新开始失败');
  }, [facade, runAction]);

  const nextRound = useCallback((): void => {
    void runAction(() => facade.nextRound(), '开始失败');
  }, [facade, runAction]);

  const bottomContext = useMemo<FibBottomActionContext>(
    () => ({
      onOpenSettings: openSettings,
      onOpenIdentity: openIdentity,
      onStartRound: startRound,
      onReveal: reveal,
      onRestart: restart,
      onNextRound: nextRound,
    }),
    [nextRound, openIdentity, openSettings, restart, reveal, startRound],
  );

  const operations = useMemo(
    () => ({
      toRosterProfile: userToFibRosterProfile,
      sit: facade.sit.bind(facade),
      leaveSeat: facade.leaveSeat.bind(facade),
      kick: facade.kick.bind(facade),
      clearSeats: facade.clearSeats.bind(facade),
      fillBots: facade.fillBots.bind(facade),
    }),
    [facade],
  );

  const getLifecycle = useCallback(
    (input: RoomShellLifecycleInput<FibState>) =>
      getFibRoomLifecycle({
        state: input.state,
        filled: input.filled,
        isHost: input.isHost,
        hasBots: input.hasBots,
      }),
    [],
  );

  const createBottomLayout = useCallback(
    ({
      state,
      isHost,
      isFull,
      effectiveSeat,
      context,
    }: RoomShellBottomLayoutInput<FibState, FibBottomActionContext>) =>
      createFibBottomLayout({
        state,
        isHost,
        isFull,
        mySeat: effectiveSeat,
        ...context,
      }),
    [],
  );

  const controller = useRoomShellController({
    facade,
    roomCode,
    gameName: '瞎掰王',
    user,
    myUserId,
    initialHost,
    bottomContext,
    copy: FIB_ROOM_COPY,
    operations,
    runAction,
    onBack: goBack,
    onConnectError: handleConnectError,
    onLeaveError: handleLeaveError,
    getHostUserId: (state) => state.hostUserId,
    getPlayerCount: (state) => state.numberOfPlayers,
    countSeatedPlayers: countFibSeatedPlayers,
    getSeatByUserId: getFibSeatByUserId,
    getSeatOccupantUserId: getFibSeatOccupantUserId,
    getDisplayName: getFibDisplayName,
    hasBots: hasFibBots,
    isBotSeat: isFibBotSeat,
    getLifecycle,
    createSeatViewModels: createFibSeatViewModels,
    createHeaderActionItems: createFibHeaderActionItems,
    createHeaderOperationItems: createFibHeaderOperationItems,
    createBottomLayout,
  });

  const openUserSettings = useCallback((): void => {
    navigation.navigate('Settings', { roomCode });
  }, [navigation, roomCode]);

  const openRules = useCallback((): void => {
    navigation.navigate('FibRules');
  }, [navigation]);

  const identityRole =
    controller.state && controller.effectiveSeat !== null
      ? controller.state.roleBySeat?.[controller.effectiveSeat]
      : undefined;

  return {
    ...controller,
    roomCode,
    user,
    identityOpen,
    identityRole,
    closeIdentity,
    openRules,
    openUserSettings,
  };
}
