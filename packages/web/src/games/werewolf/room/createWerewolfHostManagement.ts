/** Pure Werewolf host-management projection. It does not execute or authorize game commands. */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { applyAudioPlaybackLock } from '@/features/room/model/audioPlaybackLock';
import {
  buildAssignRolesAction,
  buildClearSeatsAction,
  buildEnabledHostAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildMusicSettingsAction,
  buildPendingAwareHostAction,
  buildResetToLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  createViewingBeginGate,
  HOST_ACTION_KEYS,
  hostActionTask,
  hostMessageTask,
  type RoomHostActionDescriptor,
  seatShortageReason,
  viewedProgressReason,
} from '@/features/room/model/hostManagementActions';
import type { RoomHostAction } from '@/features/room/model/RoomAction';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementModel,
  RoomHostTask,
} from '@/features/room/model/RoomHostManagement';
import {
  buildReviewHostAction,
  type RoomReviewEntry,
} from '@/features/room/review/roomReviewActions';
import {
  PANEL_FLOW_ACTION_KEYS,
  type PanelFlowProgress,
  resolvePanelFlowCurrentStep,
} from '@/games/werewolf/room/day/panelFlow';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { TESTIDS } from '@/testids';

/** The host flow controls the panel can trigger; each opens its confirm dialog. */
export type WerewolfHostControlAction = 'prepareToFlip' | 'startGame' | 'restart';

interface WerewolfHostManagementInput {
  readonly roomStatus: GameStatus;
  /** Client-local Day/Ended flow progress (panelFlow.ts). */
  readonly panelFlow: PanelFlowProgress;
  /** The host has granted the review to at least one seat. */
  readonly isReviewShared: boolean;
  readonly isPlagueMode: boolean;
  readonly hasUnviewedOwnRole: boolean;
  readonly seatedCount: number;
  readonly viewedCount: number;
  readonly totalSeats: number;
  readonly isAudioPlaying: boolean;
  readonly isHostActionSubmitting: boolean;
  readonly mvpSeat: number | null;
  readonly onSelectMvp: () => void;
  readonly canMarkAllBotsViewed: boolean;
  readonly canMarkAllBotsGroupConfirmed: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots'
  >;
  readonly sheriffElection: SheriffElectionPanelModel | null;
  readonly onHostControl: (action: WerewolfHostControlAction) => void;
  readonly onMarkAllBotsViewed: () => void;
  readonly onMarkAllBotsGroupConfirmed: () => void;
  readonly onMusicSettings: () => void;
  /** The shared review entry; present from Day on. */
  readonly review: RoomReviewEntry | null;
  /** Opens the seat picker that grants seats access to the review. */
  readonly onGrantReviewAccess: () => void;
  readonly onLastNightInfo: () => void;
}

function createSheriffAdvanceAction(election: SheriffElectionPanelModel): RoomHostAction | null {
  if (!election.view.canAdvance || election.view.advanceLabel === null) return null;
  const descriptor: RoomHostActionDescriptor = {
    key: 'sheriff-advance',
    label: election.view.advanceLabel,
    icon: 'arrow-forward-outline',
    category: 'host',
    testID: TESTIDS.sheriffAdvanceButton,
  };
  return buildPendingAwareHostAction(descriptor, election.pendingAction !== null, () =>
    election.requestAdvance(),
  );
}

function createSheriffSelfDestructAction(
  election: SheriffElectionPanelModel,
): RoomHostAction | null {
  const canEndBySelfDestruct =
    election.view.phase === 'candidateSpeech' ||
    election.view.phase === 'runoffSpeech' ||
    election.view.phase === 'firstVote' ||
    election.view.phase === 'runoffVote';
  if (!canEndBySelfDestruct) return null;
  const descriptor: RoomHostActionDescriptor = {
    key: 'sheriff-self-destruct',
    label: '自爆结束竞选',
    icon: 'warning-outline',
    category: 'danger',
    testID: TESTIDS.sheriffSelfDestructButton,
  };
  return buildPendingAwareHostAction(
    descriptor,
    election.pendingAction !== null,
    election.requestEndBySelfDestruct,
  );
}

