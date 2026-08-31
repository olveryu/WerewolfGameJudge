import type { RoomBottomActionLayout } from '@/features/room/model/RoomBottomActions';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import { createSheriffElectionDockModel } from '@/games/werewolf/room/sheriffElectionDockModel';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import { colors } from '@/theme';

const BASE_VIEW: SheriffElectionViewModel = {
  phase: 'registration',
  phaseTitle: '报名上警',
  phaseDescription: '玩家可报名',
  candidateRecords: null,
  speakingOrder: [],
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
    isInteractionDisabled: false,
    register: jest.fn(async () => undefined),
    cancelRegistration: jest.fn(async () => undefined),
    withdraw: jest.fn(async () => undefined),
    vote: jest.fn(async () => undefined),
    advance: jest.fn(async () => undefined),
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
      openDetails,
    });

    expect(dock.primary).toMatchObject({ key: 'sheriff-open-vote', label: '选择投票' });
    if (!dock.primary.isEnabled) throw new Error('Expected an enabled ballot details action');
    dock.primary.onPress();
    expect(openDetails).toHaveBeenCalledTimes(1);
    expect(election.vote).not.toHaveBeenCalled();
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
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({ label: '请在右侧投票', isEnabled: false });
  });

  it('shows the audio state while retaining ordinary room tools', () => {
    const election = createElection({ canRegister: true }, { isInteractionDisabled: true });
    const dock = createSheriffElectionDockModel({
      election,
      roomTools: ROOM_TOOLS,
      isInspectorVisible: false,
      openDetails: jest.fn(),
    });

    expect(dock.primary).toMatchObject({ label: '语音播报中…', isEnabled: false });
    expect(dock.leading).toMatchObject({ label: '查看身份', isEnabled: true });
    expect(dock.trailing).toBeNull();
  });
});
