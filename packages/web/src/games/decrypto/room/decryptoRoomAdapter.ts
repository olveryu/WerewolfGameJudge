/**
 * 把解码战权威状态投影到共享座位表与房间外壳。
 */

import {
  type DecryptoCommand,
  type DecryptoState,
  getDecryptoOccupiedSeatCount,
} from '@game-judge/game-engine/games/decrypto/public';

import { confirmAction } from '@/features/room/confirm';
import type { RoomProfileSelection } from '@/features/room/controllers/useRoomProfileController';
import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { createRoomSeatDataSource } from '@/features/room/model/createRoomSeatDataSource';
import {
  createRoomShellModel,
  type RoomShellModelInput,
} from '@/features/room/model/createRoomShellModel';
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildResetToLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostActionTask,
  seatShortageReason,
} from '@/features/room/model/hostManagementActions';
import type { RoomHostAction } from '@/features/room/model/RoomAction';
import type { RoomCapabilities, RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import {
  buildEndedWaitingMessage,
  buildLobbyHostStartMessage,
} from '@/features/room/model/RoomPlayerActions';
import type { RoomSeatStatusBadge } from '@/features/room/model/RoomSeatDataSource';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  buildReviewHostAction,
  buildViewerReviewBottomButtons,
  type RoomReviewEntry,
} from '@/features/room/review/roomReviewActions';

/** 为共享资料卡控件返回公开的席位身份。 */
const getDecryptoProfileTarget = (state: DecryptoState, seat: number): RoomProfileTarget | null =>
  getRoomProfileTarget(state.roster, seat);

export interface DecryptoSeatSourceInput {
  readonly state: DecryptoState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

/** Project Decrypto seating into the shared room seat-tap contract. */
export const getDecryptoSeatTapIntent = createRoomSeatTapIntentResolver(getDecryptoProfileTarget);

function teamName(team: 'blue' | 'purple'): string {
  return team === 'blue' ? '蓝队' : '紫队';
}

function getSeatStatusBadge(state: DecryptoState, seat: number): RoomSeatStatusBadge | null {
  if (state.phase.kind === 'teams') {
    const team = state.phase.assignments[seat];
    return team === undefined ? null : { label: teamName(team), tone: 'info' };
  }
  if (state.phase.kind !== 'playing' && state.phase.kind !== 'ended') return null;
  const game = state.phase.game;
  const team = game.assignments[seat];
  if (team === undefined) return null;
  const isEncryptor = game.encryptors?.[team] === seat;
  switch (game.step) {
    case 'encrypt':
      if (isEncryptor)
        return {
          label: game.clues[team] === null ? '待提交线索' : '线索已提交',
          tone: game.clues[team] === null ? 'primary' : 'success',
        };
      return { label: '等待出题', tone: 'muted' };
    case 'guess': {
      if (isEncryptor) return { label: '本队出题人', tone: 'muted' };
      const submitted =
        game.decoded[team] !== null && (game.round === 1 || game.intercepted[team] !== null);
      return {
        label: submitted ? '已提交答案' : '待提交答案',
        tone: submitted ? 'success' : 'warning',
      };
    }
    case 'reveal':
      return { label: '逐步揭晓', tone: 'info' };
    case 'continue':
      if (game.outcome === null) return { label: '本轮完成', tone: 'muted' };
      if (game.outcome === 'shared') return { label: '共同获胜', tone: 'success' };
      return game.outcome === team
        ? { label: '本队获胜', tone: 'success' }
        : { label: '对方获胜', tone: 'danger' };
    case 'tiebreakSubmit':
      return {
        label: game.tiebreakGuesses[team] === null ? '待提交加赛答案' : '加赛答案已交',
        tone: game.tiebreakGuesses[team] === null ? 'warning' : 'success',
      };
    case 'tiebreakJudge':
      return { label: '房主判定中', tone: 'info' };
  }
}

function createDecryptoSeatDataSource(input: DecryptoSeatSourceInput): RoomSeatDataSource {
  const { state, revision, userId, controlledSeat } = input;
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision,
    roster: state.roster,
    viewerUserId: userId,
    controlledSeat,
    isLobby: state.phase.kind === 'lobby',
    gameName: 'Decrypto',
    resolveSecondaryLabel: (seat) => {
      if (state.phase.kind === 'playing' || state.phase.kind === 'ended') {
        const team = state.phase.game.assignments[seat];
        return team === undefined ? null : teamName(team);
      }
      return null;
    },
    resolveStatusBadge: (seat) => getSeatStatusBadge(state, seat),
  });
}

export interface DecryptoRoomShellModelInput extends Omit<
  RoomShellModelInput,
  | 'phase'
  | 'step'
  | 'isAudioPlaying'
  | 'seatSource'
  | 'seatConfirmation'
  | 'profile'
  | 'playerActions'
  | 'controlledSeat'
> {
  readonly state: DecryptoState;
  readonly revision: number;
  readonly controlledSeat: number | null;
  readonly seatController: RoomSeatController;
  readonly profileSelection: RoomProfileSelection | null;
  readonly gameDetails: Parameters<typeof createRoomProfileCardModel>[0]['gameDetails'];
  readonly onProfileClose: () => void;
  readonly onProfileLeaveSeat: () => void;
  readonly isLobby: boolean;
  readonly isSubmitting: boolean;
  readonly pendingActionKey: string | null;
  readonly releaseBot: () => void;
  /** 本局复盘入口（平台 useRoomReview）；没有可复盘的对局时为 null。 */
  readonly review: RoomReviewEntry | null;
}

export interface DecryptoHostManagementInput {
  readonly state: DecryptoState;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'
  >;
  readonly isSubmitting: boolean;
  readonly submit: (
    label: string,
    command: DecryptoCommand,
    options: { readonly actionKey: string | null },
  ) => Promise<boolean>;
  /** 本局复盘入口；终局时必有。 */
  readonly review: RoomReviewEntry | null;
}

