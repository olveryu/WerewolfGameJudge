import { AUDIO_PLAYBACK_LOCK_REASON } from '@/features/room/model/audioPlaybackLock';
import type { RoomPlayerAction } from '@/features/room/model/RoomAction';
import { buildReviewBottomButton } from '@/features/room/review/roomReviewActions';
import { createSheriffElectionPlayerActions } from '@/games/werewolf/room/day/sheriffElectionPlayerActions';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/day/sheriffElectionViewModel';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { TESTIDS } from '@/testids';
import * as alertPresets from '@/utils/alertPresets';

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
    remainingSeconds: null,
    pendingAction: null,
    register: vi.fn(async () => undefined),
    cancelRegistration: vi.fn(async () => undefined),
    withdraw: vi.fn(async () => undefined),
    vote: vi.fn(async () => undefined),
    advance: vi.fn(async () => undefined),
    requestAdvance: vi.fn(),
    requestEndBySelfDestruct: vi.fn(),
    ...overrides,
  };
}

const ROOM_TOOLS: readonly RoomPlayerAction[] = [
  {
    key: 'viewRole',
    label: '查看身份',
    audience: 'participant',
    icon: 'eye-outline',
    category: 'resource',
    state: { kind: 'ready', onPress: vi.fn() },
  },
  {
    key: 'restart',
    label: '重新开始',
    audience: 'participant',
    category: 'player',
    state: { kind: 'ready', onPress: vi.fn() },
  },
];

