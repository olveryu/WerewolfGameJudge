/**
 * 组装共享房间控制器；秘密希特勒只负责身份查看与阶段投影。
 */

import {
  getSecrethitlerOccupiedSeatCount,
  getSecrethitlerUserSeat,
  getSecrethitlerViewModel,
  isBotSeat,
  type SecrethitlerCommand,
  type SecrethitlerState,
  type SecrethitlerViewModel,
} from '@game-judge/game-engine/games/secrethitler/public';
import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  gameConfigEditPath,
  gameGuidePath,
  settingsPath,
} from '@/features/navigation/model/gamePaths';
import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeover } from '@/features/room/controllers/useBotTakeover';
import {
  type ReadyRoomSession,
  useReadyRoomSession,
} from '@/features/room/controllers/useReadyRoomSession';
import { type RoleViewing, useRoleViewing } from '@/features/room/controllers/useRoleViewing';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomSetupController } from '@/features/room/controllers/useRoomSetupController';
import { useRoomImagePreload } from '@/features/room/hooks/useRoomImagePreload';
import { applyAudioPlaybackLock } from '@/features/room/model/audioPlaybackLock';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { useRoomReview } from '@/features/room/review/useRoomReview';
import { useGameProfileDetails } from '@/games/model/useGameProfileDetails';
import { getBoardRolePortraits } from '@/games/secrethitler/assets/roleAvatars';
import type { SecrethitlerAudioRuntime } from '@/games/secrethitler/audio/secrethitlerAudioRuntime';
import { toRevealRoleData } from '@/games/secrethitler/components/SecrethitlerRoleCardAdapter';
import type { SecrethitlerRoomSession } from '@/games/secrethitler/model/SecrethitlerRoomSession';

import {
  createSecrethitlerHostManagement,
  createSecrethitlerRoomShellModel,
  getSecrethitlerSeatTapIntent,
} from '../secrethitlerRoomAdapter';

const SECRETHITLER_AUDIO_LOCK_EXEMPT_ACTION_KEYS: ReadonlySet<string> = new Set();
import { getSecrethitlerRoomCommandFailureMessage } from '../secrethitlerRoomCommandFailureMessage';
import { useSecrethitlerAudioOrchestration } from './useSecrethitlerAudioOrchestration';

/**
 * 秘密希特勒房间 Screen 的显式契约：领域推导（视图模型、身份卡锚点）
 * 全部在本 hook 内组装，Screen 只消费本接口渲染。末尾 return 不许 spread。
 */
