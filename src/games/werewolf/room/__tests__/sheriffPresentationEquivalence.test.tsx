/**
 * Presentation-equivalence contract: the panel and the review render the
 * same sheriff election because both derive from the one presentation
 * projection — never because two copies happen to agree.
 *
 * If a later change re-introduces a second decision (a panel-only winner
 * rule, a review-only candidate label, a progress line assembled in two
 * places), the FromView/FromSection row comparison below fails in CI
 * before it can merge. The mutation cases at the end prove the contract
 * is sensitive: moving the winner by one seat or one round makes the
 * two sides disagree.
 */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import {
  deriveSheriffSection,
  GameStatus,
  getWerewolfNightReview,
} from '@game-judge/game-engine/games/werewolf/public';
import { render, within } from '@testing-library/react-native';

import type { ReviewBlock } from '@/features/room/review/types';
import { toWerewolfReviewDocument } from '@/games/werewolf/review/toWerewolfReviewDocument';
import { SheriffElectionPanel } from '@/games/werewolf/room/components/SheriffElectionPanel';
import { createSheriffElectionPanelStyles } from '@/games/werewolf/room/components/sheriffElectionPanel.styles';
import {
  createSheriffElectionPresentationFromSection,
  createSheriffElectionPresentationFromView,
} from '@/games/werewolf/room/day/sheriffElectionPresentation';
import { createSheriffElectionViewModel } from '@/games/werewolf/room/day/sheriffElectionViewModel';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

const FIRST_ROUND: NonNullable<GameState['sheriffElection']>['completedRounds'][number] = {
  round: 'first',
  candidateSeats: [2, 5],
  eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
  ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2, 6: 5 },
  voteCounts: { 2: 4, 5: 2 },
  abstainingSeats: [4],
};

const RUNOFF_ROUND: NonNullable<GameState['sheriffElection']>['completedRounds'][number] = {
  round: 'runoff',
  candidateSeats: [2, 5],
  eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
  ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2, 6: 2 },
  voteCounts: { 2: 5, 5: 1 },
  abstainingSeats: [4],
};

function makeLocalState(
  election: NonNullable<GameState['sheriffElection']>,
  result?: GameState['sheriffElectionResult'],
) {
  const players: GameState['players'] = {};
  const roster: Record<number, { seat: number; userId: string; profile: { displayName: string } }> =
    {};
  for (let seat = 0; seat < 10; seat += 1) {
    players[seat] = { seat, role: 'villager' };
    roster[seat] = { seat, userId: `user-${seat}`, profile: { displayName: `P${seat}` } };
  }
  return buildWerewolfTestState({
    status: GameStatus.Day,
    templateRoles: Array.from({ length: 10 }, () => 'villager' as const),
    players,
    roleViewedSeats: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    roster,
    rules: { isSheriffElectionEnabled: true },
    sheriffElection: election,
    sheriffElectionResult: result,
  });
}

function presentationOf(state: GameState) {
  const view = createSheriffElectionViewModel({
    gameState: state,
    effectiveSeat: 0,
    isHost: false,
  });
  if (view === null) throw new Error('expected a view model');
  const section = deriveSheriffSection(state);
  if (section === undefined) throw new Error('expected a section');
  return {
    fromView: createSheriffElectionPresentationFromView(view),
    fromSection: createSheriffElectionPresentationFromSection(section),
  };
}

