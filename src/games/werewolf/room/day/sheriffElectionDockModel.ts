/**
 * Pure sheriff-election compact-dock projection.
 *
 * Keeps room utilities separate from authoritative election commands and exposes at most one
 * prominent command. Voting opens the detailed ballot surface instead of changing seat taps.
 */

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import {
  AUDIO_PLAYBACK_LOCK_REASON,
  isAudioPlaybackLocked,
} from '@/features/room/model/audioPlaybackLock';
import type {
  RoomBottomActionLayout,
  RoomBottomButton,
  RoomBottomDockModel,
  RoomBottomToolButton,
} from '@/features/room/model/RoomBottomActions';
import { TESTIDS } from '@/testids';

import type { SheriffElectionPanelModel, SheriffElectionPendingAction } from './useSheriffElection';

interface SheriffElectionDockInput {
  readonly election: SheriffElectionPanelModel;
  readonly roomTools: RoomBottomActionLayout;
  /** The host's review lives in host management; the dock's trailing review tool is for everyone else. */
  readonly isHost: boolean;
  readonly isInspectorVisible: boolean;
  readonly isAudioPlaying: boolean;
  readonly openDetails: () => void;
}

interface SheriffDockAction {
  readonly key: string;
  readonly label: string;
  readonly testID: string;
  readonly pendingKind: SheriffElectionPendingAction['kind'] | null;
  readonly variant: 'primary' | 'secondary';
  readonly execute: () => void;
}

function findRoomTool(layout: RoomBottomActionLayout, key: string): RoomBottomButton | null {
  return (
    [...layout.primary, ...layout.secondary, ...layout.ghost].find(
      (button) => button.key === key,
    ) ?? null
  );
}

function createRoomTool(
  button: RoomBottomButton | null,
  label: string,
  tone: RoomBottomToolButton['tone'],
): RoomBottomToolButton | null {
  if (button === null) return null;
  const base = {
    key: button.key,
    label,
    audience: button.audience,
    tone,
    icon: button.icon,
    testID: button.testID,
  } as const;
  if (button.isEnabled) return { ...base, isEnabled: true, onPress: button.onPress };
  return {
    ...base,
    isEnabled: false,
    disabledReason: button.disabledReason,
  };
}

function createCommandButton(
  action: SheriffDockAction,
  model: SheriffElectionPanelModel,
  isAudioLocked: boolean,
): RoomBottomButton {
  const isLoading = model.pendingAction?.kind === action.pendingKind;
  const base = {
    key: action.key,
    label: action.label,
    // Election commands are the viewer's own seat actions.
    audience: 'participant' as const,
    variant: action.variant,
    size: 'md' as const,
    testID: action.testID,
    isLoading,
  };
  if (model.pendingAction !== null) {
    return {
      ...base,
      isEnabled: false,
      disabledReason: null,
    };
  }
  // The election has no read-only exemption from the audio playback
  // lock: while narration plays the command renders disabled with the
  // one lock reason and its press drops with the enabled branch — the
  // host-management combinator's form, applied to the dock primary
  // (the bottom-layout collapse cannot reach this button: the dock
  // replaces the bottom area wholesale during the election).
  if (isAudioLocked) {
    return { ...base, isEnabled: false, disabledReason: AUDIO_PLAYBACK_LOCK_REASON };
  }
  return { ...base, isEnabled: true, onPress: action.execute };
}

export function getSheriffVoteButtonLabel(model: SheriffElectionPanelModel): string {
  const ballot = model.view.myBallot;
  if (ballot === null || ballot.kind === 'notSubmitted') return '选择投票';
  if (ballot.kind === 'abstained') return '修改弃票';
  return `改投${formatSeat(ballot.seat)}`;
}

function getPersonalAction(input: SheriffElectionDockInput): SheriffDockAction | null {
  const { election } = input;
  if (election.view.canRegister) {
    return {
      key: 'sheriff-register',
      label: '报名上警',
      testID: TESTIDS.sheriffRegisterButton,
      pendingKind: 'register',
      variant: 'primary',
      execute: () => void election.register(),
    };
  }
  if (election.view.canCancelRegistration) {
    return {
      key: 'sheriff-cancel-registration',
      label: '取消报名',
      testID: TESTIDS.sheriffCancelRegistrationButton,
      pendingKind: 'cancelRegistration',
      variant: 'secondary',
      execute: () => void election.cancelRegistration(),
    };
  }
  if (election.view.canWithdraw) {
    return {
      key: 'sheriff-withdraw',
      label: '退水',
      testID: TESTIDS.sheriffWithdrawButton,
      pendingKind: 'withdraw',
      variant: 'secondary',
      execute: () => void election.withdraw(),
    };
  }
  if (election.view.canVote) {
    return {
      key: 'sheriff-open-vote',
      label: input.isInspectorVisible
        ? '请在「警长竞选」中投票'
        : getSheriffVoteButtonLabel(election),
      testID: TESTIDS.sheriffOpenVoteButton,
      pendingKind: null,
      variant: 'primary',
      execute: input.openDetails,
    };
  }
  return null;
}

function getSheriffWaitingMessage(model: SheriffElectionPanelModel): string {
  switch (model.view.phase) {
    case 'registration':
      return '报名进行中';
    case 'candidateSpeech':
    case 'runoffSpeech':
      return '按顺序发言中';
    case 'withdrawal':
      return '等待确认候选';
    case 'firstVote':
    case 'runoffVote':
      return '等待投票完成';
    case 'completed':
      return '竞选已结束';
  }
}

/** Build the compact Day dock from the election projection and ordinary room tools. */
export function createSheriffElectionDockModel(
  input: SheriffElectionDockInput,
): RoomBottomDockModel {
  const leading = createRoomTool(findRoomTool(input.roomTools, 'viewRole'), '查看身份', 'default');
  // The host reaches the review from host management (its block takes
  // the dock's tool slot); the trailing tool is the non-host entry.
  const trailing = input.isHost
    ? null
    : createRoomTool(findRoomTool(input.roomTools, 'nightReview'), '本局复盘', 'default');

  const personalAction = getPersonalAction(input);
  const message =
    personalAction === null
      ? getSheriffWaitingMessage(input.election)
      : input.isInspectorVisible && personalAction.key === 'sheriff-open-vote'
        ? personalAction.label
        : null;
  const primary =
    personalAction === null || message !== null
      ? null
      : createCommandButton(
          personalAction,
          input.election,
          isAudioPlaybackLocked(input.isAudioPlaying),
        );
  return { kind: 'dock', message, progress: null, leading, primary, trailing };
}
