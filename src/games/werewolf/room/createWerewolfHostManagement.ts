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
  type RoomHostActionDescriptor,
} from '@/features/room/model/hostManagementActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  buildShareRoomRemedy,
  type RoomHostManagementAction,
  type RoomHostManagementModel,
  type RoomHostManagementSection,
  type RoomNextStep,
} from '@/features/room/model/RoomHostManagement';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import type { HostControlEvent } from '@/games/werewolf/room/policy/types';
import { resolveWerewolfPhaseStatusCopy } from '@/games/werewolf/room/resolveWerewolfPhaseStatusCopy';
import { TESTIDS } from '@/testids';

interface WerewolfHostManagementInput {
  readonly isHost: boolean;
  readonly roomStatus: GameStatus;
  readonly isPlagueMode: boolean;
  readonly seatedCount: number;
  readonly totalSeats: number;
  readonly viewedCount: number;
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
            buildStartGameAction({
              onPress: () => input.onHostControl('startGame'),
              isEnabled: !input.isHostActionSubmitting,
              isLoading: input.isHostActionSubmitting,
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
  const copy = resolveWerewolfPhaseStatusCopy({
    roomStatus: input.roomStatus,
    isPlagueMode: input.isPlagueMode,
    sheriffPhaseTitle: input.sheriffElection?.view.phaseTitle ?? null,
    sheriffAdvanceLabel:
      input.sheriffElection?.view.canAdvance === true
        ? input.sheriffElection.view.advanceLabel
        : null,
    seatedCount: input.seatedCount,
    totalSeats: input.totalSeats,
    viewedCount: input.viewedCount,
  });
  return {
    preview: copy.hostPreview,
    hasPendingAction: getHasPendingAction(input),
    nextStep: createWerewolfNextStep(input),
    status: copy.hostStatus,
    sections,
  };
}

/**
 * The Werewolf next step. Role assignment is the one step whose panel
 * action stays enabled while its gate (full seats) lives in the dialog
 * layer, so its blocked state is derived from the seat count here; the
 * ready press dispatches the exact host-control events the panel
 * actions use, so the strip and the panel share one execution path
 * (including the dialogs' confirm and seat checks).
 */
function createWerewolfNextStep(input: WerewolfHostManagementInput): RoomNextStep | null {
  if (input.isHostActionSubmitting) return null;
  switch (input.roomStatus) {
    case GameStatus.Unseated:
    case GameStatus.Seated: {
      if (input.seatedCount < input.totalSeats) {
        return {
          actionKey: 'prepare-to-flip',
          label: '分配角色',
          state: {
            kind: 'blocked',
            reason: `还有 ${input.totalSeats - input.seatedCount} 个空位等待入座`,
            remedy: buildShareRoomRemedy(input.capabilities.canShareRoom),
          },
        };
      }
      return {
        actionKey: 'prepare-to-flip',
        label: '分配角色',
        state: { kind: 'ready', onPress: () => input.onHostControl('prepareToFlip') },
      };
    }
    case GameStatus.Ready:
      return input.isPlagueMode
        ? null
        : {
            actionKey: 'start-game',
            label: '开始游戏',
            state: { kind: 'ready', onPress: () => input.onHostControl('startGame') },
          };
    case GameStatus.Assigned:
    case GameStatus.Ongoing:
    case GameStatus.Day:
    case GameStatus.Ended:
      return null;
  }
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
