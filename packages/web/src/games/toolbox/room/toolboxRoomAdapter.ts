/**
 * 把聚会工具的观看者视图投影到共享房间外壳：没有编号座位，入座与参与按账号表达。
 */

import {
  hasEnoughToolboxCards,
  type ToolboxConfig,
  type ToolboxPublicCommand,
  type ToolboxView,
} from '@game-judge/game-engine/games/toolbox/public';

import { confirmAction } from '@/features/room/confirm';
import type { RoomProfileSelection } from '@/features/room/controllers/useRoomProfileController';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import {
  createRoomShellModel,
  type RoomShellModelInput,
} from '@/features/room/model/createRoomShellModel';
import {
  buildClearSeatsAction,
  buildResetToLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostActionTask,
} from '@/features/room/model/hostManagementActions';
import {
  resolveCommandActionState,
  type RoomHostAction,
  type RoomPlayerAction,
} from '@/features/room/model/RoomAction';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import { buildLobbyHostStartMessage } from '@/features/room/model/RoomPlayerActions';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { RoomViewer } from '@/features/room/model/RoomViewer';

const TOOLBOX_ACTION_KEYS = {
  takeSeat: 'toolbox-take-seat',
  releaseSeat: 'toolbox-release-seat',
  openDice: 'toolbox-dice',
  openDraw: 'toolbox-draw',
} as const;

/** 房间内由工具箱自己打开的弹窗。 */
export type ToolboxRoomDialog = 'dice' | 'draw';

const TOOL_LABELS: Readonly<Record<ToolboxConfig['tools'][number], string>> = {
  dice: '骰子',
  identity: '身份牌',
};

type ToolboxSubmit = (
  label: string,
  command: ToolboxPublicCommand,
  options: { readonly actionKey: string | null },
) => Promise<boolean>;

/** 准备中已入座、或使用中为参与者时，观看者是无编号座位的参与者。 */
function createToolboxViewer(view: ToolboxView): RoomViewer {
  const identity = { userId: view.viewerUserId, isHost: view.hostUserId === view.viewerUserId };
  const isParticipant =
    view.phase.kind === 'preparing'
      ? view.phase.isViewerSeated
      : view.phase.participation.kind === 'participant';
  return isParticipant
    ? { ...identity, seat: null, participation: 'seatless' }
    : { ...identity, seat: null };
}

/** 信息卡的公开设置项；身份种类由信息卡的身份小标签展示。 */
export function describeToolboxSettings(
  config: ToolboxConfig,
): readonly { readonly label: string; readonly value: string }[] {
  const tools =
    config.tools.length === 0
      ? '尚未选择'
      : config.tools.map((tool) => TOOL_LABELS[tool]).join('、');
  const settings = [{ label: '本次工具', value: tools }];
  if (!config.tools.includes('identity')) return settings;
  return [...settings, { label: '每人抽', value: `${config.identity.cardsPerPlayer} 张` }];
}

/** 开始按钮不可用时的唯一原因；与引擎的开始校验同序。 */
function findToolboxStartBlocker(view: ToolboxView): string | null {
  if (view.phase.kind !== 'preparing')
    throw new Error('[FAIL-FAST] toolbox start blocker requires the preparing phase');
  if (view.phase.seatedCount === 0) return '至少一人入座才能开始';
  if (view.config.tools.length === 0) return '请先在房间设置中选择工具';
  if (
    view.config.tools.includes('identity') &&
    !hasEnoughToolboxCards(view.config.identity, view.phase.seatedCount)
  )
    return '身份牌不够每人抽，请在房间设置中调整';
  return null;
}

/** 工具箱没有编号座位与机器人；设置、资料与分享按阶段开放。 */
export function createToolboxCapabilities(input: {
  readonly view: ToolboxView;
  readonly configureGame: () => void;
  readonly canViewProfiles: RoomCapabilities['canViewProfiles'];
  readonly shareRoom: () => void;
}): RoomCapabilities {
  const noSeats = { isAllowed: false, reason: '聚会工具没有编号座位' } as const;
  const isPreparing = input.view.phase.kind === 'preparing';
  const isHost = input.view.hostUserId === input.view.viewerUserId;
  return {
    canTakeSeat: noSeats,
    canMoveSeat: noSeats,
    canLeaveSeat: noSeats,
    canKickSeat: noSeats,
    canClearSeats: noSeats,
    canFillBots: { isAllowed: false, reason: '聚会工具没有机器人' },
    canTakeOverBots: { isAllowed: false, reason: '聚会工具没有机器人' },
    canConfigureGame:
      isHost && isPreparing
        ? { isAllowed: true, execute: input.configureGame }
        : { isAllowed: false, reason: '只有房主可以在开始前修改设置' },
    canViewProfiles: input.canViewProfiles,
    canShareRoom: isPreparing
      ? { isAllowed: true, execute: input.shareRoom }
      : { isAllowed: false, reason: '当前阶段不能分享房间' },
    shouldConfirmExit: false,
  };
}

