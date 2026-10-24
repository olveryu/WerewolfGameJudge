/**
 * Drift pin: the election panel and the night report must derive the SAME
 * public election record from the same election state, because both now
 * consume the shared record (sheriffElectionRecord). Any divergence here
 * means one surface re-derived the record on its own — the exact drift
 * this extraction exists to kill.
 *
 * The report also renders the panel's read-only presentation (phase
 * header, result banner, candidate records, closed-round tallies), so this
 * file pins the rendered UI equivalence too: the report's sheriff slice
 * is the panel's rendered output, prefixed only by the report's own
 * section title.
 *
 * Also pins the runoff regression: a first-phase withdrawal is never a
 * runoff candidate, so it must never appear in the 平票候选 row of either
 * channel (card or text lines). The withdrawn seat DOES appear in the
 * panel's 上警 row — that row lists every registered seat with withdrawals
 * marked — and that is correct panel behavior, not a regression.
 */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { render } from '@testing-library/react-native';

import { toWerewolfLocalState } from '@/games/werewolf/state/toWerewolfLocalState';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { colors } from '@/theme';

import { NightReviewReportBody } from '../components/NightReviewReportBody';
import { SheriffElectionPanel } from '../components/SheriffElectionPanel';
import { createSheriffElectionPanelStyles } from '../components/sheriffElectionPanel.styles';
import type { SheriffElectionPanelModel } from '../hooks/useSheriffElection';
import { deriveSheriffSection } from '../NightReview.helpers';
import { formatNightReviewSheriffLines } from '../shareNightReviewLines';
import { createSheriffElectionViewModel } from '../sheriffElectionViewModel';

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
  return toWerewolfLocalState(
    buildWerewolfTestState({
      status: GameStatus.Day,
      templateRoles: Array.from({ length: 10 }, () => 'villager' as const),
      players,
      roleViewedSeats: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      roster,
      rules: { isSheriffElectionEnabled: true },
      sheriffElection: election,
      sheriffElectionResult: result,
    }),
  );
}

interface JsonNode {
  type: unknown;
  children: (JsonNode | string)[] | null;
}

function textOf(node: JsonNode): string {
  if (!node.children) return '';
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
}

function collectTexts(node: JsonNode | (JsonNode | string)[] | string | null): string[] {
  if (node === null || typeof node === 'string') return [];
  if (Array.isArray(node)) return node.flatMap((child) => collectTexts(child));
  if (node.type === 'Text') return [textOf(node)];
  return collectTexts(node.children);
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
      gameState: state,
      effectiveSeat: 0,
      isHost: false,
    });
    const section = deriveSheriffSection(state);
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

  it('completed election: the report renders the panel UI, not its own card', () => {
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
    if (view === null) throw new Error('expected a panel view model');
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
    const panelTexts = collectTexts(
      render(
        <SheriffElectionPanel model={model} styles={createSheriffElectionPanelStyles(colors)} />,
      ).toJSON(),
    );
    const section = deriveSheriffSection(state);
    if (section === undefined) throw new Error('expected a report section');
    const reportTexts = collectTexts(
      render(
        <NightReviewReportBody
          data={{ actions: [{ kind: 'peacefulNight' }], identities: [], sheriff: section }}
        />,
      ).toJSON(),
    );
    const sheriffStart = reportTexts.indexOf('警长竞选');
    const identitiesIndex = reportTexts.indexOf('全员身份');
    expect(sheriffStart).toBeGreaterThan(-1);
    expect(identitiesIndex).toBeGreaterThan(sheriffStart);
    // The report's sheriff slice is the panel's rendered output, prefixed
    // only by the report's own section title. No panel piece is missing,
    // none is reworded, and no interactive control leaks into the report.
    expect(reportTexts.slice(sheriffStart, identitiesIndex)).toEqual(['警长竞选', ...panelTexts]);
    expect(panelTexts).not.toContain('选择候选人');
    expect(panelTexts).not.toContain('尚未投票');
  });

  it('registration: panel records are null and the report is status-only', () => {
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
    expect(view?.candidateRecords).toBeNull();
    expect(deriveSheriffSection(state)).toEqual({ kind: 'registration' });
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
      gameState: state,
      effectiveSeat: 0,
      isHost: false,
    });
    const section = deriveSheriffSection(state);
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

    // Text channel: the runoff row lists the runoff candidates only.
    const lines = formatNightReviewSheriffLines(section);
    const runoffLine = lines.find((line) => line.startsWith('决选候选'));
    expect(runoffLine).toBe('决选候选：3号、6号');
    expect(lines.join('\n')).not.toContain('10号');

    // Card channel, now in panel UI: the 平票候选 row holds exactly the
    // runoff candidates. The withdrawn seat appears in the 上警 row
    // (every registered seat, withdrawals marked) — that is the panel's
    // record model, not the old bug, which merged withdrawals into the
    // runoff row itself.
    const { toJSON } = render(
      <NightReviewReportBody
        data={{ actions: [{ kind: 'peacefulNight' }], identities: [], sheriff: section }}
      />,
    );
    const texts = collectTexts(toJSON());
    const registeredLabelIndex = texts.indexOf('上警');
    const runoffLabelIndex = texts.indexOf('平票候选');
    const nextRoundIndex = texts.indexOf('首轮投票结果');
    expect(registeredLabelIndex).toBeGreaterThan(-1);
    expect(runoffLabelIndex).toBeGreaterThan(registeredLabelIndex);
    expect(nextRoundIndex).toBeGreaterThan(runoffLabelIndex);
    expect(texts.slice(registeredLabelIndex + 1, runoffLabelIndex)).toEqual([
      '3',
      '6',
      '10',
      '10号已退水',
    ]);
    expect(texts.slice(runoffLabelIndex + 1, nextRoundIndex)).toEqual(['3', '6']);
  });
});
