/**
 * Pure sheriff-election compact-dock projection.
 *
 * Keeps room utilities separate from authoritative election commands and exposes at most one
 * prominent command. Voting opens the detailed ballot surface instead of changing seat taps.
 */

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import type {
  RoomBottomActionLayout,
  RoomBottomButton,
  RoomBottomDockModel,
  RoomBottomToolButton,
} from '@/features/room/model/RoomBottomActions';
import type {
  SheriffElectionPanelModel,
  SheriffElectionPendingAction,
} from '@/games/werewolf/room/hooks/useSheriffElection';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

interface SheriffElectionDockInput {
  readonly election: SheriffElectionPanelModel;
  readonly roomTools: RoomBottomActionLayout;
  readonly isInspectorVisible: boolean;
  readonly openDetails: () => void;
}

interface SheriffDockAction {
  readonly key: string;
  readonly label: string;
  readonly testID: string;
  readonly pendingKind: SheriffElectionPendingAction['kind'] | null;
  readonly tone: 'default' | 'danger';
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
  const base = { key: button.key, label, tone, testID: button.testID } as const;
  if (button.isEnabled) return { ...base, isEnabled: true, onPress: button.onPress };
  return {
    ...base,
    isEnabled: false,
    disabledReason: button.disabledReason,
    onDisabledPress: button.onDisabledPress,
  };
}

function createCommandButton(
  action: SheriffDockAction,
  model: SheriffElectionPanelModel,
): RoomBottomButton {
  const isLoading = model.pendingAction?.kind === action.pendingKind;
  const base = {
    key: action.key,
    label: action.label,
    variant: 'primary' as const,
    size: 'lg' as const,
    testID: action.testID,
    buttonColor: action.tone === 'danger' ? colors.error : undefined,
    isLoading,
  };
  if (!model.isInteractionDisabled && model.pendingAction === null) {
    return { ...base, isEnabled: true, onPress: action.execute };
  }
  return {
    ...base,
    isEnabled: false,
    disabledReason: null,
    onDisabledPress: null,
  };
}

function createInspectorVotePrompt(action: SheriffDockAction): RoomBottomButton {
  return {
    key: action.key,
    label: action.label,
    variant: 'primary',
    size: 'lg',
    testID: action.testID,
    isEnabled: false,
    disabledReason: null,
    onDisabledPress: null,
  };
}

function getVoteLabel(model: SheriffElectionPanelModel): string {
  const ballot = model.view.myBallot;
  if (ballot === null || ballot.kind === 'notSubmitted') return '选择投票';
  if (ballot.kind === 'abstained') return '修改弃票';
  return `修改投给${formatSeat(ballot.seat)}`;
}

function getPersonalAction(input: SheriffElectionDockInput): SheriffDockAction | null {
  const { election } = input;
  if (election.view.canRegister) {
    return {
      key: 'sheriff-register',
      label: '报名上警',
      testID: TESTIDS.sheriffRegisterButton,
      pendingKind: 'register',
      tone: 'default',
      execute: () => void election.register(),
    };
  }
  if (election.view.canCancelRegistration) {
    return {
      key: 'sheriff-cancel-registration',
      label: '取消报名',
      testID: TESTIDS.sheriffCancelRegistrationButton,
      pendingKind: 'cancelRegistration',
      tone: 'default',
      execute: () => void election.cancelRegistration(),
    };
  }
  if (election.view.canWithdraw) {
    return {
      key: 'sheriff-withdraw',
      label: '退水',
      testID: TESTIDS.sheriffWithdrawButton,
      pendingKind: 'withdraw',
      tone: 'danger',
      execute: () => void election.withdraw(),
    };
  }
  if (election.view.canVote) {
    return {
      key: 'sheriff-open-vote',
      label: input.isInspectorVisible ? '请在右侧投票' : getVoteLabel(election),
      testID: TESTIDS.sheriffOpenVoteButton,
      pendingKind: null,
      tone: 'default',
      execute: input.openDetails,
    };
  }
  return null;
}

function createWaitingButton(model: SheriffElectionPanelModel): RoomBottomButton {
  let label: string;
  switch (model.view.phase) {
    case 'registration':
      label = '报名进行中';
      break;
    case 'candidateSpeech':
    case 'runoffSpeech':
      label = '按顺序发言中';
      break;
    case 'withdrawal':
      label = '等待确认候选';
      break;
    case 'firstVote':
    case 'runoffVote':
      label = '等待投票完成';
      break;
    case 'completed':
      label = '竞选已结束';
      break;
  }
  return {
    key: 'sheriff-waiting',
    label,
    variant: 'primary',
    size: 'lg',
    isEnabled: false,
    disabledReason: null,
    onDisabledPress: null,
  };
}

/** Build the compact Day dock from the election projection and ordinary room tools. */
export function createSheriffElectionDockModel(
  input: SheriffElectionDockInput,
): RoomBottomDockModel {
  const leading = createRoomTool(findRoomTool(input.roomTools, 'viewRole'), '查看身份', 'default');
  const trailing = createRoomTool(
    findRoomTool(input.roomTools, 'nightReview'),
    '本局复盘',
    'default',
  );

  if (input.election.isInteractionDisabled) {
    return {
      kind: 'dock',
      message: null,
      leading,
      primary: {
        key: 'sheriff-audio-waiting',
        label: '语音播报中…',
        variant: 'primary',
        size: 'lg',
        testID: TESTIDS.audioWaitingButton,
        isEnabled: false,
        disabledReason: null,
        onDisabledPress: null,
      },
      trailing,
    };
  }

  const personalAction = getPersonalAction(input);
  const primary =
    personalAction === null
      ? createWaitingButton(input.election)
      : input.isInspectorVisible && personalAction.key === 'sheriff-open-vote'
        ? createInspectorVotePrompt(personalAction)
        : createCommandButton(personalAction, input.election);
  return { kind: 'dock', message: null, leading, primary, trailing };
}
