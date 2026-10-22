/** Presentational tests for the sheriff-election room panel. */

import { fireEvent, render, within } from '@testing-library/react-native';
import { type StyleProp, StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { SheriffElectionPanel } from '@/games/werewolf/room/components/SheriffElectionPanel';
import { createSheriffElectionPanelStyles } from '@/games/werewolf/room/components/sheriffElectionPanel.styles';
import type {
  SheriffElectionPanelModel,
  SheriffElectionPendingAction,
} from '@/games/werewolf/room/hooks/useSheriffElection';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

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
): SheriffElectionPanelModel {
  return {
    view: { ...BASE_VIEW, ...viewOverrides },
    pendingAction,
    register: jest.fn(async () => undefined),
    cancelRegistration: jest.fn(async () => undefined),
    withdraw: jest.fn(async () => undefined),
    vote: jest.fn(async () => undefined),
    advance: jest.fn(async () => undefined),
    requestAdvance: jest.fn(),
    requestEndBySelfDestruct: jest.fn(),
  };
}

const styles = createSheriffElectionPanelStyles(colors);

interface FlatColorStyle {
  color?: string;
  backgroundColor?: string;
}

/** StyleSheet.flatten with the color fields typed (rendered props carry untyped styles). */
function flattenStyle(style: unknown): FlatColorStyle | undefined {
  return StyleSheet.flatten<FlatColorStyle>(style as StyleProp<FlatColorStyle>);
}

/** Host instances carry a string type ('View', 'Text'); composites carry the component. */
function isHostView(node: ReactTestInstance): boolean {
  return String(node.type) === 'View';
}

/** A host View whose flattened style paints the given background color. */
function hasGoldFill(node: ReactTestInstance): boolean {
  return isHostView(node) && flattenStyle(node.props.style)?.backgroundColor === colors.warning;
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
      phaseDescription: '候选人依次发言，发言期间可退水',
      candidateRecords: {
        registeredSeats: [2, 0, 1],
        withdrawnSeats: [],
        activeCandidateSeats: [2, 0, 1],
      },
      speakingInstruction: '从 1号开始，顺时针发言',
    });
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

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
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

    const dots = screen.getAllByTestId(/^sheriff-registered-seat-\d+$/);
    expect(dots.map((dot) => String(dot.props.testID))).toEqual([
      TESTIDS.sheriffRegisteredSeatDot(2),
      TESTIDS.sheriffRegisteredSeatDot(0),
      TESTIDS.sheriffRegisteredSeatDot(1),
    ]);

    const withdrawnDot = screen.getByTestId(TESTIDS.sheriffRegisteredSeatDot(2));
    expect(withdrawnDot.props.accessibilityLabel).toBe('3号，已退水');
    expect(JSON.stringify(withdrawnDot.props.style)).toContain('opacity');
    expect(JSON.stringify(within(withdrawnDot).getByText('3').props.style)).toContain(
      'line-through',
    );
    expect(screen.getByTestId(TESTIDS.sheriffWithdrawnSeats)).toHaveTextContent('3号已退水');

    const activeRow = screen.getByTestId(TESTIDS.sheriffActiveCandidateSeats);
    expect(within(activeRow).getByTestId(TESTIDS.sheriffActiveCandidateSeatDot(0))).toBeTruthy();
    expect(within(activeRow).getByTestId(TESTIDS.sheriffActiveCandidateSeatDot(1))).toBeTruthy();
    expect(within(activeRow).queryByTestId(TESTIDS.sheriffActiveCandidateSeatDot(2))).toBeNull();
  });

  it('disables every visible action while a vote command is pending', () => {
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
      { kind: 'vote', targetSeat: 0 },
    );
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

    const candidateButton = screen.getByTestId(TESTIDS.sheriffCandidateButton(0));
    const abstainButton = screen.getByTestId(TESTIDS.sheriffAbstainButton);
    expect(candidateButton.props.accessibilityState).toMatchObject({
      disabled: true,
      checked: false,
      busy: true,
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
          candidateSeats: [0, 1],
          eligibleVoterSeats: [2, 3],
          voteCounts: { 0: 1, 1: 0 },
          ballots: { 2: 0, 3: null },
        },
      ],
      finalResult: { kind: 'elected', sheriffSeat: 0 },
    });
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

    expect(screen.getByTestId(TESTIDS.sheriffRegisteredSeatDot(0))).toHaveTextContent('1');
    expect(screen.getByTestId(TESTIDS.sheriffRegisteredSeatDot(1))).toHaveTextContent('2');

    const winnerGroup = screen.getByTestId(TESTIDS.sheriffTallyGroup('first', 0));
    expect(within(winnerGroup).getByText('1 票')).toBeTruthy();
    expect(within(winnerGroup).getByTestId(TESTIDS.sheriffBallotChip('first', 2))).toBeTruthy();
    expect(within(winnerGroup).queryByTestId(TESTIDS.sheriffBallotChip('first', 3))).toBeNull();

    const loserGroup = screen.getByTestId(TESTIDS.sheriffTallyGroup('first', 1));
    expect(within(loserGroup).getByText('0 票')).toBeTruthy();
    expect(within(loserGroup).queryByTestId(TESTIDS.sheriffBallotChip('first', 2))).toBeNull();

    // Winner-only markers: the gold trophy icon and the gold tally-bar fill
    // exist in the winner group only.
    const trophy = within(winnerGroup).getByTestId('Ionicons-icon-trophy');
    expect(flattenStyle(trophy.props.style)?.color).toBe(colors.warning);
    expect(winnerGroup.findAll(hasGoldFill)).toHaveLength(1);
    expect(within(loserGroup).queryByTestId('Ionicons-icon-trophy')).toBeNull();
    expect(loserGroup.findAll(hasGoldFill)).toHaveLength(0);

    const abstainRow = screen.getByTestId(TESTIDS.sheriffAbstainRow('first'));
    expect(within(abstainRow).getByTestId(TESTIDS.sheriffAbstainChip('first', 3))).toBeTruthy();
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
          candidateSeats: [0, 1],
          eligibleVoterSeats: [2, 3],
          voteCounts: { 0: 1, 1: 1 },
          ballots: { 2: 0, 3: 1 },
        },
        {
          key: 'runoff',
          title: '平票投票结果',
          candidateSeats: [0, 1],
          eligibleVoterSeats: [2, 3],
          voteCounts: { 0: 2, 1: 0 },
          ballots: { 2: 0, 3: 0 },
        },
      ],
      finalResult: { kind: 'elected', sheriffSeat: 0 },
    });
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

    const firstRoundWinner = within(
      screen.getByTestId(TESTIDS.sheriffTallyGroup('first', 0)),
    ).getByText('1号');
    expect(JSON.stringify(firstRoundWinner.props.style)).not.toContain(colors.warning);

    const runoffWinner = within(
      screen.getByTestId(TESTIDS.sheriffTallyGroup('runoff', 0)),
    ).getByText('1号');
    expect(JSON.stringify(runoffWinner.props.style)).toContain(colors.warning);
    expect(
      within(screen.getByTestId(TESTIDS.sheriffTallyGroup('runoff', 0))).getByText('2 票'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId(TESTIDS.sheriffTallyGroup('runoff', 1))).getByText('0 票'),
    ).toBeTruthy();

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
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

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
    const screen = render(<SheriffElectionPanel model={model} styles={styles} />);

    expect(screen.getByTestId(TESTIDS.sheriffElectionResult)).toHaveTextContent(
      new RegExp(expectedText),
    );
  });
});
