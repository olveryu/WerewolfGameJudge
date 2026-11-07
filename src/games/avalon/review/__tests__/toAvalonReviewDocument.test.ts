/**
 * toAvalonReviewDocument: the ended view model as review data — the
 * verdict and the accusation, the quest score, every identity by side,
 * the table configuration, the lady checks on 9/10-seat tables with
 * their unoccurred reasons, and one railed group per started quest.
 * The AvalonReviewOverlay render assertions, carried over as data.
 */

import type {
  AvalonProposalRecordView,
  AvalonRoleId,
  AvalonRoundRecordView,
  AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';

import type { ReviewBlock, RoomReviewDocument } from '@/features/room/review/types';

import { toAvalonReviewDocument } from '../toAvalonReviewDocument';

const ROLES_5: readonly AvalonRoleId[] = [
  'merlin',
  'percival',
  'loyalServant',
  'morgana',
  'assassin',
];

const ROLES_10: readonly AvalonRoleId[] = [
  'merlin',
  'percival',
  'loyalServant',
  'loyalServant',
  'loyalServant',
  'loyalServant',
  'morgana',
  'assassin',
  'oberon',
  'mordred',
];

function seatsFor(roles: readonly (AvalonRoleId | null)[]): AvalonViewModel['seats'] {
  return roles.map((role, seat) => ({
    seat,
    displayName: `玩家${seat + 1}`,
    isBot: false,
    isLeader: false,
    role,
  }));
}

function proposal(
  leaderSeat: number,
  teamSeats: readonly number[],
  votes: { readonly approve: number; readonly reject: number; readonly abstain?: number },
): AvalonProposalRecordView {
  return {
    leaderSeat,
    teamSeats,
    ballots: null,
    approveCount: votes.approve,
    rejectCount: votes.reject,
    abstainCount: votes.abstain ?? 0,
    approved: votes.approve > votes.reject,
  };
}

function roundRecord(
  round: AvalonRoundRecordView['round'],
  proposals: readonly AvalonProposalRecordView[],
  closing: Pick<AvalonRoundRecordView, 'quest' | 'vetoEnded'>,
): AvalonRoundRecordView {
  return { round, proposals, ...closing, questProgress: null, currentProposal: null };
}

const SUCCESS_ROUND_1 = roundRecord(1, [proposal(0, [0, 1], { approve: 4, reject: 1 })], {
  quest: { result: 'success', successCount: 2, failCount: 0 },
  vetoEnded: false,
});

const FAIL_ROUND_2 = roundRecord(
  2,
  [
    proposal(1, [1, 2, 3], { approve: 2, reject: 3 }),
    proposal(2, [2, 3, 4], { approve: 3, reject: 2 }),
  ],
  { quest: { result: 'fail', successCount: 2, failCount: 1 }, vetoEnded: false },
);

/** Quest three cut short: one rejected proposal, then the assassin struck. */
const INTERRUPTED_ROUND_3 = roundRecord(3, [proposal(3, [0, 3], { approve: 1, reject: 4 })], {
  quest: null,
  vetoEnded: false,
});

/** A five-seat game the assassin ended during quest three by striking Merlin early. */
function endedViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  return {
    phase: 'ended',
    mySeat: null,
    myRole: null,
    seats: seatsFor(ROLES_5),
    leaderSeat: 3,
    nightStep: null,
    evilPeers: null,
    merlinSees: null,
    percivalSees: null,
    nightConfirmed: false,
    hasViewedRole: false,
    unviewedRoleSeats: [],
    requiredSize: null,
    preselectedSeats: null,
    proposedSeats: null,
    teamSeats: null,
    myBallot: null,
    ballots: null,
    voteCounts: null,
    myPlay: null,
    questResults: ['success', 'fail'],
    questHistory: [],
    roundHistory: [SUCCESS_ROUND_1, FAIL_ROUND_2, INTERRUPTED_ROUND_3],
    lady: null,
    ladyCheckResult: null,
    ladyHistory: [],
    isAssassin: false,
    canEarlyStrike: false,
    accusedSeat: 0,
    winner: 'evil',
    endReason: 'earlyAssassinationHit',
    rejectStreak: 0,
    vetoLimit: 5,
    voteMode: 'secret',
    playerCount: 5,
    lastVoteResult: null,
    ...overrides,
  };
}

