/** Pure Werewolf host-management projection. It does not execute or authorize game commands. */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import {
  buildClearSeatsAction,
  buildEnabledHostAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildPendingAwareHostAction,
  buildRoomConfigAction,
  buildStartGameAction,
  createViewingBeginGate,
  type RoomHostActionDescriptor,
} from '@/features/room/model/hostManagementActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  buildShareRoomRemedy,
  type RoomHostManagementAction,
  type RoomHostManagementModel,
  type RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import type { HostControlEvent } from '@/games/werewolf/room/policy/types';
import { TESTIDS } from '@/testids';

interface WerewolfHostManagementInput {
  readonly isHost: boolean;
  readonly roomStatus: GameStatus;
  readonly isPlagueMode: boolean;
  readonly seatedCount: number;
  readonly viewedCount: number;
  readonly totalSeats: number;
  readonly isAudioPlaying: boolean;
  readonly isStartingGame: boolean;
  readonly isHostActionSubmitting: boolean;
  readonly mvpSeat: number | null;
  readonly onSelectMvp: () => void;
  readonly canMarkAllBotsViewed: boolean;
  readonly canMarkAllBotsGroupConfirmed: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots' | 'canShareRoom'
  >;
  readonly sheriffElection: SheriffElectionPanelModel | null;
  readonly onHostControl: (action: HostControlEvent['action']) => void;
  readonly onMusicSettings: () => void;
  readonly onMarkAllBotsViewed: () => void;
  readonly onMarkAllBotsGroupConfirmed: () => void;
  readonly onNightReview: () => void;
  readonly onLastNightInfo: () => void;
}

function createHostControlAction(
  input: WerewolfHostManagementInput,
  action: HostControlEvent['action'],
  descriptor: RoomHostActionDescriptor,
): RoomHostManagementAction {
  return buildPendingAwareHostAction(descriptor, input.isHostActionSubmitting, () =>
    input.onHostControl(action),
  );
}

function createSheriffAdvanceAction(
  election: SheriffElectionPanelModel,
): RoomHostManagementAction | null {
  if (!election.view.canAdvance || election.view.advanceLabel === null) return null;
  const descriptor: RoomHostActionDescriptor = {
    key: 'sheriff-advance',
    label: election.view.advanceLabel,
    icon: 'arrow-forward-outline',
    variant: 'primary',
    testID: TESTIDS.sheriffAdvanceButton,
    isLoading: election.pendingAction?.kind === 'advance',
    isPrimary: true,
  };
  return buildPendingAwareHostAction(
    descriptor,
    election.pendingAction !== null,
    () => void election.advance(),
  );
}

function createSheriffSelfDestructAction(
  election: SheriffElectionPanelModel,
): RoomHostManagementAction | null {
  const canEndBySelfDestruct =
    election.view.phase === 'candidateSpeech' || election.view.phase === 'runoffSpeech';
  if (!canEndBySelfDestruct) return null;
  const descriptor: RoomHostActionDescriptor = {
    key: 'sheriff-self-destruct',
    label: '自爆结束竞选',
    icon: 'warning-outline',
    variant: 'danger',
    testID: TESTIDS.sheriffSelfDestructButton,
    isLoading: election.pendingAction?.kind === 'endBySelfDestruct',
  };
  return buildPendingAwareHostAction(
    descriptor,
    election.pendingAction !== null,
    election.requestEndBySelfDestruct,
  );
}