function createDecryptoHostTools(input: DecryptoHostManagementInput): RoomHostAction[] {
  const { state } = input;
  const actions: RoomHostAction[] = [];
  if (state.phase.kind === 'playing') actions.push(buildDecryptoRestartAction(input));
  return actions;
}

function buildDecryptoRestartAction(input: DecryptoHostManagementInput): RoomHostAction {
  const { state } = input;
  const wasEnded = state.phase.kind === 'ended';
  return buildResetToLobbyAction({
    onPress: () =>
      confirmAction({
        label: '重新开始？',
        body: wasEnded
          ? input.review?.isPending
            ? '你尚未查看本局复盘。重新开始将保留座位和配置，清除本局；之后可能无法查看复盘，本局已结算，奖励不会撤销。'
            : '保留座位和配置，清除本局并回到准备。之后可能无法查看复盘；本局已结算，奖励不会撤销。'
          : '保留座位和配置，清除本局并回到准备。本局中止，不结算完成奖励。',
        tone: 'danger',
        confirmText: '重新开始',
        onConfirm: () =>
          void input.submit(
            '重新开始',
            { type: 'decrypto.game.restart', gameSequence: state.gameSequence, wasEnded },
            { actionKey: HOST_ACTION_KEYS.restart },
          ),
      }),
    isEnabled: !input.isSubmitting,
    isLoading: input.isSubmitting,
  });
}

/** Assembles the Decrypto host panel for the current phase. Host gating belongs to the shell factory. */
export function createDecryptoHostManagement(
  input: DecryptoHostManagementInput,
): RoomHostManagementModel {
  const { state, capabilities } = input;
  const tools = createDecryptoHostTools(input);
  const roomActions: RoomHostAction[] = [];
  if (capabilities.canConfigureGame.isAllowed)
    roomActions.push(buildRoomConfigAction({ onPress: capabilities.canConfigureGame.execute }));
  if (capabilities.canFillBots.isAllowed)
    roomActions.push(buildFillBotsAction({ onPress: capabilities.canFillBots.execute }));
  if (capabilities.canClearSeats.isAllowed)
    roomActions.push(buildClearSeatsAction({ onPress: capabilities.canClearSeats.execute }));
  const occupiedSeatCount = getDecryptoOccupiedSeatCount(state);
  if (state.phase.kind === 'lobby') {
    const canStart = occupiedSeatCount === state.config.numberOfPlayers;
    const startDisabledReason = canStart
      ? null
      : seatShortageReason(state.config.numberOfPlayers, occupiedSeatCount);
    const submitStart = () =>
      void input.submit(
        '开始游戏',
        { type: 'decrypto.game.begin' },
        { actionKey: HOST_ACTION_KEYS.startGame },
      );
    const startAction = buildStartGameAction({
      onPress: () =>
        confirmAction({
          label: HOST_FLOW_CONFIRM.startTitle,
          body: '将开始本局对局',
          onConfirm: submitStart,
        }),
      isEnabled: !input.isSubmitting && canStart,
      disabledReason: startDisabledReason,
      isLoading: input.isSubmitting,
    });
    return {
      task: hostActionTask(HOST_ACTION_KEYS.startGame),
      pendingActionKeys: [HOST_ACTION_KEYS.startGame],
      actions: [startAction, ...roomActions, ...tools],
    };
  }
  if (state.phase.kind === 'ended') {
    if (input.review === null) throw new Error('[FAIL-FAST] Decrypto ended without a review entry');
    return {
      task: null,
      pendingActionKeys: [],
      actions: [buildReviewHostAction(input.review), buildDecryptoRestartAction(input), ...tools],
    };
  }
  // 局中房主面板常驻：房间管理区始终在；此刻没有待操作。
  return {
    task: null,
    actions: [...roomActions, ...tools],
  };
}

/** Assembles the Decrypto RoomShellModel from the hook's projections. */
export function createDecryptoRoomShellModel(input: DecryptoRoomShellModelInput): RoomShellModel {
  const { state } = input;
  const seatSource = createDecryptoSeatDataSource({
    state,
    revision: input.revision,
    userId: input.viewer.userId,
    controlledSeat: input.controlledSeat,
  });
  return createRoomShellModel({
    ...input,
    isAudioPlaying: false,
    seatSource,
    phase: state.phase.kind,
    step: null,
    seatConfirmation: createRoomSeatConfirmationModel(input.seatController),
    profile: createRoomProfileCardModel({
      selection: input.profileSelection,
      gameDetails: input.gameDetails,
      capabilities: input.capabilities,
      onClose: input.onProfileClose,
      onLeaveSeat: input.onProfileLeaveSeat,
    }),
    playerActions: {
      // 底部按钮必须声明 audience（participant / host / anyone），壳工厂按 viewer 校验。
      message:
        state.phase.kind === 'ended'
          ? buildEndedWaitingMessage({ isEnded: true, viewer: input.viewer })
          : buildLobbyHostStartMessage({ isLobby: input.isLobby, viewer: input.viewer }),
      progress: null,
      // 本局复盘对玩家与观战开放（次级档）；房主从任务卡进入。
      actions: [
        ...(input.review === null
          ? []
          : buildViewerReviewBottomButtons(input.review, input.viewer)),
      ],
      group: null,
    },
    controlledSeat: createControlledSeatModel({
      controlledSeat: input.controlledSeat,
      controlledBotName:
        input.controlledSeat !== null
          ? (seatSource.getSeat(input.controlledSeat).player?.displayName ?? null)
          : null,
      release: input.releaseBot,
      gameName: 'Decrypto',
    }),
  });
}