/** 使用中参与者手牌里的工具入口：每个已启用的工具打开自己的弹窗。 */
function createParticipantToolActions(
  view: ToolboxView,
  openDialog: (dialog: ToolboxRoomDialog) => void,
): readonly RoomPlayerAction[] {
  if (view.phase.kind !== 'active' || view.phase.participation.kind !== 'participant') return [];
  const { dice, hand } = view.phase.participation;
  const actions: RoomPlayerAction[] = [];
  if (dice !== null)
    actions.push({
      key: TOOLBOX_ACTION_KEYS.openDice,
      label: '骰子',
      category: 'player',
      audience: 'participant',
      icon: 'game-controller-outline',
      opensDialog: true,
      state: { kind: 'ready', onPress: () => openDialog('dice') },
    });
  if (hand !== null)
    actions.push({
      key: TOOLBOX_ACTION_KEYS.openDraw,
      label: '抽牌',
      category: 'player',
      audience: 'participant',
      icon: 'albums-outline',
      opensDialog: true,
      state: { kind: 'ready', onPress: () => openDialog('draw') },
    });
  return actions;
}

/** 准备阶段的入座 / 取消入座；使用中参与者的骰子与抽牌入口。 */
export function createToolboxPlayerActions(input: {
  readonly view: ToolboxView;
  readonly isSubmitting: boolean;
  readonly pendingActionKey: string | null;
  readonly submit: ToolboxSubmit;
  readonly openDialog: (dialog: ToolboxRoomDialog) => void;
}): readonly RoomPlayerAction[] {
  const { view } = input;
  if (view.phase.kind === 'active') return createParticipantToolActions(view, input.openDialog);
  if (!view.isViewerMember) return [];
  const isSeated = view.phase.isViewerSeated;
  const key = isSeated ? TOOLBOX_ACTION_KEYS.releaseSeat : TOOLBOX_ACTION_KEYS.takeSeat;
  const label = isSeated ? '取消入座' : '入座';
  const command: ToolboxPublicCommand = isSeated
    ? { type: 'toolbox.seat.release' }
    : { type: 'toolbox.seat.take' };
  return [
    {
      key,
      label,
      category: isSeated ? 'resource' : 'player',
      icon: isSeated ? 'person-remove-outline' : 'person-add-outline',
      audience: isSeated ? 'participant' : 'anyone',
      state: resolveCommandActionState({
        key,
        isSubmitting: input.isSubmitting,
        pendingActionKey: input.pendingActionKey,
        whenIdle: {
          kind: 'ready',
          onPress: () => void input.submit(label, command, { actionKey: key }),
        },
      }),
    },
  ];
}

export interface ToolboxHostManagementInput {
  readonly view: ToolboxView;
  readonly capabilities: Pick<RoomCapabilities, 'canConfigureGame'>;
  readonly isSubmitting: boolean;
  readonly pendingActionKey: string | null;
  readonly submit: ToolboxSubmit;
  readonly openDialog: (dialog: ToolboxRoomDialog) => void;
}

function createPreparingHostManagement(input: ToolboxHostManagementInput): RoomHostManagementModel {
  const { view } = input;
  if (view.phase.kind !== 'preparing') throw new Error('[FAIL-FAST] expected preparing phase');
  const startBlocker = findToolboxStartBlocker(view);
  const configVersion = view.configVersion;
  const seatedCount = view.phase.seatedCount;
  const actions: RoomHostAction[] = [
    buildStartGameAction({
      onPress: () =>
        confirmAction({
          label: HOST_FLOW_CONFIRM.startTitle,
          body: `按当前已入座的 ${seatedCount} 人开始；之后进入房间的人只能观看。`,
          onConfirm: () =>
            void input.submit(
              '开始使用',
              { type: 'toolbox.session.begin', configVersion },
              { actionKey: HOST_ACTION_KEYS.startGame },
            ),
        }),
      isEnabled: !input.isSubmitting && startBlocker === null,
      disabledReason: startBlocker,
      isLoading: input.isSubmitting && input.pendingActionKey === HOST_ACTION_KEYS.startGame,
    }),
  ];
  if (input.capabilities.canConfigureGame.isAllowed)
    actions.push(buildRoomConfigAction({ onPress: input.capabilities.canConfigureGame.execute }));
  if (seatedCount > 0)
    actions.push(
      buildClearSeatsAction({
        onPress: () =>
          confirmAction({
            label: '清空座位',
            body: '所有人会离开座位，房间成员不会退出。',
            tone: 'danger',
            onConfirm: () =>
              void input.submit(
                '清空座位',
                { type: 'toolbox.seats.clear' },
                { actionKey: HOST_ACTION_KEYS.clearSeats },
              ),
          }),
        isEnabled: !input.isSubmitting,
        isLoading: input.isSubmitting && input.pendingActionKey === HOST_ACTION_KEYS.clearSeats,
      }),
    );
  return {
    task: hostActionTask(HOST_ACTION_KEYS.startGame),
    pendingActionKeys: [HOST_ACTION_KEYS.startGame],
    actions,
  };
}