/** The same game on a ten-seat public-vote table: 10 号 checked 7 号 (莫甘娜) after quest two. */
function ladyTableViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  return endedViewModel({
    seats: seatsFor(ROLES_10),
    playerCount: 10,
    voteMode: 'public',
    ladyHistory: [{ afterRound: 2, holderSeat: 9, targetSeat: 6 }],
    ...overrides,
  });
}

function build(viewModel: AvalonViewModel): RoomReviewDocument {
  return toAvalonReviewDocument({ viewModel, roomCode: '1234', gameSequence: 2 });
}

function blocksOf(document: RoomReviewDocument): readonly ReviewBlock[] {
  const [page] = document.pages;
  if (page === undefined) throw new Error('expected a page');
  return page.blocks;
}

function blockOf<TKind extends ReviewBlock['kind']>(
  document: RoomReviewDocument,
  kind: TKind,
): Extract<ReviewBlock, { readonly kind: TKind }> {
  const block = blocksOf(document).find(
    (candidate): candidate is Extract<ReviewBlock, { readonly kind: TKind }> =>
      candidate.kind === kind,
  );
  if (block === undefined) throw new Error(`expected a ${kind} block`);
  return block;
}

function sectionTitles(document: RoomReviewDocument): readonly string[] {
  return blocksOf(document).flatMap((block) => (block.kind === 'section' ? [block.title] : []));
}

const neutral = (text: string) => ({ kind: 'text', text, tone: 'neutral' });
const seatMedal = (seat: number, tone: 'good' | 'evil') => ({ kind: 'seat', seat, tone });