function createCurrentFlowActions(input: WerewolfHostManagementInput): RoomHostAction[] {
  switch (input.roomStatus) {
    case GameStatus.Unseated:
    case GameStatus.Seated: {
      // Availability lives on the action: while seats are open the
      // action itself renders disabled with the seat-count reason, and
      // the console derives its blocked state from the disabled
      // primary action — the same shape as the start-game action once
      // roles are assigned. A server-side rejection surfaces via the
      // failure alert.
      const seatsOpen = input.seatedCount < input.totalSeats;
      return [
        buildAssignRolesAction({
          onPress: () => input.onHostControl('prepareToFlip'),
          isEnabled: !input.isHostActionSubmitting && !seatsOpen,
          disabledReason: seatsOpen
            ? seatShortageReason(input.totalSeats, input.seatedCount)
            : null,
          isLoading: input.isHostActionSubmitting,
        }),
      ];
    }
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
      const actions: RoomHostAction[] = [];
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
            category: 'host',
          },
          input.isHostActionSubmitting || input.mvpSeat !== null,
          input.onSelectMvp,
        ),
        buildResetToLobbyAction({
          onPress: () => input.onHostControl('restart'),
          isEnabled: !input.isHostActionSubmitting,
          isLoading: input.isHostActionSubmitting,
        }),
      ];
    case GameStatus.Assigned: {
      if (input.isPlagueMode) return [];
      // Viewing progress lives on this action's blocked reason (the host
      // console caption): the phase's primary is the start action, held
      // disabled until every seated player has viewed their role. Once
      // all have viewed the reason clears; the phase then promotes to
      // Ready, whose start action is the same press.
      const beginGate = createViewingBeginGate({
        viewedCount: input.viewedCount,
        totalSeats: input.totalSeats,
        submitting: input.isHostActionSubmitting,
        notViewedCopy: viewedProgressReason(input.viewedCount, input.totalSeats, '角色'),
      });
      return [
        buildStartGameAction({
          onPress: () => input.onHostControl('startGame'),
          isEnabled: beginGate.isEnabled,
          disabledReason: beginGate.disabledReason,
          isLoading: input.isHostActionSubmitting,
        }),
      ];
    }
    case GameStatus.Ongoing:
      return [];
  }
}

/**
 * The host's declared task per status (room-shell-contract "Host Task").
 * Every key references a sheet action assembled in this module; the Day /
 * Ended flow steps come from panelFlow.ts.
 */
