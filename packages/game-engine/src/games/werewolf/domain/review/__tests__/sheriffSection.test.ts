import { createGame } from '../../../__tests__/boards/gameFactory';
import type {
  GameState,
  SheriffElectionResult,
  SheriffElectionRoundResult,
  SheriffElectionState,
} from '../../protocol/types';
import { deriveSheriffSection } from '../sheriffSection';

/** A dealt twelve-seat game with the election fields under test replaced. */
function makeGameState(
  overrides: Partial<{
    sheriffElection: SheriffElectionState;
    sheriffElectionResult: SheriffElectionResult;
  }> = {},
): GameState {
  return { ...createGame('预女猎白').getGameState(), ...overrides };
}

describe('sheriff section', () => {
  const FIRST_ROUND: SheriffElectionRoundResult = {
    round: 'first',
    candidateSeats: [2, 5],
    eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
    ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2, 6: 5 },
    voteCounts: { 2: 4, 5: 2 },
    abstainingSeats: [4],
  };
  const FIRST_ROUND_DERIVED = {
    round: 'first',
    perCandidate: [
      { seat: 2, votes: 4, voterSeats: [0, 1, 3, 5] },
      { seat: 5, votes: 2, voterSeats: [2, 6] },
    ],
    abstainingSeats: [4],
  };
  const RUNOFF_TIE_ROUND: SheriffElectionRoundResult = {
    round: 'runoff',
    candidateSeats: [2, 5],
    eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
    ballots: { 0: 2, 1: 5, 2: 2, 3: 5, 4: 2, 5: 5, 6: null },
    voteCounts: { 2: 3, 5: 3 },
    abstainingSeats: [6],
  };

  it('is absent when the game held no election', () => {
    expect(deriveSheriffSection(makeGameState())).toBeUndefined();
  });

  it('registration exposes status only — no seats, no counts (secrecy)', () => {
    const section = deriveSheriffSection(
      makeGameState({
        sheriffElection: {
          phase: 'registration',
          registeredSeats: [1, 2],
          withdrawnSeats: [],
          completedRounds: [],
        },
      }),
    );
    expect(section).toEqual({ kind: 'registration' });
  });

  it('retains the revealed round and final outcome while the timed result is open', () => {
    const section = deriveSheriffSection(
      makeGameState({
        sheriffElection: {
          phase: 'result',
          registeredSeats: [2, 5],
          withdrawnSeats: [],
          completedRounds: [FIRST_ROUND],
          deadline: 6000,
          next: { kind: 'final', result: { kind: 'elected', sheriffSeat: 2 } },
        },
      }),
    );
    expect(section).toMatchObject({
      kind: 'completed',
      rounds: [FIRST_ROUND_DERIVED],
      result: { kind: 'elected', sheriffSeat: 2 },
    });
  });

  it('candidate speech exposes active candidates and withdrawals, no tallies', () => {
    const section = deriveSheriffSection(
      makeGameState({
        sheriffElection: {
          phase: 'candidateSpeech',
          registeredSeats: [2, 5, 7],
          withdrawnSeats: [7],
          completedRounds: [],
          speakingStartSeat: 2,
          speakingDirection: 'clockwise',
        },
      }),
    );
    expect(section).toEqual({
      kind: 'inProgress',
      phase: 'candidateSpeech',
      registeredSeats: [2, 5, 7],
      candidateSeats: [2, 5],
      withdrawnSeats: [7],
      closedRounds: [],
      activeRound: null,
      voteProgress: null,
      speakingOrder: { startSeat: 2, direction: 'clockwise' },
    });
  });

  it('first vote in progress lists candidates and submission counts only — ballot targets are never exposed', () => {
    const section = deriveSheriffSection(
      makeGameState({
        sheriffElection: {
          phase: 'firstVote',
          registeredSeats: [2, 5],
          withdrawnSeats: [],
          completedRounds: [],
          candidateSeats: [2, 5],
          eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
          ballots: { 0: 2, 1: 5 },
        },
      }),
    );
    expect(section).toEqual({
      kind: 'inProgress',
      phase: 'firstVote',
      registeredSeats: [2, 5],
      candidateSeats: [2, 5],
      withdrawnSeats: [],
      closedRounds: [],
      activeRound: { round: 'first', candidateSeats: [2, 5] },
      voteProgress: { submittedCount: 2, eligibleCount: 7, pendingSeats: [2, 3, 4, 5, 6] },
      speakingOrder: null,
    });
    expect(JSON.stringify(section)).not.toContain('ballot');
    expect(JSON.stringify(section)).not.toContain('votes');
  });

  it('runoff speech shows the closed first round and the runoff candidates', () => {
    const section = deriveSheriffSection(
      makeGameState({
        sheriffElection: {
          phase: 'runoffSpeech',
          registeredSeats: [2, 5, 9],
          withdrawnSeats: [9, 5],
          completedRounds: [FIRST_ROUND],
          candidateSeats: [2, 5],
          speakingStartSeat: 2,
          speakingDirection: 'clockwise',
        },
      }),
    );
    expect(section).toEqual({
      kind: 'inProgress',
      phase: 'runoffSpeech',
      registeredSeats: [2, 5, 9],
      candidateSeats: [2],
      withdrawnSeats: [9, 5],
      closedRounds: [FIRST_ROUND_DERIVED],
      activeRound: null,
      voteProgress: null,
      speakingOrder: { startSeat: 2, direction: 'clockwise' },
    });
  });

  it('runoff vote in progress keeps the closed round and hides the active ballots', () => {
    const section = deriveSheriffSection(
      makeGameState({
        sheriffElection: {
          phase: 'runoffVote',
          registeredSeats: [2, 5],
          withdrawnSeats: [],
          completedRounds: [FIRST_ROUND],
          candidateSeats: [2, 5],
          eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
          ballots: { 0: 2 },
        },
      }),
    );
    expect(section).toEqual({
      kind: 'inProgress',
      phase: 'runoffVote',
      registeredSeats: [2, 5],
      candidateSeats: [2, 5],
      withdrawnSeats: [],
      closedRounds: [FIRST_ROUND_DERIVED],
      activeRound: { round: 'runoff', candidateSeats: [2, 5] },
      voteProgress: { submittedCount: 1, eligibleCount: 7, pendingSeats: [1, 2, 3, 4, 5, 6] },
      speakingOrder: null,
    });
  });

  it('completed election derives every tally from the ballots', () => {
    const section = deriveSheriffSection(
      makeGameState({
        sheriffElection: {
          phase: 'completed',
          registeredSeats: [2, 5],
          withdrawnSeats: [],
          completedRounds: [FIRST_ROUND],
        },
        sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
      }),
    );
    expect(section).toEqual({
      kind: 'completed',
      registeredSeats: [2, 5],
      withdrawnSeats: [],
      activeCandidateSeats: [2, 5],
      rounds: [FIRST_ROUND_DERIVED],
      result: { kind: 'elected', sheriffSeat: 2 },
    });
  });

  it('completed no-sheriff keeps the closed rounds and the reason', () => {
    const section = deriveSheriffSection(
      makeGameState({
        sheriffElection: {
          phase: 'completed',
          registeredSeats: [2, 5],
          withdrawnSeats: [],
          completedRounds: [FIRST_ROUND, RUNOFF_TIE_ROUND],
        },
        sheriffElectionResult: { kind: 'noSheriff', reason: 'runoffTie' },
      }),
    );
    expect(section).toMatchObject({
      kind: 'completed',
      result: { kind: 'noSheriff', reason: 'runoffTie' },
    });
    if (section?.kind !== 'completed') throw new Error('expected a completed section');
    expect(section.rounds).toHaveLength(2);
    expect(section.rounds[1]).toEqual({
      round: 'runoff',
      perCandidate: [
        { seat: 2, votes: 3, voterSeats: [0, 2, 4] },
        { seat: 5, votes: 3, voterSeats: [1, 3, 5] },
      ],
      abstainingSeats: [6],
    });
  });

  it('completed with no candidates carries no rounds', () => {
    const section = deriveSheriffSection(
      makeGameState({
        sheriffElection: {
          phase: 'completed',
          registeredSeats: [],
          withdrawnSeats: [],
          completedRounds: [],
        },
        sheriffElectionResult: { kind: 'noSheriff', reason: 'noCandidates' },
      }),
    );
    expect(section).toEqual({
      kind: 'completed',
      registeredSeats: [],
      withdrawnSeats: [],
      activeCandidateSeats: [],
      rounds: [],
      result: { kind: 'noSheriff', reason: 'noCandidates' },
    });
  });

  it('fails fast when stored vote counts disagree with the ballots', () => {
    expect(() =>
      deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [2, 5],
            withdrawnSeats: [],
            completedRounds: [{ ...FIRST_ROUND, voteCounts: { 2: 3, 5: 2 } }],
          },
          sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
        }),
      ),
    ).toThrow(/disagrees with its ballots/);
  });

  it('fails fast when stored abstentions disagree with the ballots', () => {
    expect(() =>
      deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [2, 5],
            withdrawnSeats: [],
            completedRounds: [{ ...FIRST_ROUND, abstainingSeats: [] }],
          },
          sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
        }),
      ),
    ).toThrow(/abstaining seats disagree/);
  });

  it('fails fast on a result without an election state', () => {
    expect(() =>
      deriveSheriffSection(
        makeGameState({ sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 } }),
      ),
    ).toThrow(/without an election state/);
  });

  it('fails fast on a completed election without a result', () => {
    expect(() =>
      deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [],
            withdrawnSeats: [],
            completedRounds: [],
          },
        }),
      ),
    ).toThrow(/without a result/);
  });
});

// ── 2026 report fact layer: stats, wolf verdict, death annotations ────
