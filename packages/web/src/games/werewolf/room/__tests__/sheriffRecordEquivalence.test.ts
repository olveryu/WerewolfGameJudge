/**
 * Drift pin: the election panel and the review must derive the SAME public
 * election record from the same election state, because both consume the
 * shared record (sheriffElectionRecord). Any divergence here means one
 * surface re-derived the record on its own — the exact drift the shared
 * record exists to kill.
 *
 * The review prints the record in the shared report language (a timeline
 * of 上警 / 候选 / 发言顺序 / round tallies / result), with the panel's own
 * copy (phase titles, round titles, speaking line, no-sheriff text) from
 * the panel's view model — so the words cannot drift either.
 *
 * Also pins the runoff regression: a first-phase withdrawal is never a
 * runoff candidate, so it must never appear in the 平票候选 step. The
 * withdrawn seat DOES appear in the 上警 step — that step lists every
 * registered seat with withdrawals marked — matching the panel's record.
 */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { deriveSheriffSection } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { ReviewInline, ReviewTimelineStep } from '@/features/room/review/types';
import { toWerewolfReviewDocument } from '@/games/werewolf/review/toWerewolfReviewDocument';
import {
  createSheriffElectionViewModel,
  formatSpeakingOrder,
} from '@/games/werewolf/room/day/sheriffElectionViewModel';
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
  round: 'first',
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
  const gameState = buildWerewolfTestState({
    status: GameStatus.Day,
    templateRoles: Array.from({ length: 10 }, () => 'villager' as const),
    players,
    roleViewedSeats: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    roster,
    rules: { isSheriffElectionEnabled: true },
    sheriffElection: election,
    sheriffElectionResult: result,
  });
  return { gameState };
}

/** The review's sheriff steps for a section, built through the real document builder. */
function reviewSheriffSteps(
  sheriff: NonNullable<ReturnType<typeof deriveSheriffSection>>,
): readonly ReviewTimelineStep[] {
  const document = toWerewolfReviewDocument({
    review: { actions: [{ kind: 'peacefulNight' }], identities: [], sheriff },
    roomCode: '1234',
    gameSequence: 0,
  });
  const blocks = document.pages[0]?.blocks ?? [];
  const sectionIndex = blocks.findIndex(
    (block) => block.kind === 'section' && block.title === '警长竞选',
  );
  const timeline = blocks[sectionIndex + 1];
  if (sectionIndex < 0 || timeline?.kind !== 'timeline') {
    throw new Error('expected the 警长竞选 section followed by its timeline');
  }
  return timeline.steps;
}

function stepNamed(steps: readonly ReviewTimelineStep[], title: string): ReviewTimelineStep {
  const step = steps.find((candidate) => candidate.title === title);
  if (step === undefined) throw new Error(`expected a ${title} step`);
  return step;
}

/** A line as readable tokens: text as is, a seat as its display number, a tag in brackets. */
function lineTokens(line: readonly ReviewInline[]): string[] {
  return line.map((inline) =>
    inline.kind === 'text'
      ? inline.text
      : inline.kind === 'seat'
        ? `${inline.seat + 1}${inline.tone === 'neutral' ? '' : `:${inline.tone}`}`
        : `[${inline.text}]`,
  );
}