function createHostTask(input: WerewolfHostManagementInput): RoomHostTask | null {
  switch (input.roomStatus) {
    case GameStatus.Unseated:
    case GameStatus.Seated:
      return hostActionTask(HOST_ACTION_KEYS.assignRoles);
    case GameStatus.Assigned:
      if (input.isPlagueMode)
        return hostMessageTask(viewedProgressReason(input.viewedCount, input.totalSeats, '角色'));
      // The task is the start; its action carries the viewing gate reason.
      return hostActionTask(HOST_ACTION_KEYS.startGame);
    case GameStatus.Ready:
      return input.isPlagueMode
        ? hostMessageTask('黑死病模式 — 已发牌，请由房主担任真人法官主持后续流程')
        : hostActionTask(HOST_ACTION_KEYS.startGame);
    case GameStatus.Ongoing:
      // The night runs on player actions; the host only scaffolds bots.
      return input.canMarkAllBotsGroupConfirmed
        ? hostMessageTask('有机器人尚未确认本步信息', {
            escapeActionKey: 'mark-bots-confirmed',
          })
        : null;
    case GameStatus.Day: {
      // Dawn: announcing the night result and running the election are
      // both the host's legitimate next moves, and during a speech a
      // wolf may self-destruct at any moment — the host must end the
      // election on the spot. Every move that applies right now is one
      // equal choice on the card. Review grants are available through the
      // election once the host has confirmed the night info.
      // Vote counts stay in the HUD, not the host task.
      const flow = {
        roomStatus: input.roomStatus,
        progress: input.panelFlow,
        reviewShared: input.isReviewShared,
      };
      const infoPending = resolvePanelFlowCurrentStep(flow) === 'lastNightInfo';
      const election = input.sheriffElection;
      const electionMoves: string[] = [];
      if (
        election !== null &&
        election.view.phase !== 'completed' &&
        election.view.canAdvance &&
        election.view.advanceLabel !== null
      ) {
        electionMoves.push('sheriff-advance');
      }
      if (
        election !== null &&
        (election.view.phase === 'candidateSpeech' ||
          election.view.phase === 'runoffSpeech' ||
          election.view.phase === 'firstVote' ||
          election.view.phase === 'runoffVote')
      ) {
        electionMoves.push('sheriff-self-destruct');
      }
      const moves = infoPending
        ? [...electionMoves, PANEL_FLOW_ACTION_KEYS.lastNightInfo]
        : electionMoves;
      if (election !== null && election.view.phase !== 'completed') {
        moves.push(PANEL_FLOW_ACTION_KEYS.grantReview);
      }
      if (moves.length > 1) {
        return { kind: 'choice', actionKeys: moves };
      }
      const [onlyMove] = moves;
      if (onlyMove !== undefined) {
        return hostActionTask(onlyMove);
      }
      return null;
    }
    case GameStatus.Ended: {
      const flow = {
        roomStatus: input.roomStatus,
        progress: input.panelFlow,
        reviewShared: input.isReviewShared,
      };
      switch (resolvePanelFlowCurrentStep(flow)) {
        case 'lastNightInfo':
          return hostActionTask(PANEL_FLOW_ACTION_KEYS.lastNightInfo);
        case 'grantReview':
        case 'closing':
        case null:
          return {
            kind: 'choice',
            actionKeys: [PANEL_FLOW_ACTION_KEYS.grantReview, HOST_ACTION_KEYS.review, 'restart'],
          };
      }
    }
  }
}

function createRoomManagementActions(input: WerewolfHostManagementInput): RoomHostAction[] {
  const actions: RoomHostAction[] = [];
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

function createToolActions(input: WerewolfHostManagementInput): RoomHostAction[] {
  const actions: RoomHostAction[] = [];
  const canOpenMusicSettings =
    !input.isHostActionSubmitting &&
    !input.isAudioPlaying &&
    (input.roomStatus === GameStatus.Unseated ||
      input.roomStatus === GameStatus.Seated ||
      input.roomStatus === GameStatus.Assigned ||
      input.roomStatus === GameStatus.Ready);
  if (canOpenMusicSettings) {
    actions.push(buildMusicSettingsAction({ onPress: input.onMusicSettings }));
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
          category: 'host',
          testID: TESTIDS.roomMarkBotsConfirmedButton,
        },
        input.onMarkAllBotsGroupConfirmed,
      ),
    );
  }
  return actions;
}

function createPostGameActions(input: WerewolfHostManagementInput): RoomHostAction[] {
  if (input.roomStatus !== GameStatus.Day && input.roomStatus !== GameStatus.Ended) return [];
  if (input.review === null) {
    throw new Error(`[FAIL-FAST] Werewolf ${input.roomStatus} host has no review entry`);
  }
  const review = !input.panelFlow.lastNightInfoConfirmed
    ? ({ isEnabled: false, disabledReason: '请先查看昨夜信息' } as const)
    : !input.isReviewShared
      ? ({ isEnabled: false, disabledReason: '请先授权至少一名玩家' } as const)
      : input.review;
  const grantDescriptor = {
    key: PANEL_FLOW_ACTION_KEYS.grantReview,
    label: '授权玩家查看',
    icon: 'people-outline',
    category: 'host',
    testID: TESTIDS.shareReviewButton,
  } as const;
  return [
    buildReviewHostAction(review),
    buildEnabledHostAction(
      {
        key: PANEL_FLOW_ACTION_KEYS.lastNightInfo,
        label: '昨夜信息',
        icon: 'moon-outline',
        category: 'resource',
        testID: TESTIDS.lastNightInfoButton,
      },
      input.onLastNightInfo,
    ),
    input.panelFlow.lastNightInfoConfirmed
      ? buildEnabledHostAction(grantDescriptor, input.onGrantReviewAccess)
      : { ...grantDescriptor, state: { kind: 'blocked', reason: '请先查看昨夜信息' } },
  ];
}

