/** Pure Werewolf host-management projection. It does not execute or authorize game commands. */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
  RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import type { HostControlEvent } from '@/games/werewolf/room/policy/types';
import { TESTIDS } from '@/testids';

interface WerewolfHostManagementInput {
  readonly isHost: boolean;
  readonly roomStatus: GameStatus;
  readonly isPlagueMode: boolean;
  readonly isAudioPlaying: boolean;
  readonly isStartingGame: boolean;
  readonly isHostActionSubmitting: boolean;
  readonly canMarkAllBotsViewed: boolean;
  readonly canMarkAllBotsGroupConfirmed: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots'
  >;
  readonly sheriffElection: SheriffElectionPanelModel | null;
  readonly onHostControl: (action: HostControlEvent['action']) => void;
  readonly onMusicSettings: () => void;
  readonly onMarkAllBotsViewed: () => void;
  readonly onMarkAllBotsGroupConfirmed: () => void;
  readonly onNightReview: () => void;
  readonly onLastNightInfo: () => void;
}

interface ActionDescriptor {
  readonly key: string;
  readonly label: string;
  readonly icon: RoomHostManagementAction['icon'];
  readonly variant: RoomHostManagementAction['variant'];
  readonly testID?: string;
  readonly isLoading?: boolean;
}

function enabledAction(
  descriptor: ActionDescriptor,
  onPress: () => void,
): RoomHostManagementAction {
  return { ...descriptor, isEnabled: true, onPress };
}

function pendingAwareAction(
  descriptor: ActionDescriptor,
  isPending: boolean,
  onPress: () => void,
): RoomHostManagementAction {
  return isPending
    ? { ...descriptor, isEnabled: false, disabledReason: null, onDisabledPress: null }
    : enabledAction(descriptor, onPress);
}

function createHostControlAction(
  input: WerewolfHostManagementInput,
  action: HostControlEvent['action'],
  descriptor: ActionDescriptor,
): RoomHostManagementAction {
  return pendingAwareAction(descriptor, input.isHostActionSubmitting, () =>
    input.onHostControl(action),
  );
}

function createSheriffAdvanceAction(
  election: SheriffElectionPanelModel,
): RoomHostManagementAction | null {
  if (!election.view.canAdvance || election.view.advanceLabel === null) return null;
  const descriptor: ActionDescriptor = {
    key: 'sheriff-advance',
    label: election.view.advanceLabel,
    icon: 'arrow-forward-outline',
    variant: 'primary',
    testID: TESTIDS.sheriffAdvanceButton,
    isLoading: election.pendingAction?.kind === 'advance',
  };
  return pendingAwareAction(
    descriptor,
    election.isInteractionDisabled || election.pendingAction !== null,
    () => void election.advance(),
  );
}

function createCurrentFlowActions(input: WerewolfHostManagementInput): RoomHostManagementAction[] {
  switch (input.roomStatus) {
    case GameStatus.Seated:
      return [
        createHostControlAction(input, 'prepareToFlip', {
          key: 'prepare-to-flip',
          label: '分配角色',
          icon: 'layers-outline',
          variant: 'primary',
          testID: TESTIDS.prepareToFlipButton,
          isLoading: input.isHostActionSubmitting,
        }),
      ];
    case GameStatus.Ready:
      return input.isPlagueMode
        ? []
        : [
            createHostControlAction(input, 'startGame', {
              key: 'start-game',
              label: '开始游戏',
              icon: 'play-outline',
              variant: 'primary',
              testID: TESTIDS.startGameButton,
              isLoading: input.isHostActionSubmitting,
            }),
          ];
    case GameStatus.Day: {
      const sheriffAction =
        input.sheriffElection === null ? null : createSheriffAdvanceAction(input.sheriffElection);
      return sheriffAction === null ? [] : [sheriffAction];
    }
    case GameStatus.Ended:
      return [
        createHostControlAction(input, 'restart', {
          key: 'restart',
          label: '重新开始',
          icon: 'refresh-outline',
          variant: 'primary',
          testID: TESTIDS.restartButton,
          isLoading: input.isHostActionSubmitting,
        }),
      ];
    case GameStatus.Unseated:
    case GameStatus.Assigned:
    case GameStatus.Ongoing:
      return [];
  }
}

function createRoomManagementActions(
  input: WerewolfHostManagementInput,
): RoomHostManagementAction[] {
  const actions: RoomHostManagementAction[] = [];
  if (input.capabilities.canConfigureGame.isAllowed) {
    actions.push(
      enabledAction(
        {
          key: 'configure-game',
          label: '房间配置',
          icon: 'options-outline',
          variant: 'secondary',
          testID: TESTIDS.roomSettingsButton,
        },
        input.capabilities.canConfigureGame.execute,
      ),
    );
  }
  if (input.capabilities.canFillBots.isAllowed) {
    actions.push(
      enabledAction(
        {
          key: 'fill-bots',
          label: '填充机器人',
          icon: 'people-outline',
          variant: 'secondary',
          testID: TESTIDS.roomFillBotsButton,
        },
        input.capabilities.canFillBots.execute,
      ),
    );
  }
  if (input.capabilities.canClearSeats.isAllowed) {
    actions.push(
      enabledAction(
        {
          key: 'clear-seats',
          label: '清空座位',
          icon: 'trash-outline',
          variant: 'danger',
          testID: TESTIDS.roomClearSeatsButton,
        },
        input.capabilities.canClearSeats.execute,
      ),
    );
  }
  return actions;
}