export interface SecrethitlerRoomScreenState {
  readonly state: SecrethitlerState;
  readonly shellModel: RoomShellModel;
  /** 当前视角的视图模型（按有效席位裁剪）；大厅为 null。 */
  readonly viewModel: SecrethitlerViewModel | null;
  readonly roomCode: string;
  readonly userId: string;
  readonly mySeat: number | null;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly isHost: boolean;
  /** 平台单飞提交：座位动作由调用点显式传 `{ controlledSeat }`，房主命令不传。 */
  readonly submit: ReadyRoomSession<SecrethitlerState, SecrethitlerCommand>['submit'];
  readonly isSubmitting: boolean;
  readonly session: SecrethitlerRoomSession;
  readonly openRules: () => void;
  /** 本局复盘弹窗、导出舞台与分享进度（平台 useRoomReview），放进房间 gameOverlays。 */
  readonly reviewOverlay: ReactNode;
  /** 身份卡：先落查看记录、确认后再弹卡（平台 useRoleViewing）。 */
  readonly roleViewing: RoleViewing;
  readonly roleCardAllRoles: readonly RevealRoleData[];
  readonly actionModalOpen: boolean;
  readonly closeAction: () => void;
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
export function useSecrethitlerRoomState(
  props: GameRoomScreenProps<'secrethitler'> & {
    readonly audio: SecrethitlerAudioRuntime;
    readonly session: SecrethitlerRoomSession;
    readonly review: RoomReviewContribution<SecrethitlerState>;
    readonly entryController: RoomEntryController;
  },
): SecrethitlerRoomScreenState {
  const { session, room, entryController } = props;
  const navigate = useNavigate();
  const { user, state, revision, submit, isSubmitting } = useReadyRoomSession(
    session,
    getSecrethitlerRoomCommandFailureMessage,
  );
  useRoomImagePreload(getBoardRolePortraits());
  const isHost = state.hostUserId === user.id;
  const mySeat = getSecrethitlerUserSeat(state, user.id);
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const isLobby = state.phase.kind === 'lobby';
  // 机器人接管：房主随时可接管；失去房主身份或座位不再是机器人时由共享守卫释放。
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'Secrethitler',
  });
  const { controlledSeat, effectiveSeat } = bots;
  const privateActions = useSecrethitlerPrivateActions(
    state,
    submit,
    effectiveSeat,
    controlledSeat,
  );
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: '秘密希特勒',
    isHost,
    entryReason: props.entryReason,
  });
  const {
    seatController,
    profile,
    capabilities: setupCapabilities,
  } = useRoomSetupController({
    session,
    user,
    isSetup: isLobby,
    isHost,
    mySeat,
    supportsBots: true,
    hasOccupiedSeats: getSecrethitlerOccupiedSeatCount(state) > 0,
    isRoomFull: getSecrethitlerOccupiedSeatCount(state) === state.config.numberOfPlayers,
    configureGame: () => void navigate(gameConfigEditPath('secrethitler', room.roomCode)),
    shareRoom: share.open,
  });
  const gameDetails = useGameProfileDetails(profile.selection, '秘密希特勒战绩', '本游戏局数');
  // 房主设备承载电子主持音频，不需要真人朗读或推进。
  useSecrethitlerAudioOrchestration({ session, isHost, audio: props.audio });
  // 本局复盘：入口、弹窗与图片分享归平台，复盘文档由模块声明的 review 给出。
  const review = useRoomReview({
    contribution: props.review,
    state,
    viewer,
    roomId: room.roomId,
    roomCode: room.roomCode,
    onOpened: null,
  });
  const capabilities: RoomCapabilities = {
    ...setupCapabilities,
    canTakeOverBots: bots.capability,
  };
  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    state,
    currentSeat: mySeat,
    resolveIntent: getSecrethitlerSeatTapIntent,
    profile,
    seatController,
  });
  const buildHostManagement = () =>
    applyAudioPlaybackLock(
      createSecrethitlerHostManagement({
        state,
        capabilities,
        isSubmitting,
        submit,
        review: review.entry,
      }),
      {
        isAudioPlaying: state.isAudioPlaying,
        exemptActionKeys: SECRETHITLER_AUDIO_LOCK_EXEMPT_ACTION_KEYS,
      },
    );

  const shellModel: RoomShellModel = createSecrethitlerRoomShellModel({
    roomCode: room.roomCode,
    viewer,
    capabilities,
    onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
    onTitlePress: titleActions.handleTitlePress,
    onTitleLongPress: titleActions.handleTitleLongPress,
    user,
    gachaStatus,
    onUserActionPress: () => void navigate(settingsPath(room.roomCode)),
    connection: entryController.connection,
    state,
    revision,
    controlledSeat,
    seatsVisuallyDisabled: isSubmitting || seatController.isSubmitting,
    onSeatPress,
    onBotSeatLongPress: bots.capability.isAllowed ? bots.onBotSeatLongPress : null,
    seatController,
    profileSelection: profile.selection,
    gameDetails,
    onProfileClose: profile.close,
    onProfileLeaveSeat: profile.leaveSelf,
    share,
    isLobby,
    buildHostManagement,
    releaseBot: bots.release,
    review: review.entry,
    openIdentity: privateActions.roleViewing.open,
    openAction: privateActions.openAction,
    isSubmitting,
  });
  const viewModel = isLobby ? null : getSecrethitlerViewModel(state, effectiveSeat);
  return {
    state,
    shellModel,
    viewModel,
    roomCode: room.roomCode,
    userId: user.id,
    mySeat,
    effectiveSeat,
    controlledSeat,
    isHost,
    submit,
    isSubmitting,
    session,
    openRules: () => void navigate(gameGuidePath('secrethitler', room.roomCode)),
    reviewOverlay: review.overlay,
    roleViewing: privateActions.roleViewing,
    roleCardAllRoles: privateActions.roleCardAllRoles,
    actionModalOpen: privateActions.actionModalOpen,
    closeAction: privateActions.closeAction,
  };
}

function useSecrethitlerPrivateActions(
  state: SecrethitlerState,
  submit: SecrethitlerRoomScreenState['submit'],
  effectiveSeat: number | null,
  controlledSeat: number | null,
) {
  const [actionKey, setActionKey] = useState<string | null>(null);
  const currentActionKey = `${state.gameSequence}:${state.phase.kind}:${state.phase.kind === 'night' ? state.phase.step : state.history.governments.length}:${effectiveSeat}`;
  const roleViewing = useRoleViewing({
    effectiveSeat,
    identityKey: state.phase.kind === 'lobby' ? null : state.gameSequence,
    hasViewed:
      state.phase.kind === 'ended' ||
      (effectiveSeat !== null && state.roleViewedSeats.includes(effectiveSeat)),
    occupiedSeatCount: getSecrethitlerOccupiedSeatCount(state),
    viewedSeatCount: state.roleViewedSeats.length,
    submitViewed: () =>
      submit('查看身份', { type: 'secrethitler.role.viewed' }, { controlledSeat }),
  });
  return {
    roleViewing,
    roleCardAllRoles: Array.from(new Set(Object.values(state.identities)), toRevealRoleData),
    actionModalOpen: actionKey === currentActionKey,
    openAction: () => setActionKey(currentActionKey),
    closeAction: () => setActionKey(null),
  };
}