describe('createSheriffElectionPlayerActions', () => {
  it('projects the identity action as a labelled icon tool', () => {
    const identityAction = ROOM_TOOLS[0];
    if (identityAction?.state.kind !== 'ready') {
      throw new Error('Expected executable source identity action');
    }
    const dock = createSheriffElectionPlayerActions({
      election: createElection({ canRegister: true }),
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });

    const identity = dock.actions.find((action) => action.key === 'viewRole');
    expect(identity).toMatchObject({
      key: 'viewRole',
      label: '查看身份',
      state: { kind: 'ready' },
    });
    expect(identity).toHaveProperty('icon', 'eye-outline');
    if (identity?.state.kind !== 'ready') {
      throw new Error('Expected executable identity action');
    }
    identity.state.onPress();
    expect(identityAction.state.onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps the personal action without projecting the host advance command', async () => {
    const confirm = vi.spyOn(alertPresets, 'showConfirmAlert').mockImplementation(() => {});
    const election = createElection({
      canRegister: true,
      canAdvance: true,
      advanceLabel: '结束报名',
    });
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });

    const personalAction = dock.actions.find((action) => action.key === 'sheriff-register');
    expect(personalAction).toMatchObject({
      key: 'sheriff-register',
      label: '报名上警',
    });
    expect(dock.actions.map((action) => action.key)).toEqual(['viewRole', 'sheriff-register']);
    if (personalAction?.state.kind !== 'ready')
      throw new Error('Expected executable personal sheriff action');
    personalAction.state.onPress();
    expect(election.register).not.toHaveBeenCalled();
    const onConfirm = confirm.mock.calls[0]?.[2];
    if (onConfirm === undefined) throw new Error('Missing registration confirmation');
    await onConfirm();
    expect(election.register).toHaveBeenCalledTimes(1);
    expect(election.advance).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it.each([
    ['canCancelRegistration', 'cancelRegistration'],
    ['canWithdraw', 'withdraw'],
  ] as const)('confirms %s before dispatch', async (availability, action) => {
    const confirm = vi.spyOn(alertPresets, 'showConfirmAlert').mockImplementation(() => {});
    const election = createElection({ [availability]: true });
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });
    const personalAction = dock.actions.find((entry) => entry.key !== 'viewRole');
    if (personalAction?.state.kind !== 'ready') throw new Error('Missing action');
    personalAction.state.onPress();
    expect(election[action]).not.toHaveBeenCalled();
    const onConfirm = confirm.mock.calls[0]?.[2];
    if (onConfirm === undefined) throw new Error('Missing confirmation');
    await onConfirm();
    expect(election[action]).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });

  it('shows a waiting message when only Host advancement is available', () => {
    const election = createElection({
      phase: 'candidateSpeech',
      canAdvance: true,
      advanceLabel: '结束发言',
    });
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });

    expect(dock.actions.map((action) => action.key)).toEqual(['viewRole']);
    expect(dock.message).toBe('按顺序发言中');
  });

  it('keeps the cancellation action after registration', () => {
    const election = createElection({
      canCancelRegistration: true,
      canAdvance: true,
      advanceLabel: '结束报名',
    });
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });

    expect(
      dock.actions.find((action) => action.key === 'sheriff-cancel-registration'),
    ).toMatchObject({
      key: 'sheriff-cancel-registration',
      label: '取消报名',
    });
  });

  it('does not mix Host advancement progress into the personal dock', () => {
    const election = createElection(
      {
        canAdvance: true,
        advanceLabel: '结束报名',
      },
      { pendingAction: { kind: 'advance' } },
    );
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });

    expect(dock.actions.map((action) => action.key)).toEqual(['viewRole']);
    expect(dock.message).toBe('报名进行中');
  });

  it('uses the personal action as the player primary command', () => {
    const election = createElection({ canCancelRegistration: true });
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });

    expect(
      dock.actions.find((action) => action.key === 'sheriff-cancel-registration'),
    ).toMatchObject({
      key: 'sheriff-cancel-registration',
      label: '取消报名',
    });
  });

  it('presents withdrawal as a game action', () => {
    const election = createElection({ canWithdraw: true });
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });

    expect(dock.actions.find((action) => action.key === 'sheriff-withdraw')).toMatchObject({
      key: 'sheriff-withdraw',
      label: '退水',
    });
  });

  it('opens the compact details surface for voting without changing seat actions', () => {
    const openDetails = vi.fn();
    const election = createElection({
      phase: 'firstVote',
      canVote: true,
      myBallot: { kind: 'notSubmitted' },
      voteProgress: { submittedCount: 0, eligibleCount: 2, pendingSeats: [0, 1] },
    });
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: false,
      openDetails,
    });

    const voteAction = dock.actions.find((action) => action.key === 'sheriff-open-vote');
    expect(voteAction).toMatchObject({
      key: 'sheriff-open-vote',
      label: '选择投票',
      isPending: true,
    });
    if (voteAction?.state.kind !== 'ready')
      throw new Error('Expected an enabled ballot details action');
    voteAction.state.onPress();
    expect(openDetails).toHaveBeenCalledTimes(1);
    expect(election.vote).not.toHaveBeenCalled();
  });

  it.each([{ kind: 'abstained' }, { kind: 'candidate', seat: 1 }] as const)(
    'does not mark an already submitted ballot as pending',
    (myBallot) => {
      const dock = createSheriffElectionPlayerActions({
        election: createElection({ phase: 'firstVote', canVote: true, myBallot }),
        roomTools: ROOM_TOOLS,
        isHost: false,
        isAudioPlaying: false,
        openDetails: vi.fn(),
      });
      expect(dock.actions.find((action) => action.key === 'sheriff-open-vote')?.isPending).not.toBe(
        true,
      );
    },
  );

  it('retains an authorized player night-review action while voting', () => {
    const openNightReview = vi.fn();
    const dock = createSheriffElectionPlayerActions({
      election: createElection({
        phase: 'firstVote',
        canVote: true,
        myBallot: { kind: 'notSubmitted' },
        voteProgress: { submittedCount: 0, eligibleCount: 2, pendingSeats: [0, 1] },
      }),
      roomTools: [
        ...ROOM_TOOLS,
        buildReviewBottomButton({ isEnabled: true, onPress: openNightReview }),
      ],
      isHost: false,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });

    const review = dock.actions.find((action) => action.key === 'review');
    expect(review).toMatchObject({
      key: 'review',
      label: '本局复盘',
      state: { kind: 'ready' },
      testID: TESTIDS.roomReviewOpenButton,
    });
    if (review?.state.kind !== 'ready') {
      throw new Error('Expected executable review action');
    }
    review.state.onPress();
    expect(openNightReview).toHaveBeenCalledTimes(1);
  });

  it('carries the disabled review of an ungranted seat, with its reason, into the trailing tool', () => {
    const dock = createSheriffElectionPlayerActions({
      election: createElection({
        phase: 'firstVote',
        canVote: true,
        myBallot: { kind: 'notSubmitted' },
        voteProgress: { submittedCount: 0, eligibleCount: 2, pendingSeats: [0, 1] },
      }),
      roomTools: [
        ...ROOM_TOOLS,
        buildReviewBottomButton({ isEnabled: false, disabledReason: '房主尚未向你开放复盘' }),
      ],
      isHost: false,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });

    expect(dock.actions.find((action) => action.key === 'review')).toEqual({
      key: 'review',
      label: '本局复盘',
      audience: 'anyone',
      icon: 'document-text-outline',
      category: 'resource',
      testID: TESTIDS.roomReviewOpenButton,
      opensDialog: true,
      state: { kind: 'blocked', reason: '房主尚未向你开放复盘' },
    });
  });

  it('leaves the trailing review tool to non-hosts: the host reaches the review from host management', () => {
    const dock = createSheriffElectionPlayerActions({
      election: createElection({
        phase: 'firstVote',
        canVote: true,
        myBallot: { kind: 'notSubmitted' },
        voteProgress: { submittedCount: 0, eligibleCount: 2, pendingSeats: [0, 1] },
      }),
      roomTools: [...ROOM_TOOLS, buildReviewBottomButton({ isEnabled: true, onPress: vi.fn() })],
      isHost: true,
      isAudioPlaying: false,
      openDetails: vi.fn(),
    });

    expect(dock.actions.find((action) => action.key === 'review')).toBeUndefined();
    expect(dock.actions.find((action) => action.key === 'viewRole')).toBeDefined();
  });

  it('opens the ballot from the vote action', () => {
    const election = createElection({
      phase: 'firstVote',
      canVote: true,
      myBallot: { kind: 'notSubmitted' },
      voteProgress: { submittedCount: 0, eligibleCount: 2, pendingSeats: [0, 1] },
    });
    const openDetails = vi.fn();
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: false,
      openDetails,
    });

    const vote = dock.actions.find((action) => action.key === 'sheriff-open-vote');
    expect(vote).toMatchObject({ label: '选择投票', state: { kind: 'ready' } });
    if (vote?.state.kind !== 'ready') throw new Error('Expected ready vote action');
    vote.state.onPress();
    expect(openDetails).toHaveBeenCalledOnce();
  });

  it('locks the registration command while narration audio plays', () => {
    const election = createElection({ canRegister: true });
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: true,
      openDetails: vi.fn(),
    });

    const action = dock.actions.find((entry) => entry.key === 'sheriff-register');
    expect(action).toMatchObject({
      key: 'sheriff-register',
      label: '报名上警',
      state: { kind: 'blocked', reason: AUDIO_PLAYBACK_LOCK_REASON },
    });
    expect(action?.state).not.toHaveProperty('onPress');
    expect(election.register).not.toHaveBeenCalled();
  });

  it('locks the cancellation and withdrawal commands while narration audio plays', () => {
    const cancelDock = createSheriffElectionPlayerActions({
      election: createElection({ canCancelRegistration: true }),
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: true,
      openDetails: vi.fn(),
    });
    const cancel = cancelDock.actions.find(
      (action) => action.key === 'sheriff-cancel-registration',
    );
    expect(cancel).toMatchObject({
      key: 'sheriff-cancel-registration',
      state: { kind: 'blocked', reason: AUDIO_PLAYBACK_LOCK_REASON },
    });
    expect(cancel?.state).not.toHaveProperty('onPress');

    const withdrawDock = createSheriffElectionPlayerActions({
      election: createElection({ canWithdraw: true }),
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: true,
      openDetails: vi.fn(),
    });
    const withdraw = withdrawDock.actions.find((action) => action.key === 'sheriff-withdraw');
    expect(withdraw).toMatchObject({
      key: 'sheriff-withdraw',
      state: { kind: 'blocked', reason: AUDIO_PLAYBACK_LOCK_REASON },
    });
    expect(withdraw?.state).not.toHaveProperty('onPress');
  });

  it('locks the vote-details command while narration audio plays', () => {
    const openDetails = vi.fn();
    const dock = createSheriffElectionPlayerActions({
      election: createElection({
        phase: 'firstVote',
        canVote: true,
        myBallot: { kind: 'notSubmitted' },
        voteProgress: { submittedCount: 0, eligibleCount: 2, pendingSeats: [0, 1] },
      }),
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: true,
      openDetails,
    });

    const vote = dock.actions.find((action) => action.key === 'sheriff-open-vote');
    expect(vote).toMatchObject({
      key: 'sheriff-open-vote',
      state: { kind: 'blocked', reason: AUDIO_PLAYBACK_LOCK_REASON },
    });
    expect(vote?.state).not.toHaveProperty('onPress');
    expect(openDetails).not.toHaveBeenCalled();
  });

  it('keeps the pending disabled form when a command is already in flight during audio', () => {
    const election = createElection({ canRegister: true }, { pendingAction: { kind: 'register' } });
    const dock = createSheriffElectionPlayerActions({
      election,
      roomTools: ROOM_TOOLS,
      isHost: false,
      isAudioPlaying: true,
      openDetails: vi.fn(),
    });

    const action = dock.actions.find((entry) => entry.key === 'sheriff-register');
    expect(action).toMatchObject({
      key: 'sheriff-register',
      state: { kind: 'busy' },
    });
    expect(action?.state).not.toHaveProperty('onPress');
  });

  it('keeps the read-only identity tool available while the command is audio-locked', () => {
    const onViewRole = vi.fn();
    const dock = createSheriffElectionPlayerActions({
      election: createElection({ canRegister: true }),
      roomTools: [
        {
          key: 'viewRole',
          label: '查看身份',
          audience: 'participant',
          category: 'resource',
          state: { kind: 'ready', onPress: onViewRole },
        },
      ],
      isHost: false,
      isAudioPlaying: true,
      openDetails: vi.fn(),
    });

    expect(dock.actions.find((action) => action.key === 'sheriff-register')?.state.kind).toBe(
      'blocked',
    );
    const identity = dock.actions.find((action) => action.key === 'viewRole');
    expect(identity?.state.kind).toBe('ready');
    if (identity?.state.kind !== 'ready') {
      throw new Error('Expected executable identity action');
    }
    identity.state.onPress();
    expect(onViewRole).toHaveBeenCalledTimes(1);
  });
});