function createDangerActions(input: WerewolfHostManagementInput): RoomHostAction[] {
  const canRestart =
    input.roomStatus === GameStatus.Assigned ||
    input.roomStatus === GameStatus.Ready ||
    input.roomStatus === GameStatus.Ongoing ||
    input.roomStatus === GameStatus.Day;
  if (!canRestart) return [];
  return [
    buildResetToLobbyAction({
      onPress: () => input.onHostControl('restart'),
      isEnabled: !input.isHostActionSubmitting,
      isLoading: input.isHostActionSubmitting,
    }),
  ];
}

/**
 * No host-management action is exempt from the audio playback lock.
 * An action counts as read-only only when it sends no server command,
 * writes no panel-flow progress and starts no review capture or
 * share; every action assembled here fails that test — the review
 * tools advance the panel flow on confirm/open — and identity
 * viewing lives on the bottom panel, not in this model.
 */
const AUDIO_LOCK_EXEMPT_ACTION_KEYS: ReadonlySet<string> = new Set();

/** Build the complete Host-only command surface from current room facts. Host gating belongs to the shell factory. */
export function createWerewolfHostManagement(
  input: WerewolfHostManagementInput,
): RoomHostManagementModel {
  const actions = [
    ...createCurrentFlowActions(input),
    ...createRoomManagementActions(input),
    ...createPostGameActions(input),
    ...createToolActions(input),
    ...createDangerActions(input),
  ];

  if (actions.length === 0) {
    throw new Error('Werewolf Host management must expose at least one action');
  }
  const election = input.sheriffElection?.view;
  const sheriffAdvancePending =
    input.roomStatus === GameStatus.Day &&
    election !== undefined &&
    (election.phase === 'registration' ||
      election.phase === 'candidateSpeech' ||
      election.phase === 'runoffSpeech') &&
    election.canAdvance &&
    election.advanceLabel !== null;
  const endedPendingKeys =
    input.roomStatus !== GameStatus.Ended
      ? []
      : !input.panelFlow.lastNightInfoConfirmed
        ? [PANEL_FLOW_ACTION_KEYS.lastNightInfo]
        : !input.isReviewShared
          ? [PANEL_FLOW_ACTION_KEYS.grantReview]
          : input.review?.isPending
            ? [HOST_ACTION_KEYS.review]
            : [];
  return applyAudioPlaybackLock(
    {
      task: createHostTask(input),
      actions,
      ...(input.roomStatus === GameStatus.Unseated || input.roomStatus === GameStatus.Seated
        ? { pendingActionKeys: [HOST_ACTION_KEYS.assignRoles] }
        : input.roomStatus === GameStatus.Assigned
          ? {
              pendingActionKeys:
                input.isPlagueMode || input.hasUnviewedOwnRole ? [] : [HOST_ACTION_KEYS.startGame],
            }
          : input.roomStatus === GameStatus.Ready
            ? { pendingActionKeys: input.isPlagueMode ? [] : [HOST_ACTION_KEYS.startGame] }
            : input.roomStatus === GameStatus.Day
              ? { pendingActionKeys: sheriffAdvancePending ? ['sheriff-advance'] : [] }
              : input.roomStatus === GameStatus.Ended
                ? { pendingActionKeys: endedPendingKeys }
                : { pendingActionKeys: [] }),
    },
    { isAudioPlaying: input.isAudioPlaying, exemptActionKeys: AUDIO_LOCK_EXEMPT_ACTION_KEYS },
  );
}