describe('panel and report derive the same sheriff record', () => {
  it('completed election: panel rounds/records equal the report section', () => {
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
      gameState: state.gameState,
      effectiveSeat: 0,
      isHost: false,
    });
    const section = deriveSheriffSection(state.gameState);
    if (section?.kind !== 'completed') throw new Error('expected a completed section');

    expect(view?.completedRounds).toEqual([
      {
        key: 'first',
        title: '首轮投票结果',
        perCandidate: FIRST_ROUND_TALLY.perCandidate,
        abstainingSeats: FIRST_ROUND_TALLY.abstainingSeats,
      },
    ]);
    expect(view?.candidateRecords).toEqual({
      registeredSeats: [2, 5],
      withdrawnSeats: [],
      activeCandidateSeats: [2, 5],
    });
    expect(section.rounds).toEqual([FIRST_ROUND_TALLY]);
    expect(section.registeredSeats).toEqual([2, 5]);
    expect(section.withdrawnSeats).toEqual([]);
    expect(section.activeCandidateSeats).toEqual([2, 5]);
    expect(section.result).toEqual({ kind: 'elected', sheriffSeat: 2 });
  });

  it('completed election: the review prints the panel record with the panel copy', () => {
    const state = makeLocalState(
      {
        phase: 'completed',
        registeredSeats: [2, 5],
        withdrawnSeats: [],
        completedRounds: [FIRST_ROUND],
      },
      { kind: 'elected', sheriffSeat: 2 },
    );
    const section = deriveSheriffSection(state.gameState);
    if (section === undefined) throw new Error('expected a report section');
    const steps = reviewSheriffSteps(section);

    expect(steps.map((step) => step.title)).toEqual([
      '竞选结束',
      '当选警长',
      '上警',
      '首轮投票结果',
    ]);
    expect(stepNamed(steps, '当选警长').lines.map(lineTokens)).toEqual([
      ['3:highlight', '首轮投票当选 · 警徽在 3号'],
    ]);
    expect(stepNamed(steps, '上警').lines.map(lineTokens)).toEqual([['3', '6']]);
    // The deciding round marks its winner; voters follow each candidate,
    // abstentions are demoted to one line.
    expect(stepNamed(steps, '首轮投票结果').lines.map(lineTokens)).toEqual([
      ['3:highlight', '4 票：', '1', '2', '4', '6', '[当选]'],
      ['6', '2 票：', '3', '7'],
      ['弃票：', '5:muted'],
    ]);
  });

  it('registration: panel records are null and the report is status-only', () => {
    const state = makeLocalState({
      phase: 'registration',
      registeredSeats: [1, 2],
      withdrawnSeats: [],
      completedRounds: [],
    });
    const view = createSheriffElectionViewModel({
      gameState: state.gameState,
      effectiveSeat: 0,
      isHost: false,
    });
    expect(view?.candidateRecords).toBeNull();
    const section = deriveSheriffSection(state.gameState);
    expect(section).toEqual({ kind: 'registration' });
    if (section === undefined) throw new Error('expected a report section');
    // Status only: the phase and its description, no seats and no counts.
    expect(reviewSheriffSteps(section)).toEqual([
      {
        title: '报名上警',
        tone: 'neutral',
        lines: [
          [
            {
              kind: 'text',
              text: '想竞选警长的玩家可在手机上报名，系统随后将随机确定发言顺序。',
              tone: 'neutral',
            },
          ],
        ],
      },
    ]);
  });

  it('runoff speech: a first-phase withdrawal is never a runoff candidate', () => {
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
      gameState: state.gameState,
      effectiveSeat: 0,
      isHost: false,
    });
    const section = deriveSheriffSection(state.gameState);
    if (section?.kind !== 'inProgress') throw new Error('expected an in-progress section');

    // Both surfaces agree on the record itself.
    expect(view?.candidateRecords).toEqual({
      registeredSeats: [2, 5, 9],
      withdrawnSeats: [9],
      activeCandidateSeats: [2, 5],
    });
    expect(section.candidateSeats).toEqual([2, 5]);
    expect(section.withdrawnSeats).toEqual([9]);
    expect(section.closedRounds).toEqual([FIRST_ROUND_TALLY]);

    // Speaking line: panel and report compute it from the same function.
    expect(view?.speakingInstruction).toBe('从 3号开始，顺时针发言');
    if (!section.speakingOrder) throw new Error('expected a speaking order');
    expect(formatSpeakingOrder(section.speakingOrder)).toBe(view?.speakingInstruction);

    // The 平票候选 step holds exactly the runoff candidates. The withdrawn
    // seat appears in the 上警 step (every registered seat, withdrawals
    // marked) — the panel's record model, not the old bug, which merged
    // withdrawals into the runoff row itself.
    const steps = reviewSheriffSteps(section);
    expect(steps.map((step) => step.title)).toEqual([
      '平票发言',
      '上警',
      '平票候选',
      '发言顺序',
      '首轮投票结果',
    ]);
    expect(stepNamed(steps, '上警').lines.map(lineTokens)).toEqual([
      ['3', '6', '10:muted'],
      ['10号已退水'],
    ]);
    expect(stepNamed(steps, '平票候选').lines.map(lineTokens)).toEqual([['3', '6']]);
    expect(stepNamed(steps, '发言顺序').lines.map(lineTokens)).toEqual([
      ['从 3号开始，顺时针发言'],
    ]);
  });
});
