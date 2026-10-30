/** Compose Undercover controls and projections into the existing RoomShell contract. */
import {
  getUndercoverRoleCounts,
  getUndercoverUserSeat,
  isBotSeat,
  UNDERCOVER_ROLE_NAMES,
  type UndercoverRoleCounts,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { useMemo } from 'react';

import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeover } from '@/features/room/controllers/useBotTakeover';
import { useReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomRosterController } from '@/features/room/controllers/useRoomRosterController';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { resolveEquippedRevealEffect } from '@/features/room/model/resolveEquippedRevealEffect';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';
import {
  createUndercoverRoomCapabilities,
  createUndercoverRoomShellModel,
  getUndercoverProfileTarget,
  getUndercoverSeatTapIntent,
} from '../undercoverRoomAdapter';
import { getUndercoverRoomCommandFailureMessage } from '../undercoverRoomCommandFailureMessage';
import {
  type UndercoverRoundControls,
  useUndercoverRoundControls,
} from './useUndercoverRoundControls';

interface UndercoverRoomScreenStateInput extends GameRoomScreenProps<'undercover'> {
  readonly session: UndercoverRoomSession;
  readonly entryController: RoomEntryController;
}

/**
 * 卧底房间 Screen 的显式契约（P-2b，对齐狼人杀 WerewolfRoomScreenState 形态）：
 * Screen 需要的推导在本 hook 内组装，回合控制以 UndercoverRoundControls 契约嵌套。
 */
export interface UndercoverRoomScreenState {
  readonly state: UndercoverState;
  readonly shellModel: RoomShellModel;
  readonly controls: UndercoverRoundControls;
  readonly isControlled: boolean;
  readonly equippedRevealEffect: RevealEffectType | null;
  /** Animator 候选池（公开配置展开，原在 Screen 内组装，P-2b 下沉）。 */
  readonly revealPool: readonly RevealRoleData[];
  /** 身份构成计数（引擎口径：卧底人数随总人数变化），供 BoardInfo 展示。 */
  readonly roleCounts: UndercoverRoleCounts;
  readonly openRules: () => void;
}

export function useUndercoverRoomState({
  room,
  entryReason,
  navigation,
  session,
  entryController,
}: UndercoverRoomScreenStateInput): UndercoverRoomScreenState {
  const { user, state, revision, submit, isSubmitting } = useReadyRoomSession(
    session,
    getUndercoverRoomCommandFailureMessage,
  );
  const isHost = state.hostUserId === user.id;
  const mySeat = getUndercoverUserSeat(state, user.id);
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const isLobby = state.phase === 'lobby';
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'Undercover',
  });
  const {
    share,
    titleActions: title,
    gachaStatus,
  } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: '谁是卧底',
    isHost,
    entryReason,
  });
  const configure = () =>
    navigation.navigate('GameConfig', {
      gameType: 'undercover',
      mode: 'edit',
      roomCode: room.roomCode,
    });
  // 座位 / 资料卡：资料卡全程可开（对齐狼人杀），故用 roster 控制器 + 本家能力表。
  const { seatController, profile, actions } = useRoomRosterController({ session, user, mySeat });
  const capabilities = createUndercoverRoomCapabilities({
    ...actions,
    state,
    isHost,
    mySeat,
    configureGame: configure,
    shareRoom: share.open,
    openProfile: profile.open,
    takeOverBots: bots.capability,
  });
  const controls = useUndercoverRoundControls({
    state,
    userId: user.id,
    controlledSeat: bots.controlledSeat,
    submit,
    isSubmitting,
  });
  // 对局中（非选人）点座位只开资料卡；空位与禁用座位按共享规则提示。
  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    inGameAction: (seat) => {
      const target = getUndercoverProfileTarget(state, seat);
      if (target === null) return false;
      profile.open(target);
      return true;
    },
    state,
    currentSeat: mySeat,
    resolveIntent: getUndercoverSeatTapIntent,
    profile,
    seatController,
  });
  const roleCounts = getUndercoverRoleCounts(state.config.numberOfPlayers, state.config.hasBlank);
  // Reveal pool for the animator: kind counts from the public config,
  // expanded per seat-kind. Kinds and counts are public; which seat
  // holds which kind is never included.
  const revealPool = useMemo((): readonly RevealRoleData[] => {
    const kinds = [
      { id: 'civilian', name: UNDERCOVER_ROLE_NAMES.civilian, count: roleCounts.civilian },
      { id: 'undercover', name: UNDERCOVER_ROLE_NAMES.undercover, count: roleCounts.undercover },
      { id: 'blank', name: UNDERCOVER_ROLE_NAMES.blank, count: roleCounts.blank },
    ] as const;
    return kinds.flatMap((kind) =>
      Array.from({ length: kind.count }, () => ({
        id: kind.id,
        name: kind.name,
        alignment: 'neutral' as const,
      })),
    );
  }, [roleCounts]);
  const shellModel: RoomShellModel = createUndercoverRoomShellModel({
    roomCode: room.roomCode,
    viewer,
    capabilities,
    onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
    onTitlePress: title.handleTitlePress,
    onTitleLongPress: title.handleTitleLongPress,
    user,
    gachaStatus,
    onUserActionPress: () => navigation.navigate('Settings', { roomCode: room.roomCode }),
    connection: entryController.connection,
    state,
    revision,
    controlledSeat: bots.controlledSeat,
    selectedSeat: controls.selectedSeat,
    isSelecting: controls.isSelecting,
    seatsVisuallyDisabled: isSubmitting || seatController.isSubmitting,
    onSeatPress: controls.isSelecting ? controls.selectSeat : onSeatPress,
    onBotSeatLongPress:
      !controls.isSelecting && bots.capability.isAllowed ? bots.onBotSeatLongPress : null,
    seatConfirmation: createRoomSeatConfirmationModel(seatController),
    profile: createRoomProfileCardModel({
      selection: profile.selection,
      capabilities,
      onClose: profile.close,
      onLeaveSeat: profile.leaveSelf,
    }),
    share,
    controls,
    release: bots.release,
  });
  return {
    state,
    shellModel,
    controls,
    isControlled: bots.controlledSeat !== null,
    equippedRevealEffect: resolveEquippedRevealEffect(user.equippedEffect, room.roomCode, user.id),
    revealPool,
    roleCounts,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'undercover', roomCode: room.roomCode }),
  };
}