function createToolActions(input: WerewolfHostManagementInput): RoomHostManagementAction[] {
  const actions: RoomHostManagementAction[] = [];
  const canOpenMusicSettings =
    !input.isStartingGame &&
    !input.isAudioPlaying &&
    input.roomStatus !== GameStatus.Ongoing &&
    input.roomStatus !== GameStatus.Day;
  if (canOpenMusicSettings) {
    actions.push(
      enabledAction(
        {
          key: 'music-settings',
          label: '音乐设置',
          icon: 'musical-notes-outline',
          variant: 'secondary',
          testID: TESTIDS.roomMusicSettingsButton,
        },
        input.onMusicSettings,
      ),
    );
  }
  if (input.canMarkAllBotsViewed) {
    actions.push(
      enabledAction(
        {
          key: 'mark-bots-viewed',
          label: '标记机器人已查看',
          icon: 'eye-outline',
          variant: 'secondary',
        },
        input.onMarkAllBotsViewed,
      ),
    );
  }
  if (input.canMarkAllBotsGroupConfirmed) {
    actions.push(
      enabledAction(
        {
          key: 'mark-bots-confirmed',
          label: '标记机器人已确认',
          icon: 'checkmark-done-outline',
          variant: 'secondary',
        },
        input.onMarkAllBotsGroupConfirmed,
      ),
    );
  }
  return actions;
}

function createPostGameActions(input: WerewolfHostManagementInput): RoomHostManagementAction[] {
  if (input.roomStatus !== GameStatus.Day && input.roomStatus !== GameStatus.Ended) return [];
  return [
    enabledAction(
      {
        key: 'night-review',
        label: '本局复盘',
        icon: 'document-text-outline',
        variant: 'secondary',
        testID: TESTIDS.nightReviewButton,
      },
      input.onNightReview,
    ),
    enabledAction(
      {
        key: 'last-night-info',
        label: '昨夜信息',
        icon: 'moon-outline',
        variant: 'secondary',
        testID: TESTIDS.lastNightInfoButton,
      },
      input.onLastNightInfo,
    ),
  ];
}

function createDangerActions(input: WerewolfHostManagementInput): RoomHostManagementAction[] {
  const canRestart =
    input.roomStatus === GameStatus.Assigned ||
    input.roomStatus === GameStatus.Ready ||
    input.roomStatus === GameStatus.Ongoing ||
    input.roomStatus === GameStatus.Day;
  if (!canRestart) return [];
  return [
    createHostControlAction(input, 'restart', {
      key: 'restart',
      label: '重新开始',
      icon: 'refresh-outline',
      variant: 'danger',
      testID: TESTIDS.restartButton,
      isLoading: input.isHostActionSubmitting,
    }),
  ];
}

function createSection(
  key: string,
  title: string,
  actions: readonly RoomHostManagementAction[],
): RoomHostManagementSection | null {
  return actions.length === 0 ? null : { key, title, actions };
}

function getStatus(input: WerewolfHostManagementInput): string {
  if (input.sheriffElection !== null) {
    return `警长竞选 · ${input.sheriffElection.view.phaseTitle}`;
  }
  switch (input.roomStatus) {
    case GameStatus.Unseated:
      return '等待玩家入座';
    case GameStatus.Seated:
      return '座位准备完成';
    case GameStatus.Assigned:
      return '角色已分配';
    case GameStatus.Ready:
      return input.isPlagueMode ? '真人法官主持中' : '角色确认完成';
    case GameStatus.Ongoing:
      return '夜间进行中';
    case GameStatus.Day:
      return '白天阶段';
    case GameStatus.Ended:
      return '游戏已结束';
  }
}

function getPreview(input: WerewolfHostManagementInput): string {
  if (input.roomStatus === GameStatus.Seated) return '下一步：分配角色';
  if (input.roomStatus === GameStatus.Ready && !input.isPlagueMode) return '下一步：开始游戏';
  if (
    input.roomStatus === GameStatus.Day &&
    input.sheriffElection?.view.canAdvance === true &&
    input.sheriffElection.view.advanceLabel !== null
  ) {
    return `待处理：${input.sheriffElection.view.advanceLabel}`;
  }
  if (input.roomStatus === GameStatus.Ended) return '可重新开始';
  switch (input.roomStatus) {
    case GameStatus.Unseated:
      return '房间配置与座位管理';
    case GameStatus.Assigned:
      return '角色确认与重开';
    case GameStatus.Ready:
      return '真人法官主持中';
    case GameStatus.Ongoing:
      return '夜间工具与重开';
    case GameStatus.Day:
      return input.sheriffElection === null ? '白天工具与重开' : '警长竞选进行中';
  }
}

/** Build the complete Host-only command surface from current room facts. */
export function createWerewolfHostManagement(
  input: WerewolfHostManagementInput,
): RoomHostManagementModel | null {
  if (!input.isHost) return null;

  const sections = [
    createSection('current-flow', '当前流程', createCurrentFlowActions(input)),
    createSection('room-management', '房间管理', createRoomManagementActions(input)),
    createSection('post-game', '赛后管理', createPostGameActions(input)),
    createSection('tools', '辅助工具', createToolActions(input)),
    createSection('danger', '危险操作', createDangerActions(input)),
  ].filter((section): section is RoomHostManagementSection => section !== null);

  if (sections.length === 0) {
    throw new Error('Werewolf Host management must expose at least one action');
  }
  return { preview: getPreview(input), status: getStatus(input), sections };
}