const SCENARIOS: {
  readonly name: string;
  readonly election: NonNullable<GameState['sheriffElection']>;
  readonly result?: GameState['sheriffElectionResult'];
}[] = [
  {
    name: 'registration',
    election: {
      phase: 'registration',
      registeredSeats: [1, 2],
      withdrawnSeats: [],
      completedRounds: [],
    },
  },
  {
    name: 'candidate speech with a withdrawal',
    election: {
      phase: 'candidateSpeech',
      registeredSeats: [2, 5, 9],
      withdrawnSeats: [9],
      // No closed round exists yet at this phase in a real election: the
      // engine's section derivation returns closedRounds [] here, and a
      // fixture with a completed first round would be an unreachable
      // state, not a panel/review disagreement.
      completedRounds: [],
      speakingStartSeat: 2,
      speakingDirection: 'clockwise',
    },
  },
  {
    name: 'open first vote',
    election: {
      phase: 'firstVote',
      registeredSeats: [2, 5],
      withdrawnSeats: [],
      completedRounds: [],
      candidateSeats: [2, 5],
      eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
      ballots: { 0: 2, 1: 5 },
    },
  },
  {
    name: 'runoff speech',
    election: {
      phase: 'runoffSpeech',
      registeredSeats: [2, 5, 9],
      withdrawnSeats: [9],
      completedRounds: [FIRST_ROUND],
      candidateSeats: [2, 5],
      speakingStartSeat: 2,
      speakingDirection: 'clockwise',
    },
  },
  {
    name: 'completed election, first-round win',
    election: {
      phase: 'completed',
      registeredSeats: [2, 5],
      withdrawnSeats: [],
      completedRounds: [FIRST_ROUND],
    },
    result: { kind: 'elected', sheriffSeat: 2 },
  },
  {
    name: 'completed election, runoff win',
    election: {
      phase: 'completed',
      registeredSeats: [2, 5],
      withdrawnSeats: [],
      completedRounds: [FIRST_ROUND, RUNOFF_ROUND],
    },
    result: { kind: 'elected', sheriffSeat: 2 },
  },
  {
    name: 'completed election, no sheriff',
    election: {
      phase: 'completed',
      registeredSeats: [2, 5],
      withdrawnSeats: [],
      completedRounds: [FIRST_ROUND],
    },
    result: { kind: 'noSheriff', reason: 'runoffTie' },
  },
];

