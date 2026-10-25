/** Pictionary-owned derivation of game-neutral RoomShell models. */

import {
  getPictionaryBotUserId,
  getPictionaryOccupiedSeatCount,
  getPictionaryRelayStepCount,
  getPictionaryTaskForSeat,
  isPictionaryRoomFull,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';

import { createRoomSeatDataSource } from '@/features/room/model/createRoomSeatDataSource';
import {
  createRoomShellModel,
  type RoomShellModelInput,
} from '@/features/room/model/createRoomShellModel';
import { createRoomProfileTargetResolver } from '@/features/room/model/getRoomProfileTarget';
import {
  buildAbortGameAction,
  buildClearSeatsAction,
  buildFillBotsAction,
  buildNextRoundAction,
  buildPendingAwareHostAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  HOST_FLOW_CONFIRM,
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
import {
  buildShareRoomRemedy,
  type RoomHostManagementAction,
  type RoomHostManagementModel,
  type RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
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
    botUserId: (seat) => getPictionaryBotUserId(state.roomCode, seat),
    outOfRangeError: (seat) => `Pictionary seat source index is out of range: ${seat}`,
    lockedSeatReason: '游戏进行中不能入座',
    resolveStatusBadge: (seat, player) =>
      player === null ? null : getPictionarySeatStatus(state, seat),
  });
}

const getPictionaryProfileTarget = createRoomProfileTargetResolver<PictionaryState>(
  getPictionaryBotUserId,
  getBotDisplayName,
);

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
  isHost: boolean,
  mySeat: number | null,
): RoomBottomStackModel {
  const message = buildLobbyHostStartMessage({
    isLobby: state.phase === 'lobby',
    isHost,
    mySeat,
  });
  return {
    kind: 'stacked',
    message,
    progress: derivePictionaryBottomProgress(state),
    layout: { primary: [], secondary: [], ghost: [] },
  };
}

interface PictionaryHostManagementInput {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly isCommandSubmitting: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots' | 'canShareRoom'
  >;
  readonly startRound: () => void;
  readonly nextRound: () => void;
  readonly returnToLobby: () => void;
  readonly finishPhase: () => void;
  readonly abortRound: () => void;
}

export function createPictionaryHostManagement(
  input: PictionaryHostManagementInput,
): RoomHostManagementModel | null {
  if (!input.isHost) return null;
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
      sections: [{ key: 'current-flow', title: '当前流程', actions }],
    };
  }
  if (input.state.phase !== 'lobby') {
    const canAbort =
      ['answering', 'settling', 'transition'].includes(input.state.phase) &&
      !(
        input.state.phase === 'transition' &&
        input.state.stepIndex === input.state.config.numberOfPlayers - 1
      );
    if (!canAbort) return null;
    const sections: RoomHostManagementSection[] = [];
    if (input.state.phase === 'answering')
      sections.push({
        key: 'current-flow',
        title: '当前流程',
        actions: [
          buildPendingAwareHostAction(
            {
              key: 'finish-phase',
              label: '结束本棒',
              icon: 'stop-circle-outline',
              variant: 'secondary',
            },
            input.isCommandSubmitting,
            input.finishPhase,
          ),
        ],
      });
    sections.push({
      key: 'danger',
      title: '危险操作',
      actions: [
        buildAbortGameAction({
          onPress: input.abortRound,
          isEnabled: !input.isCommandSubmitting,
          isLoading: input.isCommandSubmitting || undefined,
        }),
      ],
    });
    return { sections };
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
    isPrimary: true,
    remedy: buildShareRoomRemedy(input.capabilities.canShareRoom),
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
  const sections: RoomHostManagementSection[] = [
    { key: 'current-flow', title: '当前流程', actions: [startAction] },
  ];
  if (roomActions.length > 0) {
    sections.push({ key: 'room', title: '房间管理', actions: roomActions });
  }
  return { sections };
}

export interface PictionaryRoomShellModelInput extends Omit<
  RoomShellModelInput,
  'phase' | 'step' | 'bottomActions'
> {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly mySeat: number | null;
}

/** Assembles the Pictionary RoomShellModel from the hook's projections. */
export function createPictionaryRoomShellModel(
  input: PictionaryRoomShellModelInput,
): RoomShellModel {
  return createRoomShellModel({
    ...input,
    phase: input.state.phase,
    step: null,
    bottomActions: createPictionaryBottomActions(input.state, input.isHost, input.mySeat),
  });
}
