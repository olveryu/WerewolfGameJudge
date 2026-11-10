/** Presentational tests for the sheriff-election room panel. */

import { fireEvent, render, screen, within } from '@testing-library/react';

import { SheriffElectionPanel } from '@/games/werewolf/room/components/SheriffElectionPanel';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/day/sheriffElectionViewModel';
import type {
  SheriffElectionPanelModel,
  SheriffElectionPendingAction,
} from '@/games/werewolf/room/day/useSheriffElection';
import { TESTIDS } from '@/testids';

const BASE_VIEW: SheriffElectionViewModel = {
  phase: 'registration',
  phaseTitle: '报名上警',
  phaseDescription: '想竞选警长的玩家可在手机上报名，系统随后将随机确定发言顺序。',
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

function createModel(
  viewOverrides: Partial<SheriffElectionViewModel> = {},
  pendingAction: SheriffElectionPendingAction | null = null,
  remainingSeconds: number | null = null,
): SheriffElectionPanelModel {
  return {
    view: { ...BASE_VIEW, ...viewOverrides },
    remainingSeconds,
    pendingAction,
    register: vi.fn(async () => undefined),
    cancelRegistration: vi.fn(async () => undefined),
    withdraw: vi.fn(async () => undefined),
    vote: vi.fn(async () => undefined),
    advance: vi.fn(async () => undefined),
    requestAdvance: vi.fn(),
    requestEndBySelfDestruct: vi.fn(),
  };
}

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
      voteProgress: { submittedCount: 1, eligibleCount: 2, pendingSeats: [1] },
      myBallot: { kind: 'candidate', seat: 1 },
      canVote: true,
      candidateOptions: [
        { seat: 0, isSelected: false },
        { seat: 1, isSelected: true },
      ],
    });
    render(<SheriffElectionPanel model={model} />);

    expect(screen.getByTestId(TESTIDS.sheriffVoteProgress)).toHaveTextContent('1/2 已提交');
    const pendingRow = screen.getByTestId(TESTIDS.sheriffVoteProgressPendingSeats);
    expect(
      within(pendingRow).getByTestId('sheriff-vote-progress-pending-seats-seat-1'),
    ).toBeInTheDocument();
    expect(
      within(pendingRow).queryByTestId('sheriff-vote-progress-pending-seats-seat-0'),
    ).toBeNull();
    expect(screen.getByText('已投给 2号，可重新选择')).toBeInTheDocument();
    const selected = screen.getByTestId(TESTIDS.sheriffCandidateButton(1));
    expect(selected).toBeEnabled();
    expect(selected).toBeChecked();
    expect(selected).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByText(/Alice|Bob/)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffActiveCandidateSeats)).toBeNull();

    fireEvent.click(screen.getByTestId(TESTIDS.sheriffCandidateButton(1)));
    fireEvent.click(screen.getByTestId(TESTIDS.sheriffAbstainButton));

    expect(model.vote).toHaveBeenNthCalledWith(1, 1);
    expect(model.vote).toHaveBeenNthCalledWith(2, null);
  });

  it('never shows the settle countdown in the vote-progress area, even once every vote is in', () => {
    const model = createModel(
      {
        phase: 'firstVote',
        phaseTitle: '首轮投票',
        candidateRecords: {
          registeredSeats: [0, 1],
          withdrawnSeats: [],
          activeCandidateSeats: [0, 1],
        },
        voteProgress: { submittedCount: 2, eligibleCount: 2, pendingSeats: [] },
        myBallot: { kind: 'candidate', seat: 1 },
        canVote: false,
        candidateOptions: [],
      },
      null,
      5,
    );
    render(<SheriffElectionPanel model={model} />);

    // The countdown lives only in the HUD: the panel keeps the plain
    // progress text even while the model carries live seconds.
    expect(screen.getByTestId(TESTIDS.sheriffVoteProgress)).toHaveTextContent(/^2\/2 已提交$/);
    expect(screen.queryByText(/秒后自动公布结果|即将自动公布结果/)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffVoteProgressPendingSeats)).toBeNull();
  });

  it('keeps the plain progress text in the panel once the deadline is reached', () => {
    const model = createModel(
      {
        phase: 'firstVote',
        phaseTitle: '首轮投票',
        candidateRecords: {
          registeredSeats: [0, 1],
          withdrawnSeats: [],
          activeCandidateSeats: [0, 1],
        },
        voteProgress: { submittedCount: 2, eligibleCount: 2, pendingSeats: [] },
        myBallot: { kind: 'candidate', seat: 1 },
        canVote: false,
        candidateOptions: [],
      },
      null,
      0,
    );
    render(<SheriffElectionPanel model={model} />);

    expect(screen.getByTestId(TESTIDS.sheriffVoteProgress)).toHaveTextContent(/^2\/2 已提交$/);
    expect(screen.queryByText(/秒后自动公布结果|即将自动公布结果/)).toBeNull();
  });

  it('shows the host registration instruction to the host (D12)', () => {
    // The projection carries the caller's phase description: the view
    // model gives the host its instruction during registration, while
    // the review always gets the generic line. The panel must render
    // the host variant, not the generic description.
    const model = createModel({
      phase: 'registration',
      phaseTitle: '报名上警',
      phaseDescription: '报名截止后，请在「主持管理」中结束报名。',
      canAdvance: true,
      advanceLabel: '结束报名',
    });
    render(<SheriffElectionPanel model={model} />);

    expect(screen.getByText('报名截止后，请在「主持管理」中结束报名。')).toBeInTheDocument();
    expect(
      screen.queryByText('想竞选警长的玩家可在手机上报名，系统随后将随机确定发言顺序。'),
    ).toBeNull();
  });

  it('keeps command actions out of the details surface', () => {
    const model = createModel({
      canRegister: true,
      canAdvance: true,
      advanceLabel: '结束报名',
    });
    render(<SheriffElectionPanel model={model} />);

    expect(screen.queryByTestId(TESTIDS.sheriffRegisterButton)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffAdvanceButton)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffRegisteredSeats)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffWithdrawnSeats)).toBeNull();
  });

  it('does not duplicate cancellation or withdrawal commands in details', () => {
    const registrationModel = createModel({ canCancelRegistration: true });
    const registrationView = render(<SheriffElectionPanel model={registrationModel} />);

    expect(screen.queryByTestId(TESTIDS.sheriffCancelRegistrationButton)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffWithdrawButton)).toBeNull();
    registrationView.unmount();

    const speechModel = createModel({
      phase: 'candidateSpeech',
      canWithdraw: true,
    });
    render(<SheriffElectionPanel model={speechModel} />);

    expect(screen.queryByTestId(TESTIDS.sheriffWithdrawButton)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffCancelRegistrationButton)).toBeNull();
  });

  it('renders the authoritative candidate speech order using seat numbers only', () => {
    const model = createModel({
      phase: 'candidateSpeech',
      phaseTitle: '竞选发言',
      phaseDescription: '候选人依次发言，发言期间可退水',
      candidateRecords: {
        registeredSeats: [2, 0, 1],
        withdrawnSeats: [],
        activeCandidateSeats: [2, 0, 1],
      },
      speakingInstruction: '从 1号开始，顺时针发言',
    });
    render(<SheriffElectionPanel model={model} />);

    expect(screen.getByTestId(TESTIDS.sheriffSpeakingInstruction)).toHaveTextContent(
      '从 1号开始，顺时针发言',
    );
    expect(screen.queryByText(/当前发言/)).toBeNull();
    expect(screen.queryByText(/Alice|Bob|Chen|Dana/)).toBeNull();
  });

  it('renders registered seats as dots in registration order and strikes withdrawn dots', () => {
    const model = createModel({
      phase: 'candidateSpeech',
      phaseTitle: '竞选发言',
      candidateRecords: {
        registeredSeats: [2, 0, 1],
        withdrawnSeats: [2],
        activeCandidateSeats: [0, 1],
      },
    });
    render(<SheriffElectionPanel model={model} />);

    const dots = screen.getAllByTestId(/^sheriff-registered-seat-\d+$/);
    expect(dots.map((dot) => dot.getAttribute('data-testid'))).toEqual([
      TESTIDS.sheriffRegisteredSeatDot(2),
      TESTIDS.sheriffRegisteredSeatDot(0),
      TESTIDS.sheriffRegisteredSeatDot(1),
    ]);

    const withdrawnDot = screen.getByTestId(TESTIDS.sheriffRegisteredSeatDot(2));
    expect(withdrawnDot).toHaveAccessibleName('3号，已退水');
    expect(withdrawnDot).toHaveAttribute('data-withdrawn', 'true');
    expect(screen.getByTestId(TESTIDS.sheriffRegisteredSeatDot(0))).toHaveAttribute(
      'data-withdrawn',
      'false',
    );
    expect(screen.getByTestId(TESTIDS.sheriffWithdrawnSeats)).toHaveTextContent('3号已退水');

    const activeRow = screen.getByTestId(TESTIDS.sheriffActiveCandidateSeats);
    expect(
      within(activeRow).getByTestId(TESTIDS.sheriffActiveCandidateSeatDot(0)),
    ).toBeInTheDocument();
    expect(
      within(activeRow).getByTestId(TESTIDS.sheriffActiveCandidateSeatDot(1)),
    ).toBeInTheDocument();
    expect(within(activeRow).queryByTestId(TESTIDS.sheriffActiveCandidateSeatDot(2))).toBeNull();
  });

  it('disables every visible action while a vote command is pending', () => {
    const model = createModel(
      {
        phase: 'firstVote',
        canVote: true,
        canAdvance: true,
        advanceLabel: '公布首轮结果',
        // An open vote always has public candidate records (the view
        // model only reports null records during registration); the panel
        // renders the projection, which fails fast on the inconsistent
        // combination of an open vote with no records.
        candidateRecords: {
          registeredSeats: [0],
          withdrawnSeats: [],
          activeCandidateSeats: [0],
        },
        voteProgress: { submittedCount: 0, eligibleCount: 1, pendingSeats: [0] },
        myBallot: { kind: 'notSubmitted' },
        candidateOptions: [{ seat: 0, isSelected: false }],
      },
      { kind: 'vote', targetSeat: 0 },
    );
    render(<SheriffElectionPanel model={model} />);

    const candidateButton = screen.getByTestId(TESTIDS.sheriffCandidateButton(0));
    const abstainButton = screen.getByTestId(TESTIDS.sheriffAbstainButton);
    expect(candidateButton).toBeDisabled();
    expect(candidateButton).not.toBeChecked();
    expect(candidateButton).toHaveAttribute('aria-busy', 'true');
    expect(abstainButton).toBeDisabled();
    expect(abstainButton).not.toBeChecked();
    expect(abstainButton).toHaveAttribute('aria-busy', 'false');
    fireEvent.click(candidateButton);
    fireEvent.click(abstainButton);
    expect(model.vote).not.toHaveBeenCalled();
  });

  it('keeps closed ballots grouped by candidate and the result banner visible after completion', () => {
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
          perCandidate: [
            { seat: 0, votes: 1, voterSeats: [2] },
            { seat: 1, votes: 0, voterSeats: [] },
          ],
          abstainingSeats: [3],
        },
      ],
      finalResult: { kind: 'elected', sheriffSeat: 0 },
    });
    render(<SheriffElectionPanel model={model} />);

    expect(screen.getByTestId(TESTIDS.sheriffRegisteredSeatDot(0))).toHaveTextContent('1');
    expect(screen.getByTestId(TESTIDS.sheriffRegisteredSeatDot(1))).toHaveTextContent('2');

    const winnerGroup = screen.getByTestId(TESTIDS.sheriffTallyGroup('first', 0));
    expect(within(winnerGroup).getByText('1 票')).toBeInTheDocument();
    expect(
      within(winnerGroup).getByTestId(TESTIDS.sheriffBallotChip('first', 2)),
    ).toBeInTheDocument();
    expect(within(winnerGroup).queryByTestId(TESTIDS.sheriffBallotChip('first', 3))).toBeNull();

    const loserGroup = screen.getByTestId(TESTIDS.sheriffTallyGroup('first', 1));
    expect(within(loserGroup).getByText('0 票')).toBeInTheDocument();
    expect(within(loserGroup).queryByTestId(TESTIDS.sheriffBallotChip('first', 2))).toBeNull();

    // Winner-only markers: the gold trophy icon and the gold tally-bar fill
    // exist in the winner group only.
    expect(winnerGroup).toHaveAttribute('data-winner', 'true');
    expect(winnerGroup.querySelectorAll('.sheriff-tally-trophy')).toHaveLength(1);
    expect(winnerGroup.querySelectorAll('.sheriff-tally-fill')).toHaveLength(1);
    expect(loserGroup).toHaveAttribute('data-winner', 'false');
    expect(loserGroup.querySelectorAll('.sheriff-tally-trophy')).toHaveLength(0);
    expect(loserGroup.querySelectorAll('.sheriff-tally-fill')).toHaveLength(0);

    const abstainRow = screen.getByTestId(TESTIDS.sheriffAbstainRow('first'));
    expect(
      within(abstainRow).getByTestId(TESTIDS.sheriffAbstainChip('first', 3)),
    ).toBeInTheDocument();
    expect(screen.queryByText(/→/)).toBeNull();

    const banner = screen.getByTestId(TESTIDS.sheriffElectionResult);
    expect(banner).toHaveTextContent(/1号 · 当选警长/);
    expect(banner).toHaveTextContent(/首轮投票当选 · 警徽在 1号/);
    expect(screen.queryByText(/Alice|Bob|Chen|Dana/)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffAdvanceButton)).toBeNull();
  });

  it('marks the winner only in the deciding runoff round', () => {
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
          perCandidate: [
            { seat: 0, votes: 1, voterSeats: [2] },
            { seat: 1, votes: 1, voterSeats: [3] },
          ],
          abstainingSeats: [],
        },
        {
          key: 'runoff',
          title: '平票投票结果',
          perCandidate: [
            { seat: 0, votes: 2, voterSeats: [2, 3] },
            { seat: 1, votes: 0, voterSeats: [] },
          ],
          abstainingSeats: [],
        },
      ],
      finalResult: { kind: 'elected', sheriffSeat: 0 },
    });
    render(<SheriffElectionPanel model={model} />);

    expect(screen.getByTestId(TESTIDS.sheriffTallyGroup('first', 0))).toHaveAttribute(
      'data-winner',
      'false',
    );
    const runoffWinner = screen.getByTestId(TESTIDS.sheriffTallyGroup('runoff', 0));
    expect(runoffWinner).toHaveAttribute('data-winner', 'true');
    expect(within(runoffWinner).getByText('1号')).toBeInTheDocument();
    expect(within(runoffWinner).getByText('2 票')).toBeInTheDocument();
    expect(
      within(screen.getByTestId(TESTIDS.sheriffTallyGroup('runoff', 1))).getByText('0 票'),
    ).toBeInTheDocument();

    expect(screen.getByTestId(TESTIDS.sheriffElectionResult)).toHaveTextContent(
      /平票投票当选 · 警徽在 1号/,
    );
  });

  it('renders a neutral banner and an empty record when nobody ran', () => {
    const model = createModel({
      phase: 'completed',
      phaseTitle: '竞选结束',
      candidateRecords: {
        registeredSeats: [],
        withdrawnSeats: [],
        activeCandidateSeats: [],
      },
      finalResult: { kind: 'noSheriff', reason: 'noCandidates' },
    });
    render(<SheriffElectionPanel model={model} />);

    expect(screen.getByTestId(TESTIDS.sheriffElectionResult)).toHaveTextContent(
      /无人参选，本局没有警长/,
    );
    expect(screen.getByTestId(TESTIDS.sheriffRegisteredSeats)).toHaveTextContent('无');
    expect(screen.queryByTestId(TESTIDS.sheriffWithdrawnSeats)).toBeNull();
  });

  it.each([
    ['noVotes', '无人得票，本局没有警长'],
    ['runoffTie', '平票未决，本局没有警长'],
    ['selfDestruct', '因狼人自爆，警长竞选已结束且没有警长'],
  ] as const)('renders the no-sheriff banner for %s', (reason, expectedText) => {
    const model = createModel({
      phase: 'completed',
      phaseTitle: '竞选结束',
      candidateRecords: {
        registeredSeats: [0],
        withdrawnSeats: [],
        activeCandidateSeats: [0],
      },
      finalResult: { kind: 'noSheriff', reason },
    });
    render(<SheriffElectionPanel model={model} />);

    expect(screen.getByTestId(TESTIDS.sheriffElectionResult)).toHaveTextContent(
      new RegExp(expectedText),
    );
  });
});
