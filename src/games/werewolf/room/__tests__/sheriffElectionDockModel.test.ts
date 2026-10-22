import { AUDIO_PLAYBACK_LOCK_REASON } from '@/features/room/model/audioPlaybackLock';
import type { RoomBottomActionLayout } from '@/features/room/model/RoomBottomActions';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import { createSheriffElectionDockModel } from '@/games/werewolf/room/sheriffElectionDockModel';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

const BASE_VIEW: SheriffElectionViewModel = {
  phase: 'registration',
  phaseTitle: '报名上警',
  phaseDescription: '玩家可报名',
  candidateRecords: null,
  speakingInstruction: null,
  voteProgress: null,
  myBallot: null,
  candidateOptions: [],
  completedRounds: [],
  finalResult: null,
  canRegister: false,
  canCancelRegistration: false,
  canWithdraw: false,
  canVote: false,
  canAdvance: false,
  advanceLabel: null,
};

function createElection(
  view: Partial<SheriffElectionViewModel>,
  overrides: Partial<SheriffElectionPanelModel> = {},
): SheriffElectionPanelModel {
  return {
    view: { ...BASE_VIEW, ...view },
    pendingAction: null,
    register: jest.fn(async () => undefined),
    cancelRegistration: jest.fn(async () => undefined),
    withdraw: jest.fn(async () => undefined),
    vote: jest.fn(async () => undefined),
    advance: jest.fn(async () => undefined),
    requestAdvance: jest.fn(),
    requestEndBySelfDestruct: jest.fn(),
    ...overrides,
  };
}

const ROOM_TOOLS: RoomBottomActionLayout = {
  primary: [
    {
      key: 'viewRole',
      label: '查看身份',
      variant: 'primary',
      size: 'lg',
      isEnabled: true,
      onPress: jest.fn(),
    },
  ],
  secondary: [],
  ghost: [
    {
      key: 'restart',
      label: '重新开始',
      variant: 'ghost',
      size: 'md',
      isEnabled: true,
      onPress: jest.fn(),
    },
  ],
};