function createCurrentFlowActions(input: WerewolfHostManagementInput): RoomHostManagementAction[] {
  switch (input.roomStatus) {
    case GameStatus.Unseated:
    case GameStatus.Seated: {
      const descriptor: RoomHostActionDescriptor = {
        key: 'prepare-to-flip',
        label: '分配角色',
        icon: 'layers-outline',
        variant: 'primary',
        testID: TESTIDS.prepareToFlipButton,
        isLoading: input.isHostActionSubmitting,
        isPrimary: true,
        remedy: buildShareRoomRemedy(input.capabilities.canShareRoom),
      };
      // Availability lives on the descriptor: while seats are open the
      // action itself renders disabled with the seat-count reason, and
      // the console derives its blocked state from the disabled
      // primary action — the same shape as the start-game action once
      // roles are assigned. The dialog layer no longer gates on a full
      // room; a server-side rejection surfaces via the failure alert.
      if (!input.isHostActionSubmitting && input.seatedCount < input.totalSeats) {
        return [
          {
            ...descriptor,
            isEnabled: false,
            disabledReason: `还有 ${input.totalSeats - input.seatedCount} 个空位等待入座`,
          },
        ];
      }
      return [createHostControlAction(input, 'prepareToFlip', descriptor)];
    }
    case GameStatus.Ready:
      return input.isPlagueMode
        ? []
        : [
            buildStartGameAction({
              onPress: () => input.onHostControl('startGame'),
              isEnabled: !input.isHostActionSubmitting,
              isLoading: input.isHostActionSubmitting,
              isPrimary: true,
            }),
          ];
    case GameStatus.Day: {
      if (input.sheriffElection === null) return [];
      const actions: RoomHostManagementAction[] = [];
      const advanceAction = createSheriffAdvanceAction(input.sheriffElection);
      const selfDestructAction = createSheriffSelfDestructAction(input.sheriffElection);
      if (advanceAction !== null) actions.push(advanceAction);
      if (selfDestructAction !== null) actions.push(selfDestructAction);
      return actions;
    }
    case GameStatus.Ended:
      return [
        buildPendingAwareHostAction(
          {
            key: 'select-mvp',
            label: input.mvpSeat === null ? '评选 MVP' : `本局 MVP：${formatSeat(input.mvpSeat)}`,
            icon: 'trophy-outline',
            variant: 'secondary',
          },
          input.isHostActionSubmitting || input.mvpSeat !== null,
          input.onSelectMvp,
        ),
        createHostControlAction(input, 'restart', {
          key: 'restart',
          label: '重新开始',
          icon: 'refresh-outline',
          variant: 'primary',
          testID: TESTIDS.restartButton,
          isLoading: input.isHostActionSubmitting,
        }),
      ];
    case GameStatus.Assigned: {
      // Viewing progress lives on this action's blocked reason (the host
      // console caption): the phase's primary is the start action, held
      // disabled until every seated player has viewed their role. Once
      // all have viewed the reason clears; the phase then promotes to
      // Ready, whose start action is the same press.
      const beginGate = createViewingBeginGate({
        viewedCount: input.viewedCount,
        totalSeats: input.totalSeats,
        submitting: input.isHostActionSubmitting,
        notViewedCopy: `${input.viewedCount}/${input.totalSeats} 位玩家已查看角色，等待剩余玩家`,
      });
      return [
        buildStartGameAction({
          onPress: () => input.onHostControl('startGame'),
          isEnabled: beginGate.isEnabled,
          disabledReason: beginGate.disabledReason,
          isLoading: input.isHostActionSubmitting,
          isPrimary: true,
        }),
      ];
    }
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
      buildRoomConfigAction({
        onPress: input.capabilities.canConfigureGame.execute,
      }),
    );
  }
  if (input.capabilities.canFillBots.isAllowed) {
    actions.push(
      buildFillBotsAction({
        onPress: input.capabilities.canFillBots.execute,
      }),
    );
  }
  if (input.capabilities.canClearSeats.isAllowed) {
    actions.push(
      buildClearSeatsAction({
        onPress: input.capabilities.canClearSeats.execute,
      }),
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
      buildEnabledHostAction(
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
    actions.push(buildMarkBotsViewedAction({ onPress: input.onMarkAllBotsViewed }));
  }
  if (input.canMarkAllBotsGroupConfirmed) {
    actions.push(
      buildEnabledHostAction(
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
    buildEnabledHostAction(
      {
        key: 'night-review',
        label: '本局复盘',
        icon: 'document-text-outline',
        variant: 'secondary',
        testID: TESTIDS.nightReviewButton,
      },
      input.onNightReview,
    ),
    buildEnabledHostAction(
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
  return {
    hasPendingAction: getHasPendingAction(input),
    sections,
  };
}

function getHasPendingAction(input: WerewolfHostManagementInput): boolean {
  if (input.roomStatus === GameStatus.Seated) return true;
  if (input.roomStatus === GameStatus.Ready && !input.isPlagueMode) return true;
  return (
    input.roomStatus === GameStatus.Day &&
    input.sheriffElection?.view.canAdvance === true &&
    input.sheriffElection.view.advanceLabel !== null
  );
}