describe('toAvalonReviewDocument', () => {
  it('builds one page under the room masthead, numbered by the game', () => {
    const document = build(endedViewModel());
    expect(document).toMatchObject({
      roundKey: 'game-2',
      kicker: '🏰 第 2 局 · 终局',
      fileStem: 'avalon-1234-2',
      footer: '本局复盘由对局记录自动生成',
      isAborted: false,
    });
    expect(document.pages).toHaveLength(1);
    expect(document.pages[0]).toMatchObject({ key: 'ended', label: null });
    expect(blocksOf(document).map((block) => block.kind)).toEqual([
      'hero',
      'stats',
      'section',
      'roster',
      'section',
      'facts',
      'section',
      'groups',
    ]);
    expect(sectionTitles(document)).toEqual(['全员身份', '本局配置', '任务进程']);
  });

  it('heads with the end-reason title in the winner tone and the accusation as byline', () => {
    expect(blockOf(build(endedViewModel()), 'hero')).toEqual({
      kind: 'hero',
      headline: [{ kind: 'text', text: '坏人获胜' }],
      tone: 'evil',
      stamps: [],
      byline: '刺客 5 号指认 1 号（梅林）→ 命中',
    });
    const miss = endedViewModel({
      winner: 'good',
      endReason: 'earlyAssassinationMiss',
      accusedSeat: 2,
    });
    expect(blockOf(build(miss), 'hero')).toMatchObject({
      headline: [{ kind: 'text', text: '好人获胜' }],
      tone: 'good',
      byline: '刺客 5 号指认 3 号（忠臣）→ 未命中',
    });
  });

  it('reads the end-reason description when nobody was accused', () => {
    const threeFail = endedViewModel({ endReason: 'threeFail', accusedSeat: null });
    expect(blockOf(build(threeFail), 'hero')).toMatchObject({
      headline: [{ kind: 'text', text: '坏人获胜' }],
      byline: '三个任务失败',
    });
    const veto = endedViewModel({ endReason: 'vetoLimitReached', accusedSeat: null });
    expect(blockOf(build(veto), 'hero').byline).toBe('单轮连续否决达到上限');
  });

  it('scores the settled quests and counts every rejected proposal', () => {
    expect(blockOf(build(endedViewModel()), 'stats').items).toEqual([
      { label: '成功', value: '1' },
      { label: '失败', value: '1' },
      { label: '否决', value: '2' },
    ]);
  });

  it('lists every identity with its name, its role and its side as the toned status', () => {
    const roster = blockOf(build(endedViewModel()), 'roster');
    expect(roster.columns).toBe(1);
    expect(roster.rows.map((row) => [row.seat, row.name, row.role, row.status])).toEqual([
      [0, '玩家1', '梅林', '好人'],
      [1, '玩家2', '派西维尔', '好人'],
      [2, '玩家3', '忠臣', '好人'],
      [3, '玩家4', '莫甘娜', '坏人'],
      [4, '玩家5', '刺客', '坏人'],
    ]);
    expect(roster.rows[0]).toMatchObject({ seatTone: 'good', statusTone: 'good', isOut: false });
    expect(roster.rows[4]).toMatchObject({ seatTone: 'evil', statusTone: 'evil', isOut: false });
  });

  it('states the table configuration with the board grouped by side', () => {
    expect(blockOf(build(endedViewModel()), 'facts').items).toEqual([
      { label: '投票', value: '暗投' },
      { label: '否决上限', value: '5' },
      { label: '任务人数', value: '2 / 3 / 2 / 3 / 3' },
      { label: '湖仙', value: '不启用' },
      { label: '坏人', value: '莫甘娜、刺客' },
      { label: '好人', value: '梅林、派西维尔、忠臣' },
    ]);
    expect(blockOf(build(ladyTableViewModel()), 'facts').items).toEqual([
      { label: '投票', value: '公投' },
      { label: '否决上限', value: '5' },
      { label: '任务人数', value: '3 / 4 / 4 / 5 / 5' },
      { label: '湖仙', value: '启用' },
      { label: '坏人', value: '莫甘娜、刺客、奥伯伦、莫德雷德' },
      { label: '好人', value: '梅林、派西维尔、忠臣 ×4' },
    ]);
  });

  it('groups every started quest: its closing as rail, tag and card count', () => {
    const { groups } = blockOf(build(endedViewModel()), 'groups');
    expect(
      groups.map((group) => ({
        title: group.title,
        railTone: group.railTone,
        tag: group.tag,
        footnote: group.footnote,
      })),
    ).toEqual([
      {
        title: '任务一',
        railTone: 'good',
        tag: { text: '成功', tone: 'good' },
        footnote: '成功牌 ×2 · 失败牌 ×0',
      },
      {
        title: '任务二',
        railTone: 'evil',
        tag: { text: '失败 ×1', tone: 'evil' },
        footnote: '成功牌 ×2 · 失败牌 ×1',
      },
      {
        title: '任务三',
        railTone: 'muted',
        tag: { text: '未完成', tone: 'muted' },
        footnote: '提前刺杀打断，无结算结果',
      },
    ]);
  });

  it('rows each proposal: leader and team medals by side, the tally, the verdict', () => {
    const { groups } = blockOf(build(endedViewModel()), 'groups');
    expect(groups[1]?.rows).toEqual([
      {
        cells: [
          seatMedal(1, 'good'),
          neutral('组队'),
          seatMedal(1, 'good'),
          seatMedal(2, 'good'),
          seatMedal(3, 'evil'),
          neutral('赞成 2 · 反对 3'),
          { kind: 'tag', text: '否决', tone: 'muted' },
        ],
        isDimmed: true,
      },
      {
        cells: [
          seatMedal(2, 'good'),
          neutral('组队'),
          seatMedal(2, 'good'),
          seatMedal(3, 'evil'),
          seatMedal(4, 'evil'),
          neutral('赞成 3 · 反对 2'),
          { kind: 'tag', text: '通过', tone: 'good' },
        ],
        isDimmed: false,
      },
    ]);
  });

  it('closes a veto-ended quest as a failed team-up and tallies abstentions', () => {
    const rejected = proposal(1, [1, 2], { approve: 1, reject: 3, abstain: 1 });
    const vetoed = endedViewModel({
      questResults: [],
      roundHistory: [
        roundRecord(
          1,
          Array.from({ length: 5 }, () => rejected),
          { quest: null, vetoEnded: true },
        ),
      ],
      endReason: 'vetoLimitReached',
      accusedSeat: null,
    });
    const [group] = blockOf(build(vetoed), 'groups').groups;
    expect(group).toMatchObject({
      title: '任务一',
      railTone: 'evil',
      tag: { text: '组队失败', tone: 'evil' },
      footnote: '5 次否决达上限，本轮无任务',
    });
    expect(group?.rows).toHaveLength(5);
    expect(group?.rows[0]?.cells).toContainEqual(neutral('赞成 1 · 反对 3 · 弃权 1'));
    expect(blockOf(build(vetoed), 'stats').items).toContainEqual({ label: '否决', value: '5' });
  });

  it('shows the lady checks on a 9/10-seat table only, with the result and unoccurred reasons', () => {
    const document = build(ladyTableViewModel());
    expect(sectionTitles(document)).toEqual(['全员身份', '本局配置', '湖仙查验', '任务进程']);
    expect(blockOf(document, 'timeline').steps).toEqual([
      {
        title: '任务二',
        tone: 'evil',
        lines: [
          [
            neutral('10 号查验了 7 号（'),
            { kind: 'text', text: '坏人', tone: 'evil' },
            neutral('）'),
          ],
          [neutral('→ 新持有人 7 号')],
        ],
      },
      { title: '任务三', tone: 'muted', lines: [[neutral('未发生（提前刺杀打断）')]] },
      { title: '任务四', tone: 'muted', lines: [[neutral('未发生（任务未开始）')]] },
    ]);
    // Identities are public in the review: the record's holder-only note never appears.
    expect(JSON.stringify(document)).not.toContain('查验结果只给当时持有人看');
    expect(sectionTitles(build(endedViewModel()))).not.toContain('湖仙查验');
  });

  it('names why a lady check never happened after a closing or veto-ended quest', () => {
    const successRound = (round: 2 | 3) =>
      roundRecord(round, [proposal(round, [round, 6, 7, 8], { approve: 6, reject: 4 })], {
        quest: { result: 'success', successCount: 4, failCount: 0 },
        vetoEnded: false,
      });
    // Quest three wins the third quest: the assassination follows, no lady check.
    const assassinated = ladyTableViewModel({
      questResults: ['success', 'success', 'success'],
      roundHistory: [SUCCESS_ROUND_1, successRound(2), successRound(3)],
      endReason: 'assassinationHit',
    });
    const [, afterQuestThree, afterQuestFour] = blockOf(build(assassinated), 'timeline').steps;
    expect(afterQuestThree?.lines).toEqual([[neutral('未发生（本轮结算后即终局，湖仙未进行）')]]);
    expect(afterQuestFour?.lines).toEqual([[neutral('未发生（任务未开始）')]]);
    const rejected = proposal(3, [3, 6, 7, 8], { approve: 4, reject: 6 });
    const vetoed = ladyTableViewModel({
      roundHistory: [
        SUCCESS_ROUND_1,
        FAIL_ROUND_2,
        roundRecord(
          3,
          Array.from({ length: 5 }, () => rejected),
          { quest: null, vetoEnded: true },
        ),
      ],
      endReason: 'vetoLimitReached',
      accusedSeat: null,
    });
    expect(blockOf(build(vetoed), 'timeline').steps[1]?.lines).toEqual([
      [neutral('未发生（否决达上限终局）')],
    ]);
  });

  it('omits the quest process when the assassin struck before any vote settled', () => {
    const document = build(endedViewModel({ questResults: [], roundHistory: [] }));
    expect(sectionTitles(document)).toEqual(['全员身份', '本局配置']);
    expect(blocksOf(document).map((block) => block.kind)).not.toContain('groups');
    expect(blockOf(document, 'stats').items).toContainEqual({ label: '否决', value: '0' });
  });

  it('fails fast on a finished game missing a fact it must have', () => {
    expect(() =>
      build(
        endedViewModel({ seats: seatsFor(['merlin', 'percival', null, 'morgana', 'assassin']) }),
      ),
    ).toThrow('[FAIL-FAST] Avalon review seat 2 has no revealed role');
    expect(() => build(endedViewModel({ winner: null, endReason: null }))).toThrow(
      '[FAIL-FAST] Avalon ended instruction without winner',
    );
    expect(() => build(endedViewModel({ accusedSeat: 7 }))).toThrow(
      '[FAIL-FAST] Avalon review names seat 7 with no revealed role',
    );
    expect(() =>
      build(
        endedViewModel({
          seats: seatsFor(['merlin', 'percival', 'loyalServant', 'morgana', 'minion']),
        }),
      ),
    ).toThrow('[FAIL-FAST] Avalon review has no assassin seat');
  });
});
