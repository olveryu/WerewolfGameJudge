/**
 * Presentation projection tests: one input, one row list, decided once.
 * Fixtures reuse the sheriff-record equivalence set (registration 3/6/10,
 * 10 withdrawn in the first round; first round 3号 4 votes, 6号 2 votes,
 * 5号 abstained) so the projection, the panel, and the review are all
 * pinned to the same election.
 */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { deriveSheriffSection, GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import {
  createSheriffElectionPresentation,
  createSheriffElectionPresentationFromSection,
  createSheriffElectionPresentationFromView,
  type SheriffElectionPresentationInput,
  type SheriffElectionPresentationRow,
} from '@/games/werewolf/room/day/sheriffElectionPresentation';
import { createSheriffElectionViewModel } from '@/games/werewolf/room/day/sheriffElectionViewModel';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

const FIRST_ROUND: NonNullable<GameState['sheriffElection']>['completedRounds'][number] = {
  round: 'first',
  candidateSeats: [2, 5],
  eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
  ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2, 6: 5 },
  voteCounts: { 2: 4, 5: 2 },
  abstainingSeats: [4],
};

const FIRST_ROUND_TALLY = {
  key: 'first' as const,
  perCandidate: [
    { seat: 2, votes: 4, voterSeats: [0, 1, 3, 5] },
    { seat: 5, votes: 2, voterSeats: [2, 6] },
  ],
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

function rowKinds(rows: readonly SheriffElectionPresentationRow[]): string[] {
  return rows.map((row) => row.kind);
}

function rowOf<T extends SheriffElectionPresentationRow['kind']>(
  rows: readonly SheriffElectionPresentationRow[],
  kind: T,
): Extract<SheriffElectionPresentationRow, { readonly kind: T }> {
  const row = rows.find((candidate) => candidate.kind === kind);
  if (row === undefined || row.kind !== kind) throw new Error(`expected a ${kind} row`);
  return row;
}

describe('createSheriffElectionPresentation', () => {
  it('registration: only the phase row, no seats, no counts', () => {
    const { rows } = createSheriffElectionPresentation({
      phase: 'registration',
      records: null,
      speakingText: null,
      voteProgress: null,
      rounds: [],
      result: null,
    });
    expect(rows).toEqual([
      {
        kind: 'phase',
        title: '报名上警',
        description: '想竞选警长的玩家可在手机上报名，系统随后将随机确定发言顺序。',
      },
    ]);
  });

  it('registration secrecy: rounds or a result with no records fail fast', () => {
    const input: SheriffElectionPresentationInput = {
      phase: 'registration',
      records: null,
      speakingText: null,
      voteProgress: null,
      rounds: [FIRST_ROUND_TALLY],
      result: null,
    };
    expect(() => createSheriffElectionPresentation(input)).toThrow(
      '[FAIL-FAST] Sheriff election presentation received rounds or a result with no public records',
    );
  });

  it('completed election: phase, result, registration, then rounds; winner only in the deciding round', () => {
    const { rows } = createSheriffElectionPresentation({
      phase: 'completed',
      records: { registeredSeats: [2, 5], withdrawnSeats: [], activeCandidateSeats: [2, 5] },
      speakingText: null,
      voteProgress: null,
      rounds: [FIRST_ROUND_TALLY],
      result: { kind: 'elected', sheriffSeat: 2 },
    });
    expect(rowKinds(rows)).toEqual(['phase', 'result', 'registration', 'round']);
    const result = rowOf(rows, 'result');
    expect(result).toEqual({
      kind: 'result',
      resultKind: 'elected',
      sheriffSeat: 2,
      timelineTitle: '当选警长',
      bannerTitle: '3号 · 当选警长',
      bannerSubtitle: '首轮投票当选 · 警徽在 3号',
      noSheriffText: null,
    });
    expect(rowOf(rows, 'registration')).toEqual({
      kind: 'registration',
      seats: [
        { seat: 2, isWithdrawn: false },
        { seat: 5, isWithdrawn: false },
      ],
      withdrawnNote: null,
    });
    const round = rowOf(rows, 'round');
    expect(round.title).toBe('首轮投票结果');
    expect(round.isEmpty).toBe(false);
    expect(round.candidates).toEqual([
      { seat: 2, votes: 4, voterSeats: [0, 1, 3, 5], isWinner: true },
      { seat: 5, votes: 2, voterSeats: [2, 6], isWinner: false },
    ]);
    expect(round.abstainingSeats).toEqual([4]);
  });

  it('completed election with a runoff: only the deciding round marks its winner', () => {
    const runoffTally = {
      key: 'runoff' as const,
      perCandidate: [
        { seat: 2, votes: 5, voterSeats: [0, 1, 3, 5, 6] },
        { seat: 5, votes: 2, voterSeats: [2, 4] },
      ],
      abstainingSeats: [],
    };
    const { rows } = createSheriffElectionPresentation({
      phase: 'completed',
      records: { registeredSeats: [2, 5], withdrawnSeats: [], activeCandidateSeats: [2, 5] },
      speakingText: null,
      voteProgress: null,
      rounds: [FIRST_ROUND_TALLY, runoffTally],
      result: { kind: 'elected', sheriffSeat: 2 },
    });
    const rounds = rows.filter((row) => row.kind === 'round');
    expect(rounds).toHaveLength(2);
    expect(rounds[0]?.candidates.map((candidate) => candidate.isWinner)).toEqual([false, false]);
    expect(rounds[1]?.candidates.map((candidate) => candidate.isWinner)).toEqual([true, false]);
    expect(rowOf(rows, 'result').bannerSubtitle).toBe('平票投票当选 · 警徽在 3号');
  });

  it('no-sheriff outcomes: the reason text is the banner and the timeline text', () => {
    const reasons = [
      { reason: 'noCandidates' as const, text: '无人参选，本局没有警长' },
      { reason: 'noVotes' as const, text: '无人得票，本局没有警长' },
      { reason: 'runoffTie' as const, text: '平票未决，本局没有警长' },
      { reason: 'selfDestruct' as const, text: '因狼人自爆，警长竞选已结束且没有警长' },
    ];
    for (const { reason, text } of reasons) {
      const { rows } = createSheriffElectionPresentation({
        phase: 'completed',
        records: { registeredSeats: [2, 5], withdrawnSeats: [], activeCandidateSeats: [2, 5] },
        speakingText: null,
        voteProgress: null,
        rounds: [FIRST_ROUND_TALLY],
        result: { kind: 'noSheriff', reason },
      });
      const result = rowOf(rows, 'result');
      expect(result.resultKind).toBe('noSheriff');
      expect(result.sheriffSeat).toBeNull();
      expect(result.timelineTitle).toBe('没有警长');
      expect(result.bannerTitle).toBe(text);
      expect(result.bannerSubtitle).toBeNull();
      expect(result.noSheriffText).toBe(text);
    }
  });

  it('runoff speech: withdrawn seats stay in registration, never in the runoff candidates', () => {
    const { rows } = createSheriffElectionPresentation({
      phase: 'runoffSpeech',
      records: {
        registeredSeats: [2, 5, 9],
        withdrawnSeats: [9],
        activeCandidateSeats: [2, 5],
      },
      speakingText: '从 3号开始，顺时针发言',
      voteProgress: null,
      rounds: [FIRST_ROUND_TALLY],
      result: null,
    });
    expect(rowKinds(rows)).toEqual(['phase', 'registration', 'candidates', 'speaking', 'round']);
    expect(rowOf(rows, 'phase').title).toBe('平票发言');
    expect(rowOf(rows, 'registration')).toEqual({
      kind: 'registration',
      seats: [
        { seat: 2, isWithdrawn: false },
        { seat: 5, isWithdrawn: false },
        { seat: 9, isWithdrawn: true },
      ],
      withdrawnNote: '10号已退水',
    });
    const candidates = rowOf(rows, 'candidates');
    expect(candidates.label).toBe('平票候选');
    expect(candidates.seats).toEqual([2, 5]);
    expect(rowOf(rows, 'speaking').text).toBe('从 3号开始，顺时针发言');
    // In progress, no round marks a winner.
    expect(rowOf(rows, 'round').candidates.every((candidate) => !candidate.isWinner)).toBe(true);
  });

  it('candidates row: only when the standing candidates differ from the registration', () => {
    const base: SheriffElectionPresentationInput = {
      phase: 'candidateSpeech',
      records: { registeredSeats: [2, 5], withdrawnSeats: [], activeCandidateSeats: [2, 5] },
      speakingText: null,
      voteProgress: null,
      rounds: [],
      result: null,
    };
    expect(rowKinds(createSheriffElectionPresentation(base).rows)).toEqual([
      'phase',
      'registration',
    ]);
    const differed = createSheriffElectionPresentation({
      ...base,
      records: { registeredSeats: [2, 5, 9], withdrawnSeats: [9], activeCandidateSeats: [2, 5] },
    });
    expect(rowKinds(differed.rows)).toEqual(['phase', 'registration', 'candidates']);
    expect(rowOf(differed.rows, 'candidates').label).toBe('候选');
  });

  it('open vote: progress counts only, never ballot targets', () => {
    const { rows } = createSheriffElectionPresentation({
      phase: 'firstVote',
      records: { registeredSeats: [2, 5], withdrawnSeats: [], activeCandidateSeats: [2, 5] },
      speakingText: null,
      voteProgress: { submittedCount: 5, eligibleCount: 7 },
      rounds: [],
      result: null,
    });
    expect(rowOf(rows, 'voteProgress')).toEqual({
      kind: 'voteProgress',
      submittedCount: 5,
      eligibleCount: 7,
      text: '5/7 已提交',
    });
  });

  it('empty round: no votes and no abstentions is empty', () => {
    const { rows } = createSheriffElectionPresentation({
      phase: 'completed',
      records: { registeredSeats: [2], withdrawnSeats: [], activeCandidateSeats: [2] },
      speakingText: null,
      voteProgress: null,
      rounds: [
        {
          round: 'first',
          perCandidate: [{ seat: 2, votes: 0, voterSeats: [] }],
          abstainingSeats: [],
        },
      ],
      result: { kind: 'noSheriff', reason: 'noVotes' },
    });
    expect(rowOf(rows, 'round').isEmpty).toBe(true);
  });
});

describe('presentation adapters', () => {
  it('completed election: view and section produce the same rows', () => {
    const state = makeLocalState(
      {
        phase: 'completed',
        registeredSeats: [2, 5],
        withdrawnSeats: [],
        completedRounds: [FIRST_ROUND],
      },
      { kind: 'elected', sheriffSeat: 2 },
    );
    const view = createSheriffElectionViewModel({
      gameState: state,
      effectiveSeat: 0,
      isHost: false,
    });
    if (view === null) throw new Error('expected a view model');
    const section = deriveSheriffSection(state);
    if (section === undefined) throw new Error('expected a section');
    expect(createSheriffElectionPresentationFromView(view).rows).toEqual(
      createSheriffElectionPresentationFromSection(section).rows,
    );
  });

  it('runoff speech: view and section produce the same rows', () => {
    const state = makeLocalState({
      phase: 'runoffSpeech',
      registeredSeats: [2, 5, 9],
      withdrawnSeats: [9],
      completedRounds: [FIRST_ROUND],
      candidateSeats: [2, 5],
      speakingStartSeat: 2,
      speakingDirection: 'clockwise',
    });
    const view = createSheriffElectionViewModel({
      gameState: state,
      effectiveSeat: 0,
      isHost: false,
    });
    if (view === null) throw new Error('expected a view model');
    const section = deriveSheriffSection(state);
    if (section === undefined) throw new Error('expected a section');
    expect(createSheriffElectionPresentationFromView(view).rows).toEqual(
      createSheriffElectionPresentationFromSection(section).rows,
    );
  });

  it('registration: view and section produce only the phase row', () => {
    const state = makeLocalState({
      phase: 'registration',
      registeredSeats: [1, 2],
      withdrawnSeats: [],
      completedRounds: [],
    });
    const view = createSheriffElectionViewModel({
      gameState: state,
      effectiveSeat: 0,
      isHost: false,
    });
    if (view === null) throw new Error('expected a view model');
    const section = deriveSheriffSection(state);
    if (section === undefined) throw new Error('expected a section');
    const expected = createSheriffElectionPresentationFromSection(section);
    expect(rowKinds(expected.rows)).toEqual(['phase']);
    expect(createSheriffElectionPresentationFromView(view)).toEqual(expected);
  });
});
