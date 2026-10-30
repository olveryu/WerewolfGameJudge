/** Pictionary-owned derivation of game-neutral RoomShell models. */

import {
  getPictionaryOccupiedSeatCount,
  getPictionaryRelayStepCount,
  getPictionaryTaskForSeat,
  isPictionaryRoomFull,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import { createRoomSeatDataSource } from '@/features/room/model/createRoomSeatDataSource';
import {
  createRoomShellModel,
  type RoomShellModelInput,
} from '@/features/room/model/createRoomShellModel';
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  buildAbortGameAction,
  buildClearSeatsAction,
  buildFillBotsAction,
  buildNextRoundAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildShareRoomAction,
  buildStartGameAction,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostActionTask,
  hostClosingTask,
  hostStartTask,
  seatShortageReason,
} from '@/features/room/model/hostManagementActions';
import type { NightStepProgress } from '@/features/room/model/nightProgress';
import type { RoomBottomStackModel } from '@/features/room/model/RoomBottomActions';
import { buildLobbyHostStartMessage } from '@/features/room/model/RoomBottomActions';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  createViewProfilesCapability,
  type RoomCapabilities,
  type RoomProfileTarget,
} from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
  RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import { showConfirmAlert } from '@/utils/alertPresets';

export const PICTIONARY_DISPLAY_NAME = '你画我猜接龙';

interface PictionaryCapabilitiesInput {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly requestTakeSeat: (seat: number) => void;
  readonly requestMoveSeat: (seat: number) => void;
  readonly leaveSeat: () => void;
  readonly kickSeat: (seat: number) => void;
  readonly clearSeats: () => void;
  readonly fillBots: () => void;
  readonly configureGame: () => void;
  readonly openProfile: (target: RoomProfileTarget) => void;
  readonly takeOverBot: (seat: number) => void;
  readonly shareRoom: () => void;
}

export function createPictionaryRoomCapabilities(
  input: PictionaryCapabilitiesInput,
): RoomCapabilities {
  const isLobby = input.state.phase === 'lobby';
  const setupCapabilities = createRoomSetupCapabilities({
    isSetup: isLobby,
    isHost: input.isHost,
    supportsBots: true,
    mySeat: input.mySeat,
    hasOccupiedSeats: getPictionaryOccupiedSeatCount(input.state) > 0,
    isRoomFull: isPictionaryRoomFull(input.state),
    requestTakeSeat: input.requestTakeSeat,
    requestMoveSeat: input.requestMoveSeat,
    leaveSeat: input.leaveSeat,
    kickSeat: input.kickSeat,
    clearSeats: input.clearSeats,
    fillBots: input.fillBots,
    configureGame: input.configureGame,
    shareRoom: input.shareRoom,
  });
  return {
    ...setupCapabilities,
    canViewProfiles: createViewProfilesCapability(isLobby, input.openProfile),
    canTakeOverBots: createBotTakeoverCapability(input.isHost, input.takeOverBot),
  };
}

interface PictionarySeatSourceInput {
  readonly state: PictionaryState;
  readonly revision: number;
  readonly myUserId: string;
  readonly controlledSeat: number | null;
}

function getPictionarySeatStatus(
  state: PictionaryState,
  seat: number,
): RoomSeatViewModel['statusBadge'] {
  if (state.phase !== 'answering' && state.phase !== 'settling') return null;
  const task = getPictionaryTaskForSeat(state, seat);
  if (task === null) return null;
  if (task.chain.entries.length > state.stepIndex) {
    return { label: '已提交', tone: 'success' };
  }
  if (state.reservations.some((reservation) => reservation.authorSeat === seat)) {
    return { label: '上传中', tone: 'info' };
  }
  return { label: '作答中', tone: 'warning' };
}

export function createPictionarySeatDataSource(
  input: PictionarySeatSourceInput,
): RoomSeatDataSource {
  const { state } = input;
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision: input.revision,
    roster: state.roster,
    viewerUserId: input.myUserId,
    controlledSeat: input.controlledSeat,
    isLobby: state.phase === 'lobby',
    gameName: 'Pictionary',
    resolveStatusBadge: (seat, player) =>
      player === null ? null : getPictionarySeatStatus(state, seat),
  });
}

const getPictionaryProfileTarget = (
  state: PictionaryState,
  seat: number,
): RoomProfileTarget | null => getRoomProfileTarget(state.roster, seat);

export const getPictionarySeatTapIntent = createRoomSeatTapIntentResolver(
  getPictionaryProfileTarget,
);

/**
 * The stepped relay phases feed the bottom panel's slim progress row;
 * every other phase has no step progress.
 */
export function derivePictionaryBottomProgress(state: PictionaryState): NightStepProgress | null {
  const relayStepCount = getPictionaryRelayStepCount(state.config.numberOfPlayers);
  switch (state.phase) {
    case 'answering':
      return {
        current: state.stepIndex + 1,
        total: relayStepCount,
        label: state.stepIndex === 0 ? '全员出题中' : '接龙作答中',
      };
    case 'transition':
      return { current: state.stepIndex + 1, total: relayStepCount, label: '准备下一棒' };
    case 'gallery': {
      if (state.gallery === null) {
        throw new Error('[FAIL-FAST] Pictionary gallery phase requires gallery state');
      }
      return {
        current: state.gallery.chainIndex * (state.stepIndex + 1) + state.gallery.entryIndex + 1,
        total: state.config.numberOfPlayers * (state.stepIndex + 1),
        label: '接龙揭晓中',
      };
    }
    default:
      return null;
  }
}

