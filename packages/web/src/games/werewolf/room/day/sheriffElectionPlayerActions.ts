/**
 * Pure sheriff-election player-action projection.
 *
 * Keeps room utilities separate from authoritative election commands and exposes at most one
 * prominent command. Voting opens the detailed ballot surface instead of changing seat taps.
 */

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { confirmAction } from '@/features/room/confirm';
import {
  AUDIO_PLAYBACK_LOCK_REASON,
  isAudioPlaybackLocked,
} from '@/features/room/model/audioPlaybackLock';
import { HOST_ACTION_KEYS } from '@/features/room/model/hostManagementActions';
import type { RoomActionState, RoomPlayerAction } from '@/features/room/model/RoomAction';
import type { RoomPlayerActionModel } from '@/features/room/model/RoomPlayerActions';
import { REVIEW_TITLE } from '@/features/room/review/reviewCopy';
import { TESTIDS } from '@/testids';

import type { SheriffElectionPanelModel, SheriffElectionPendingAction } from './useSheriffElection';

interface SheriffElectionPlayerActionsInput {
  readonly election: SheriffElectionPanelModel;
  readonly roomTools: readonly RoomPlayerAction[];
  /** The host's review lives in host management; the dock's trailing review tool is for everyone else. */
  readonly isHost: boolean;
  readonly isAudioPlaying: boolean;
  readonly openDetails: () => void;
}

interface SheriffElectionAction {
  readonly key: string;
  readonly label: string;
  readonly testID: string;
  readonly pendingKind: SheriffElectionPendingAction['kind'] | null;
  readonly execute: () => void;
  readonly isPending?: boolean;
}

function findRoomTool(actions: readonly RoomPlayerAction[], key: string): RoomPlayerAction | null {
  return actions.find((action) => action.key === key) ?? null;
}

function createCommandButton(
  action: SheriffElectionAction,
  model: SheriffElectionPanelModel,
  isAudioLocked: boolean,
): RoomPlayerAction {
  let state: RoomActionState;
  if (model.pendingAction?.kind === action.pendingKind) {
    state = { kind: 'busy' };
  } else if (model.pendingAction !== null) {
    state = { kind: 'blocked', reason: null };
  } else if (isAudioLocked) {
    state = { kind: 'blocked', reason: AUDIO_PLAYBACK_LOCK_REASON };
  } else {
    state = { kind: 'ready', onPress: action.execute };
  }
  return {
    key: action.key,
    label: action.label,
    // Election commands are the viewer's own seat actions.
    audience: 'participant' as const,
    category: 'player',
    testID: action.testID,
    ...(action.isPending === true ? { isPending: true } : {}),
    ...(action.key === 'sheriff-open-vote' ? { opensDialog: true } : {}),
    state,
  };
}

function getSheriffVoteButtonLabel(model: SheriffElectionPanelModel): string {
  const ballot = model.view.myBallot;
  if (ballot === null || ballot.kind === 'notSubmitted') return '选择投票';
  if (ballot.kind === 'abstained') return '修改弃票';
  return `改投${formatSeat(ballot.seat)}`;
}

function getPersonalAction(input: SheriffElectionPlayerActionsInput): SheriffElectionAction | null {
  const { election } = input;
  if (election.view.canRegister) {
    return {
      key: 'sheriff-register',
      label: '报名上警',
      testID: TESTIDS.sheriffRegisterButton,
      pendingKind: 'register',
      execute: () => confirmAction({ label: '报名上警', onConfirm: election.register }),
    };
  }
  if (election.view.canCancelRegistration) {
    return {
      key: 'sheriff-cancel-registration',
      label: '撤回报名',
      testID: TESTIDS.sheriffCancelRegistrationButton,
      pendingKind: 'cancelRegistration',
      execute: () => confirmAction({ label: '撤回报名', onConfirm: election.cancelRegistration }),
    };
  }
  if (election.view.canWithdraw) {
    return {
      key: 'sheriff-withdraw',
      label: '退水',
      testID: TESTIDS.sheriffWithdrawButton,
      pendingKind: 'withdraw',
      execute: () =>
        confirmAction({
          label: '退水',
          body: '退水后将退出本次警长竞选。',
          onConfirm: election.withdraw,
        }),
    };
  }
  if (election.view.canVote) {
    return {
      key: 'sheriff-open-vote',
      label: getSheriffVoteButtonLabel(election),
      testID: TESTIDS.sheriffOpenVoteButton,
      pendingKind: null,
      isPending: election.view.myBallot?.kind === 'notSubmitted',
      execute: input.openDetails,
    };
  }
  return null;
}

export function getSheriffWaitingMessage(model: SheriffElectionPanelModel): string {
  switch (model.view.phase) {
    case 'registration':
      return '报名进行中';
    case 'candidateSpeech':
    case 'runoffSpeech':
      return '按顺序发言中';
    case 'firstVote':
    case 'runoffVote':
      return '等待投票完成';
    case 'result':
      return '正在公布竞选结果';
    case 'completed':
      return '竞选已结束';
  }
}

/** Build the Day election actions from the election projection and ordinary room actions. */
export function createSheriffElectionPlayerActions(
  input: SheriffElectionPlayerActionsInput,
): RoomPlayerActionModel {
  const identityAction = findRoomTool(input.roomTools, 'viewRole');
  const leading =
    identityAction === null ? null : { ...identityAction, label: '查看身份' as const };
  const reviewAction = input.isHost ? null : findRoomTool(input.roomTools, HOST_ACTION_KEYS.review);
  const trailing = reviewAction === null ? null : { ...reviewAction, label: REVIEW_TITLE };

  const personalAction = getPersonalAction(input);
  const message = personalAction === null ? getSheriffWaitingMessage(input.election) : null;
  const primary =
    personalAction === null || message !== null
      ? null
      : createCommandButton(
          personalAction,
          input.election,
          isAudioPlaybackLocked(input.isAudioPlaying),
        );
  return {
    message,
    progress: null,
    actions: [leading, primary, trailing].filter(
      (action): action is RoomPlayerAction => action !== null,
    ),
    group: null,
  };
}