describe('createSheriffElectionDockModel', () => {
  it('projects the identity action as a text-only tool', () => {
    const identityAction = ROOM_TOOLS.primary[0];
    if (identityAction === undefined || !identityAction.isEnabled) {
      throw new Error('Expected executable source identity action');
    }
    const dock = createSheriffElectionDockModel({
      election: createElection({ canRegister: true }),
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: false,
      openDetails: jest.fn(),
    });

    expect(dock.leading).toMatchObject({
      key: 'viewRole',
      label: '查看身份',
      tone: 'default',
      isEnabled: true,
    });
    expect(dock.leading).not.toHaveProperty('icon');
    if (dock.leading === null || !dock.leading.isEnabled) {
      throw new Error('Expected executable identity action');
    }
    dock.leading.onPress();
    expect(identityAction.onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps the Host personal action primary without projecting the advance command', () => {
    const election = createElection({
      canRegister: true,
      canAdvance: true,
      advanceLabel: '结束报名',
    });
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: false,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({
      key: 'sheriff-register',
      label: '报名上警',
      variant: 'primary',
    });
    expect(dock.trailing).toBeNull();
    if (!dock.primary.isEnabled) throw new Error('Expected executable personal sheriff action');
    dock.primary.onPress();
    expect(election.register).toHaveBeenCalledTimes(1);
    expect(election.advance).not.toHaveBeenCalled();
  });

  it('keeps a waiting player command when only Host advancement is available', () => {
    const election = createElection({
      phase: 'candidateSpeech',
      canAdvance: true,
      advanceLabel: '结束发言',
    });
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: false,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({
      key: 'sheriff-waiting',
      label: '按顺序发言中',
      variant: 'primary',
      isEnabled: false,
    });
    expect(dock.trailing).toBeNull();
  });

  it('keeps the Host cancellation action primary after registration', () => {
    const election = createElection({
      canCancelRegistration: true,
      canAdvance: true,
      advanceLabel: '结束报名',
    });
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: false,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({
      key: 'sheriff-cancel-registration',
      label: '取消报名',
      variant: 'primary',
    });
    expect(dock.trailing).toBeNull();
  });

  it('does not mix Host advancement progress into the personal dock', () => {
    const election = createElection(
      {
        canAdvance: true,
        advanceLabel: '结束报名',
      },
      { pendingAction: { kind: 'advance' } },
    );
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: false,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({ key: 'sheriff-waiting', isEnabled: false });
  });

  it('uses the personal action as the player primary command', () => {
    const election = createElection({ canCancelRegistration: true });
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: false,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({
      key: 'sheriff-cancel-registration',
      label: '取消报名',
    });
  });

  it('marks a player withdrawal as the destructive primary command', () => {
    const election = createElection({ canWithdraw: true });
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: false,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({
      key: 'sheriff-withdraw',
      label: '退水',
      variant: 'primary',
      buttonColor: colors.error,
    });
  });

  it('opens the compact details surface for voting without changing seat actions', () => {
    const openDetails = jest.fn();
    const election = createElection({
      phase: 'firstVote',
      canVote: true,
      myBallot: { kind: 'notSubmitted' },
      voteProgress: { submittedCount: 0, eligibleCount: 2 },
    });
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: false,
      openDetails,
    });

    expect(dock.primary).toMatchObject({ key: 'sheriff-open-vote', label: '选择投票' });
    if (!dock.primary.isEnabled) throw new Error('Expected an enabled ballot details action');
    dock.primary.onPress();
    expect(openDetails).toHaveBeenCalledTimes(1);
    expect(election.vote).not.toHaveBeenCalled();
  });

  it('retains an authorized player night-review action while voting', () => {
    const openNightReview = jest.fn();
    const dock = createSheriffElectionDockModel({
      election: createElection({
        phase: 'firstVote',
        canVote: true,
        myBallot: { kind: 'notSubmitted' },
        voteProgress: { submittedCount: 0, eligibleCount: 2 },
      }),
      roomTools: {
        ...ROOM_TOOLS,
        secondary: [
          {
            key: 'nightReview',
            label: '本局复盘',
            variant: 'secondary',
            size: 'md',
            testID: TESTIDS.nightReviewBottomButton,
            isEnabled: true,
            onPress: openNightReview,
          },
        ],
      },
      isInspectorVisible: false,
      isAudioPlaying: false,
      openDetails: jest.fn(),
    });

    expect(dock.trailing).toMatchObject({
      key: 'nightReview',
      label: '本局复盘',
      tone: 'default',
      isEnabled: true,
    });
    if (dock.trailing === null || !dock.trailing.isEnabled) {
      throw new Error('Expected executable night-review action');
    }
    dock.trailing.onPress();
    expect(openNightReview).toHaveBeenCalledTimes(1);
  });

  it('directs wide-layout voting to the persistent inspector', () => {
    const election = createElection({
      phase: 'firstVote',
      canVote: true,
      myBallot: { kind: 'notSubmitted' },
      voteProgress: { submittedCount: 0, eligibleCount: 2 },
    });
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: true,
      isAudioPlaying: false,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({ label: '请在「警长竞选」中投票', isEnabled: false });
  });

  it('locks the registration command while narration audio plays', () => {
    const election = createElection({ canRegister: true });
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: true,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({
      key: 'sheriff-register',
      label: '报名上警',
      isEnabled: false,
      disabledReason: AUDIO_PLAYBACK_LOCK_REASON,
    });
    expect(dock.primary).not.toHaveProperty('onPress');
    expect(election.register).not.toHaveBeenCalled();
  });

  it('locks the cancellation and withdrawal commands while narration audio plays', () => {
    const cancelDock = createSheriffElectionDockModel({
      election: createElection({ canCancelRegistration: true }),
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: true,
      openDetails: jest.fn(),
    });
    expect(cancelDock.primary).toMatchObject({
      key: 'sheriff-cancel-registration',
      isEnabled: false,
      disabledReason: AUDIO_PLAYBACK_LOCK_REASON,
    });
    expect(cancelDock.primary).not.toHaveProperty('onPress');

    const withdrawDock = createSheriffElectionDockModel({
      election: createElection({ canWithdraw: true }),
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: true,
      openDetails: jest.fn(),
    });
    expect(withdrawDock.primary).toMatchObject({
      key: 'sheriff-withdraw',
      isEnabled: false,
      disabledReason: AUDIO_PLAYBACK_LOCK_REASON,
      buttonColor: colors.error,
    });
    expect(withdrawDock.primary).not.toHaveProperty('onPress');
  });

  it('locks the vote-details command while narration audio plays', () => {
    const openDetails = jest.fn();
    const dock = createSheriffElectionDockModel({
      election: createElection({
        phase: 'firstVote',
        canVote: true,
        myBallot: { kind: 'notSubmitted' },
        voteProgress: { submittedCount: 0, eligibleCount: 2 },
      }),
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: true,
      openDetails,
    });

    expect(dock.primary).toMatchObject({
      key: 'sheriff-open-vote',
      isEnabled: false,
      disabledReason: AUDIO_PLAYBACK_LOCK_REASON,
    });
    expect(dock.primary).not.toHaveProperty('onPress');
    expect(openDetails).not.toHaveBeenCalled();
  });

  it('keeps the pending disabled form when a command is already in flight during audio', () => {
    const election = createElection({ canRegister: true }, { pendingAction: { kind: 'register' } });
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      isAudioPlaying: true,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({
      key: 'sheriff-register',
      isEnabled: false,
      disabledReason: null,
      isLoading: true,
    });
    expect(dock.primary).not.toHaveProperty('onPress');
  });

  it('keeps the read-only identity tool available while the command is audio-locked', () => {
    const onViewRole = jest.fn();
    const dock = createSheriffElectionDockModel({
      election: createElection({ canRegister: true }),
      roomTools: {
        ...ROOM_TOOLS,
        primary: [
          {
            key: 'viewRole',
            label: '查看身份',
            variant: 'primary',
            size: 'lg',
            isEnabled: true,
            onPress: onViewRole,
          },
        ],
      },
      isInspectorVisible: false,
      isAudioPlaying: true,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({ isEnabled: false });
    expect(dock.leading).toMatchObject({ key: 'viewRole', isEnabled: true });
    if (dock.leading === null || !dock.leading.isEnabled) {
      throw new Error('Expected executable identity action');
    }
    dock.leading.onPress();
    expect(onViewRole).toHaveBeenCalledTimes(1);
  });
});