function createActiveHostManagement(input: ToolboxHostManagementInput): RoomHostManagementModel {
  const { view } = input;
  if (view.phase.kind !== 'active') throw new Error('[FAIL-FAST] expected active phase');
  const sessionId = view.phase.sessionId;
  const actions: RoomHostAction[] = [
    buildResetToLobbyAction({
      onPress: () =>
        confirmAction({
          label: '重新开始？',
          body: '保留座位和配置，清空本次骰子和身份结果并回到准备。要更换身份牌，可在准备时打开房间设置调整。',
          tone: 'danger',
          confirmText: '重新开始',
          onConfirm: () =>
            void input.submit(
              '重新开始',
              { type: 'toolbox.session.end', sessionId },
              { actionKey: HOST_ACTION_KEYS.restart },
            ),
        }),
      isEnabled: !input.isSubmitting,
      isLoading: input.isSubmitting && input.pendingActionKey === HOST_ACTION_KEYS.restart,
    }),
  ];
  return { task: null, pendingActionKeys: [], actions };
}

/** 房主面板：准备时开始 / 房间设置 / 清空座位；使用中重新开始。 */
export function createToolboxHostManagement(
  input: ToolboxHostManagementInput,
): RoomHostManagementModel {
  return input.view.phase.kind === 'preparing'
    ? createPreparingHostManagement(input)
    : createActiveHostManagement(input);
}

const NO_SEATS: RoomSeatDataSource = {
  count: 0,
  revision: 0,
  getSeat: (index) => {
    throw new Error(`[FAIL-FAST] toolbox has no numbered seat ${index}`);
  },
};

export interface ToolboxRoomShellModelInput extends Pick<
  RoomShellModelInput,
  | 'roomCode'
  | 'isSubmitting'
  | 'pendingActionKey'
  | 'capabilities'
  | 'onBack'
  | 'onTitlePress'
  | 'onTitleLongPress'
  | 'user'
  | 'gachaStatus'
  | 'onUserActionPress'
  | 'connection'
  | 'share'
> {
  readonly view: ToolboxView;
  readonly playerActions: readonly RoomPlayerAction[];
  readonly profileSelection: RoomProfileSelection | null;
  readonly onProfileClose: () => void;
  readonly buildHostManagement: () => RoomHostManagementModel;
}

/** 组装工具箱的 RoomShellModel；座位盘为空，内容由工作区承载。 */
export function createToolboxRoomShellModel(input: ToolboxRoomShellModelInput): RoomShellModel {
  const viewer = createToolboxViewer(input.view);
  return createRoomShellModel({
    roomCode: input.roomCode,
    viewer,
    phase: input.view.phase.kind,
    step: null,
    isAudioPlaying: false,
    isSubmitting: input.isSubmitting,
    pendingActionKey: input.pendingActionKey,
    capabilities: input.capabilities,
    onBack: input.onBack,
    onTitlePress: input.onTitlePress,
    onTitleLongPress: input.onTitleLongPress,
    user: input.user,
    gachaStatus: input.gachaStatus,
    onUserActionPress: input.onUserActionPress,
    connection: input.connection,
    seatSource: NO_SEATS,
    seatsVisuallyDisabled: false,
    onSeatPress: (seat) => {
      throw new Error(`[FAIL-FAST] toolbox has no numbered seat ${seat}`);
    },
    onBotSeatLongPress: null,
    seatConfirmation: null,
    profile: createRoomProfileCardModel({
      selection: input.profileSelection,
      capabilities: input.capabilities,
      onClose: input.onProfileClose,
    }),
    share: input.share,
    playerActions: {
      message: buildLobbyHostStartMessage({
        isLobby: input.view.phase.kind === 'preparing',
        viewer,
      }),
      progress: null,
      group: null,
      actions: input.playerActions,
    },
    controlledSeat: null,
    buildHostManagement: input.buildHostManagement,
  });
}
