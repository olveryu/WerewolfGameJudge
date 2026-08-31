/** Presentational tests for the sheriff-election room panel. */

import { fireEvent, render } from '@testing-library/react-native';

import { SheriffElectionPanel } from '@/games/werewolf/room/components/SheriffElectionPanel';
import { createSheriffElectionPanelStyles } from '@/games/werewolf/room/components/sheriffElectionPanel.styles';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

const BASE_VIEW: SheriffElectionViewModel = {
  phase: 'registration',
  phaseTitle: '报名上警',
  phaseDescription: '玩家可报名，房主结束报名后随机确定发言顺序',
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

function createModel(
  viewOverrides: Partial<SheriffElectionViewModel> = {},
  isInteractionDisabled = false,
): SheriffElectionPanelModel {
  return {
    view: { ...BASE_VIEW, ...viewOverrides },
    pendingAction: null,
    isInteractionDisabled,
    register: jest.fn(async () => undefined),
    cancelRegistration: jest.fn(async () => undefined),
    withdraw: jest.fn(async () => undefined),
    vote: jest.fn(async () => undefined),
    advance: jest.fn(async () => undefined),
  };
}

const styles = createSheriffElectionPanelStyles(colors);

describe('SheriffElectionPanel', () => {
  it('renders open-vote progress and reports candidate or abstain intent', () => {
    const model = createModel({
      phase: 'firstVote',
      phaseTitle: '首轮投票',
      candidateRecords: {
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        activeCandidateSeats: [0, 1],
      },
      voteProgress: { submittedCount: 1, eligibleCount: 2 },
      myBallot: { kind: 'candidate', seat: 1 },
      canVote: true,
      candidateOptions: [
        { seat: 0, isSelected: false },
        { seat: 1, isSelected: true },
      ],
    });
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

    expect(screen.getByTestId(TESTIDS.sheriffVoteProgress)).toHaveTextContent('1/2 已提交');
    expect(screen.getByText('已投给 2号，可重新选择')).toBeTruthy();
    expect(screen.getByTestId(TESTIDS.sheriffCandidateButton(1)).props.accessibilityState).toEqual({
      disabled: false,
      checked: true,
      busy: false,
    });
    expect(screen.queryByText(/Alice|Bob/)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffActiveCandidateSeats)).toBeNull();

    fireEvent.press(screen.getByTestId(TESTIDS.sheriffCandidateButton(1)));
    fireEvent.press(screen.getByTestId(TESTIDS.sheriffAbstainButton));

    expect(model.vote).toHaveBeenNthCalledWith(1, 1);
    expect(model.vote).toHaveBeenNthCalledWith(2, null);
  });

  it('keeps command actions out of the details surface', () => {
    const model = createModel({
      canRegister: true,
      canAdvance: true,
      advanceLabel: '结束报名',
    });
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

    expect(screen.queryByTestId(TESTIDS.sheriffRegisterButton)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffAdvanceButton)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffRegisteredSeats)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffWithdrawnSeats)).toBeNull();
  });

  it('does not duplicate cancellation or withdrawal commands in details', () => {
    const registrationModel = createModel({ canCancelRegistration: true });
    const registrationScreen = render(
      <SheriffElectionPanel model={registrationModel} styles={styles} />,
    );

    expect(registrationScreen.queryByTestId(TESTIDS.sheriffCancelRegistrationButton)).toBeNull();
    expect(registrationScreen.queryByTestId(TESTIDS.sheriffWithdrawButton)).toBeNull();
    registrationScreen.unmount();

    const speechModel = createModel({
      phase: 'candidateSpeech',
      canWithdraw: true,
    });
    const speechScreen = render(<SheriffElectionPanel model={speechModel} styles={styles} />);

    expect(speechScreen.queryByTestId(TESTIDS.sheriffWithdrawButton)).toBeNull();
    expect(speechScreen.queryByTestId(TESTIDS.sheriffCancelRegistrationButton)).toBeNull();
  });

  it('renders the authoritative candidate speech order using seat numbers only', () => {
    const model = createModel({
      phase: 'candidateSpeech',
      phaseTitle: '竞选发言',
      phaseDescription: '候选人按随机桌面顺序发言，发言期间仍可退水',
      candidateRecords: {
        registeredSeats: [2, 0, 1],
        withdrawnSeats: [],
        activeCandidateSeats: [2, 0, 1],
      },
      speakingOrder: [0, 1, 2],
    });
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

    expect(screen.getByTestId(TESTIDS.sheriffSpeakingOrder)).toHaveTextContent('1号 · 2号 · 3号');
    expect(screen.queryByText(/当前发言/)).toBeNull();
    expect(screen.queryByText(/Alice|Bob|Chen|Dana/)).toBeNull();
  });

  it('disables every visible action while authoritative audio is playing', () => {
    const model = createModel(
      {
        phase: 'firstVote',
        canVote: true,
        canAdvance: true,
        advanceLabel: '公布首轮结果',
        voteProgress: { submittedCount: 0, eligibleCount: 1 },
        myBallot: { kind: 'notSubmitted' },
        candidateOptions: [{ seat: 0, isSelected: false }],
      },
      true,
    );
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

    const candidateButton = screen.getByTestId(TESTIDS.sheriffCandidateButton(0));
    const abstainButton = screen.getByTestId(TESTIDS.sheriffAbstainButton);
    expect(candidateButton.props.accessibilityState).toMatchObject({
      disabled: true,
      checked: false,
      busy: false,
    });
    expect(abstainButton.props.accessibilityState).toMatchObject({
      disabled: true,
      checked: false,
      busy: false,
    });
    fireEvent.press(candidateButton);
    fireEvent.press(abstainButton);
    expect(model.vote).not.toHaveBeenCalled();
  });

  it('keeps closed ballots and the final result visible after completion', () => {
    const model = createModel({
      phase: 'completed',
      phaseTitle: '竞选结束',
      candidateRecords: {
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        activeCandidateSeats: [0, 1],
      },
      completedRounds: [
        {
          key: 'first',
          title: '首轮投票结果',
          candidateSeats: [0, 1],
          eligibleVoterSeats: [2, 3],
          voteCounts: { 0: 1, 1: 0 },
          ballots: { 2: 0, 3: null },
        },
      ],
      finalResult: { kind: 'elected', sheriffSeat: 0 },
    });
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

    expect(screen.getByTestId(TESTIDS.sheriffRegisteredSeats)).toHaveTextContent('1号 · 2号');
    expect(screen.getByTestId(TESTIDS.sheriffCompletedRound('first'))).toHaveTextContent(/3号→1号/);
    expect(screen.getByTestId(TESTIDS.sheriffElectionResult)).toHaveTextContent('1号 当选警长');
    expect(screen.queryByText(/Alice|Bob|Chen|Dana/)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffAdvanceButton)).toBeNull();
  });
});