function createPictionaryBottomActions(
  state: PictionaryState,
  viewer: RoomViewer,
): RoomBottomStackModel {
  const message = buildLobbyHostStartMessage({ isLobby: state.phase === 'lobby', viewer });
  return {
    kind: 'stacked',
    message,
    progress: derivePictionaryBottomProgress(state),
    layout: { primary: [], secondary: [], ghost: [] },
  };
}

interface PictionaryHostManagementInput {
  readonly state: PictionaryState;
  readonly isCommandSubmitting: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots' | 'canShareRoom'
  >;
  readonly startRound: () => void;
  readonly nextRound: () => void;
  readonly returnToLobby: () => void;
  readonly abortRound: () => void;
}

/** Assembles the Pictionary host panel for the current phase. Host gating belongs to the shell factory. */
export function createPictionaryHostManagement(
  input: PictionaryHostManagementInput,
): RoomHostManagementModel {
  if (input.state.phase === 'ended' || input.state.phase === 'aborted') {
    const actions: RoomHostManagementAction[] = [];
    if (input.state.phase === 'ended')
      actions.push(
        buildNextRoundAction({
          onPress: () =>
            showConfirmAlert(
              HOST_FLOW_CONFIRM.nextRoundTitle,
              '重新生成画手队列，开始新的一轮。',
              input.nextRound,
            ),
          isEnabled: !input.isCommandSubmitting,
          isLoading: input.isCommandSubmitting || undefined,
        }),
      );
    actions.push(
      buildReturnLobbyAction({
        onPress: () =>
          showConfirmAlert(
            HOST_FLOW_CONFIRM.returnLobbyTitle,
            HOST_FLOW_CONFIRM.returnLobbyBody,
            input.returnToLobby,
          ),
        isEnabled: !input.isCommandSubmitting,
        isLoading: input.isCommandSubmitting || undefined,
      }),
    );
    return {
      task:
        input.state.phase === 'ended'
          ? hostClosingTask()
          : hostActionTask(HOST_ACTION_KEYS.returnLobby),
      sections: [{ key: 'current-flow', title: '当前流程', actions }],
    };
  }
  if (input.state.phase !== 'lobby') {
    const isLastTransition =
      input.state.phase === 'transition' &&
      input.state.stepIndex === input.state.config.numberOfPlayers - 1;
    const canAbort =
      ['answering', 'settling', 'transition'].includes(input.state.phase) && !isLastTransition;
    // 局中房主面板常驻：中止不可用时禁用并给原因，而不是整块消失。
    const abortDisabledReason = isLastTransition
      ? '最后一棒已收齐，即将进入揭晓，不能中止'
      : '当前阶段不能中止';
    return {
      task: null,
      sections: [
        {
          key: 'danger',
          title: '危险操作',
          actions: [
            buildAbortGameAction({
              onPress: input.abortRound,
              isEnabled: canAbort && !input.isCommandSubmitting,
              disabledReason: canAbort ? null : abortDisabledReason,
              isLoading: input.isCommandSubmitting || undefined,
            }),
          ],
        },
      ],
    };
  }
  const startAction: RoomHostManagementAction = buildStartGameAction({
    onPress: () =>
      showConfirmAlert(HOST_FLOW_CONFIRM.startTitle, '将开始本局绘画接龙', input.startRound),
    isEnabled: !input.isCommandSubmitting && isPictionaryRoomFull(input.state),
    isLoading: input.isCommandSubmitting || undefined,
    disabledReason: input.isCommandSubmitting
      ? null
      : seatShortageReason(
          input.state.config.numberOfPlayers,
          getPictionaryOccupiedSeatCount(input.state),
        ),
  });
  const roomActions: RoomHostManagementAction[] = [];
  if (input.capabilities.canConfigureGame.isAllowed) {
    roomActions.push(
      buildRoomConfigAction({
        onPress: input.capabilities.canConfigureGame.execute,
      }),
    );
  }
  if (input.capabilities.canFillBots.isAllowed) {
    roomActions.push(
      buildFillBotsAction({
        onPress: input.capabilities.canFillBots.execute,
      }),
    );
  }
  if (input.capabilities.canClearSeats.isAllowed) {
    roomActions.push(
      buildClearSeatsAction({
        onPress: input.capabilities.canClearSeats.execute,
      }),
    );
  }
  roomActions.push(buildShareRoomAction(input.capabilities.canShareRoom));
  const sections: RoomHostManagementSection[] = [
    { key: 'current-flow', title: '当前流程', actions: [startAction] },
    { key: 'room', title: '房间管理', actions: roomActions },
  ];
  return { task: hostStartTask(HOST_ACTION_KEYS.startGame), sections };
}

export interface PictionaryRoomShellModelInput extends Omit<
  RoomShellModelInput,
  'phase' | 'step' | 'isAudioPlaying' | 'bottomActions'
> {
  readonly state: PictionaryState;
}

/** Assembles the Pictionary RoomShellModel from the hook's projections. */
export function createPictionaryRoomShellModel(
  input: PictionaryRoomShellModelInput,
): RoomShellModel {
  return createRoomShellModel({
    ...input,
    isAudioPlaying: false,
    phase: input.state.phase,
    step: null,
    bottomActions: createPictionaryBottomActions(input.state, input.viewer),
  });
}