describe('sheriff presentation equivalence', () => {
  it.each(SCENARIOS)('$name: panel and review derive identical rows', ({ election, result }) => {
    const { fromView, fromSection } = presentationOf(makeLocalState(election, result));
    expect(fromView.rows).toEqual(fromSection.rows);
  });

  it('panel and review agree on the winner, the deciding round, and the tally', () => {
    const state = makeLocalState(
      {
        phase: 'completed',
        registeredSeats: [2, 5],
        withdrawnSeats: [],
        completedRounds: [FIRST_ROUND, RUNOFF_ROUND],
      },
      { kind: 'elected', sheriffSeat: 2 },
    );
    const view = createSheriffElectionViewModel({
      gameState: state,
      effectiveSeat: 0,
      isHost: false,
    });
    if (view === null) throw new Error('expected a view model');
    const model: SheriffElectionPanelModel = {
      view,
      pendingAction: null,
      register: jest.fn(async () => undefined),
      cancelRegistration: jest.fn(async () => undefined),
      withdraw: jest.fn(async () => undefined),
      vote: jest.fn(async () => undefined),
      advance: jest.fn(async () => undefined),
      requestAdvance: jest.fn(),
      requestEndBySelfDestruct: jest.fn(),
    };
    const screen = render(
      <SheriffElectionPanel model={model} styles={createSheriffElectionPanelStyles(colors)} />,
    );
    // Panel: the banner names 3号, the trophy sits in the runoff tally
    // group only, and the first-round group has no trophy.
    expect(screen.getByTestId(TESTIDS.sheriffElectionResult)).toHaveTextContent(/3号 · 当选警长/);
    expect(
      within(screen.getByTestId(TESTIDS.sheriffTallyGroup('runoff', 2))).queryByTestId(
        'Ionicons-icon-trophy',
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId(TESTIDS.sheriffTallyGroup('first', 2))).queryByTestId(
        'Ionicons-icon-trophy',
      ),
    ).toBeNull();

    // Review: the same election, the [当选] tag sits in the runoff step
    // only, and the result step names the same sheriff.
    const document = toWerewolfReviewDocument({
      review: getWerewolfNightReview(state),
      roomCode: '1234',
      gameSequence: state.gameSequence,
    });
    const [page] = document.pages;
    if (page === undefined) throw new Error('expected one page');
    const sheriffIndex = page.blocks.findIndex(
      (block): block is Extract<ReviewBlock, { readonly kind: 'section' }> =>
        block.kind === 'section' && block.title === '警长竞选',
    );
    const timeline = page.blocks[sheriffIndex + 1];
    if (timeline === undefined || timeline.kind !== 'timeline') {
      throw new Error('expected a sheriff timeline block');
    }
    const steps = timeline.steps;
    const resultStep = steps.find((step) => step.title === '当选警长');
    expect(
      resultStep?.lines.flat().map((inline) => (inline.kind === 'seat' ? inline.seat : null)),
    ).toContain(2);
    const taggedSteps = steps.filter((step) =>
      step.lines.flat().some((inline) => inline.kind === 'tag' && inline.text === '当选'),
    );
    expect(taggedSteps.map((step) => step.title)).toEqual(['平票投票结果']);
    expect(resultStep?.tone).toBe('highlight');
  });

  it('mutation: moving the winner by one seat breaks the equivalence', () => {
    const state = makeLocalState(
      {
        phase: 'completed',
        registeredSeats: [2, 5],
        withdrawnSeats: [],
        completedRounds: [FIRST_ROUND],
      },
      { kind: 'elected', sheriffSeat: 2 },
    );
    const { fromView } = presentationOf(state);
    const mutated = makeLocalState(
      {
        phase: 'completed',
        registeredSeats: [2, 5],
        withdrawnSeats: [],
        completedRounds: [FIRST_ROUND],
      },
      { kind: 'elected', sheriffSeat: 5 },
    );
    const { fromSection } = presentationOf(mutated);
    // The two sides must disagree when the underlying election does:
    // the winner moves from 3号 to 6号 in both the result row and the
    // deciding round's tally.
    expect(fromSection.rows).not.toEqual(fromView.rows);
    const mutatedResult = fromSection.rows.find((row) => row.kind === 'result');
    if (mutatedResult === undefined || mutatedResult.kind !== 'result') {
      throw new Error('expected a result row');
    }
    expect(mutatedResult.sheriffSeat).toBe(5);
    expect(mutatedResult.bannerTitle).toBe('6号 · 当选警长');
    const mutatedRound = fromSection.rows.find((row) => row.kind === 'round');
    if (mutatedRound === undefined || mutatedRound.kind !== 'round') {
      throw new Error('expected a round row');
    }
    expect(mutatedRound.candidates.map((candidate) => candidate.isWinner)).toEqual([false, true]);
  });

  it('mutation: swapping the round order moves the winner marker with it', () => {
    const state = makeLocalState(
      {
        phase: 'completed',
        registeredSeats: [2, 5],
        withdrawnSeats: [],
        completedRounds: [FIRST_ROUND, RUNOFF_ROUND],
      },
      { kind: 'elected', sheriffSeat: 2 },
    );
    const { fromView, fromSection } = presentationOf(state);
    expect(fromView.rows).toEqual(fromSection.rows);
    // A reordered record is a different election: the last round is now
    // the deciding round, so the winner marker must follow it. If either
    // adapter ever hard-coded "first round wins", this fails.
    const reordered = makeLocalState(
      {
        phase: 'completed',
        registeredSeats: [2, 5],
        withdrawnSeats: [],
        completedRounds: [RUNOFF_ROUND, FIRST_ROUND],
      },
      { kind: 'elected', sheriffSeat: 2 },
    );
    const reorderedSection = deriveSheriffSection(reordered);
    if (reorderedSection === undefined) throw new Error('expected a section');
    const reorderedRows = createSheriffElectionPresentationFromSection(reorderedSection).rows;
    expect(reorderedRows).not.toEqual(fromView.rows);
    const rounds = reorderedRows.filter(
      (row): row is Extract<(typeof reorderedRows)[number], { readonly kind: 'round' }> =>
        row.kind === 'round',
    );
    expect(rounds[0]?.candidates.map((candidate) => candidate.isWinner)).toEqual([false, false]);
    expect(rounds[1]?.candidates.map((candidate) => candidate.isWinner)).toEqual([true, false]);
  });
});
