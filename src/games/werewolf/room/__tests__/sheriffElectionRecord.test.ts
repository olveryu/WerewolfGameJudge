/**
 * Tests for the shared sheriff-election public record (sheriffElectionRecord)
 * — the single derivation consumed by the election panel and the night
 * report. A tally or candidate set computed anywhere else is a drift bug.
 */

import type {
  SheriffElectionRoundResult,
  SheriffElectionState,
} from '@game-judge/game-engine/games/werewolf/public';

import { deriveSheriffRoundRecord, getSheriffCandidateRecords } from '../sheriffElectionRecord';

const FIRST_ROUND: SheriffElectionRoundResult = {
  round: 'first',
  candidateSeats: [2, 5],
  eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
  ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2, 6: 5 },
  voteCounts: { 2: 4, 5: 2 },
  abstainingSeats: [4],
};

function electionWith(
  overrides: Partial<SheriffElectionState> & { phase: SheriffElectionState['phase'] },
): SheriffElectionState {
  return {
    registeredSeats: [],
    withdrawnSeats: [],
    completedRounds: [],
    ...overrides,
  } as SheriffElectionState;
}

describe('deriveSheriffRoundRecord', () => {
  it('counts votes and voter seats from the ballots alone', () => {
    expect(deriveSheriffRoundRecord(FIRST_ROUND)).toEqual({
      round: 'first',
      perCandidate: [
        { seat: 2, votes: 4, voterSeats: [0, 1, 3, 5] },
        { seat: 5, votes: 2, voterSeats: [2, 6] },
      ],
      abstainingSeats: [4],
    });
  });

  it('canonicalizes candidates and voters to seat order', () => {
    const record = deriveSheriffRoundRecord({
      round: 'runoff',
      candidateSeats: [5, 2],
      eligibleVoterSeats: [6, 2, 0],
      ballots: { 6: 5, 2: 2, 0: 5 },
      voteCounts: { 2: 1, 5: 2 },
      abstainingSeats: [],
    });
    expect(record.perCandidate).toEqual([
      { seat: 2, votes: 1, voterSeats: [2] },
      { seat: 5, votes: 2, voterSeats: [0, 6] },
    ]);
  });

  it('fails fast on a missing ballot for an eligible voter', () => {
    expect(() =>
      deriveSheriffRoundRecord({
        ...FIRST_ROUND,
        ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2 },
      }),
    ).toThrow(/has no ballot for eligible voter 6/);
  });

  it('fails fast when a stored count disagrees with the ballots', () => {
    expect(() => deriveSheriffRoundRecord({ ...FIRST_ROUND, voteCounts: { 2: 3, 5: 2 } })).toThrow(
      /disagrees with its ballots/,
    );
  });

  it('fails fast when a stored count is missing for a candidate', () => {
    expect(() => deriveSheriffRoundRecord({ ...FIRST_ROUND, voteCounts: { 2: 4 } })).toThrow(
      /has no stored vote count for candidate 5/,
    );
  });

  it('fails fast when stored abstentions disagree with the ballots', () => {
    expect(() => deriveSheriffRoundRecord({ ...FIRST_ROUND, abstainingSeats: [] })).toThrow(
      /abstaining seats disagree/,
    );
  });
});

describe('getSheriffCandidateRecords', () => {
  it('returns null during registration — identities stay secret', () => {
    expect(
      getSheriffCandidateRecords(electionWith({ phase: 'registration', registeredSeats: [1, 2] })),
    ).toBeNull();
  });

  it('exposes registration minus withdrawals during speech phases', () => {
    for (const phase of ['candidateSpeech', 'withdrawal'] as const) {
      expect(
        getSheriffCandidateRecords(
          electionWith({ phase, registeredSeats: [2, 5, 7], withdrawnSeats: [7] }),
        ),
      ).toEqual({
        registeredSeats: [2, 5, 7],
        withdrawnSeats: [7],
        activeCandidateSeats: [2, 5],
      });
    }
  });

  it('exposes the current round candidates during voting phases', () => {
    for (const phase of ['firstVote', 'runoffVote'] as const) {
      expect(
        getSheriffCandidateRecords(
          electionWith({
            phase,
            registeredSeats: [2, 5],
            candidateSeats: [2, 5],
            eligibleVoterSeats: [0, 1],
            ballots: {},
          }),
        ),
      ).toEqual({
        registeredSeats: [2, 5],
        withdrawnSeats: [],
        activeCandidateSeats: [2, 5],
      });
    }
  });

  it('exposes only the runoff candidates during runoff speech', () => {
    expect(
      getSheriffCandidateRecords(
        electionWith({
          phase: 'runoffSpeech',
          registeredSeats: [2, 5, 9],
          withdrawnSeats: [9],
          candidateSeats: [2, 5],
        }),
      ),
    ).toEqual({
      registeredSeats: [2, 5, 9],
      withdrawnSeats: [9],
      activeCandidateSeats: [2, 5],
    });
  });

  it('exposes registration minus withdrawals once completed', () => {
    expect(
      getSheriffCandidateRecords(
        electionWith({ phase: 'completed', registeredSeats: [2, 5, 7], withdrawnSeats: [7] }),
      ),
    ).toEqual({
      registeredSeats: [2, 5, 7],
      withdrawnSeats: [7],
      activeCandidateSeats: [2, 5],
    });
  });
});
