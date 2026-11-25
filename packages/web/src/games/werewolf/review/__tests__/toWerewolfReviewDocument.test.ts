/**
 * toWerewolfReviewDocument tests — the werewolf night report as data.
 *
 * The builder hands the shared renderer one document for the room and the
 * share image alike. A night sentence is one untitled timeline step whose
 * text runs join into the sentence; what a seat did carries the actor's
 * faction tone (wolf → evil, god → special, villager → good, third party
 * → highlight), body text stays neutral, and the death count and the
 * death stamps read `out`. The sentences themselves are written by the
 * engine and pinned there; these tests pin the layout and the tones.
 */
import type {
  GameState,
  NightReviewIdentityEntry,
  RoleId,
  WerewolfNightReview,
} from '@game-judge/game-engine/games/werewolf/public';
import { getWerewolfNightReview } from '@game-judge/game-engine/games/werewolf/public';

import { assertReviewDocument } from '@/features/room/review/assertReviewDocument';
import type {
  ReviewBlock,
  ReviewInline,
  ReviewTimelineStep,
  ReviewTone,
  RoomReviewDocument,
} from '@/features/room/review/types';
import { makeSettledNightState } from '@/test-utils/werewolfNightReview';

import { toWerewolfReviewDocument } from '../toWerewolfReviewDocument';

const ROOM_CODE = '1234';
const FOOTER = '仅供裁判及观战者参考 · 本夜报由对局记录自动生成';

type TextRun = Extract<ReviewInline, { readonly kind: 'text' }>;
type HeroBlock = Extract<ReviewBlock, { readonly kind: 'hero' }>;
type TimelineBlock = Extract<ReviewBlock, { readonly kind: 'timeline' }>;
type RosterBlock = Extract<ReviewBlock, { readonly kind: 'roster' }>;

// ─────────────────────────────────────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────────────────────────────────────

/** The document the review contribution builds for a state. */
function documentOf(state: GameState): RoomReviewDocument {
  return toWerewolfReviewDocument({
    review: getWerewolfNightReview(state),
    roomCode: ROOM_CODE,
    gameSequence: state.gameSequence,
  });
}

function identity(seat: number, roleId: RoleId | null, isAlive = true): NightReviewIdentityEntry {
  return { seat, roleId, isEmptySeat: false, isAlive };
}

/** The document for a hand-built review: the sentences are the engine's, pinned there. */
function reviewDocument(review: Partial<WerewolfNightReview>): RoomReviewDocument {
  return toWerewolfReviewDocument({
    review: { bottomCards: [], lines: [], deaths: [], identities: [], ...review },
    roomCode: ROOM_CODE,
    gameSequence: 0,
  });
}

/** The played night with the election fields under test replaced. */
function electionState(
  election: Pick<GameState, 'sheriffElection'> & Partial<Pick<GameState, 'sheriffElectionResult'>>,
): GameState {
  return { ...makeSettledNightState(), ...election };
}

const FIRST_ROUND = {
  round: 'first',
  candidateSeats: [2, 5],
  eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
  ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2, 6: 5 },
  voteCounts: { 2: 4, 5: 2 },
  abstainingSeats: [4],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Blocks
// ─────────────────────────────────────────────────────────────────────────────

function blocksOf(document: RoomReviewDocument): readonly ReviewBlock[] {
  const [page, ...otherPages] = document.pages;
  if (page === undefined || otherPages.length > 0) throw new Error('expected exactly one page');
  return page.blocks;
}

/** The block sequence on one line: kinds, with section titles and roster columns. */
function blockOutline(document: RoomReviewDocument): string[] {
  return blocksOf(document).map((block) => {
    switch (block.kind) {
      case 'section':
        return `section:${block.title}`;
      case 'roster':
        return `roster:${block.columns}`;
      default:
        return block.kind;
    }
  });
}

function heroOf(document: RoomReviewDocument): HeroBlock {
  const hero = blocksOf(document).find((block): block is HeroBlock => block.kind === 'hero');
  if (hero === undefined) throw new Error('expected a hero block');
  return hero;
}

/** The hero headline as it reads: 昨夜 1 人出局, or 昨夜平安夜. */
function headlineOf(document: RoomReviewDocument): string {
  return heroOf(document)
    .headline.map((run) => run.text)
    .join('');
}

function rosterOf(document: RoomReviewDocument): RosterBlock {
  const roster = blocksOf(document).find((block): block is RosterBlock => block.kind === 'roster');
  if (roster === undefined) throw new Error('expected a roster block');
  return roster;
}

/** The timeline printed right under the section with this title. */
function timelineUnder(document: RoomReviewDocument, title: string): TimelineBlock {
  const blocks = blocksOf(document);
  const sectionIndex = blocks.findIndex(
    (block) => block.kind === 'section' && block.title === title,
  );
  const timeline = blocks[sectionIndex + 1];
  if (sectionIndex < 0 || timeline?.kind !== 'timeline') {
    throw new Error(`expected the ${title} section followed by its timeline`);
  }
  return timeline;
}

// ─────────────────────────────────────────────────────────────────────────────
// Night timeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The night's sentences as text runs, in night order. Each sentence is
 * one untitled neutral step holding one line of words: a seat number
 * lives inside the words, never as a medal or a tag on the timeline.
 */
function nightLines(document: RoomReviewDocument): (readonly TextRun[])[] {
  return timelineUnder(document, '第一夜').steps.map((step) => {
    expect(step.title).toBeNull();
    expect(step.tone).toBe('neutral');
    const [line, ...otherLines] = step.lines;
    if (line === undefined || otherLines.length > 0) {
      throw new Error('expected exactly one line per night step');
    }
    return line.map((inline) => {
      if (inline.kind !== 'text') throw new Error(`night sentence carries a ${inline.kind}`);
      return inline;
    });
  });
}

function joinRuns(runs: readonly TextRun[]): string {
  return runs.map((run) => run.text).join('');
}

/** The night's sentences as they read, in night order. */
function nightSentences(document: RoomReviewDocument): string[] {
  return nightLines(document).map((runs) => joinRuns(runs));
}

/** The runs of the night sentence reading exactly this text. */
function sentenceRuns(document: RoomReviewDocument, sentence: string): readonly TextRun[] {
  const runs = nightLines(document).find((line) => joinRuns(line) === sentence);
  if (runs === undefined) throw new Error(`expected the night sentence ${sentence}`);
  return runs;
}

/** The tones of every night run reading exactly this text, in night order. */
function tonesOf(document: RoomReviewDocument, text: string): ReviewTone[] {
  return nightLines(document)
    .flat()
    .filter((run) => run.text === text)
    .map((run) => run.tone);
}

/** The tone of the first night run reading exactly this text (the old segment color). */
function toneOf(document: RoomReviewDocument, text: string): ReviewTone {
  const [tone] = tonesOf(document, text);
  if (tone === undefined) throw new Error(`expected a night run reading ${text}`);
  return tone;
}

//

// ─────────────────────────────────────────────────────────────────────────────
// Printed strings and seats
// ─────────────────────────────────────────────────────────────────────────────

/** A line of words alone reads as one sentence; a line with a medal or a tag does not. */
function sentenceOf(line: readonly ReviewInline[]): string | null {
  let sentence = '';
  for (const inline of line) {
    if (inline.kind !== 'text') return null;
    sentence += inline.text;
  }
  return sentence;
}

/**
 * Every string the document prints, each as its own printed element: the
 * masthead copy, the headline, the stamp lines, section and step titles,
 * every run and tag (plus each sentence of several runs as a whole), and
 * the roster's role and status words. Seats are medals, not strings.
 */
function printedStrings(document: RoomReviewDocument): string[] {
  const strings = [document.kicker, document.footer];
  for (const block of blocksOf(document)) {
    switch (block.kind) {
      case 'hero':
        strings.push(block.headline.map((run) => run.text).join(''));
        for (const stamp of block.stamps) {
          strings.push(stamp.title, stamp.caption);
          if (stamp.note !== null) strings.push(stamp.note);
        }
        break;
      case 'section':
        strings.push(block.title);
        break;
      case 'timeline':
        for (const step of block.steps) {
          if (step.title !== null) strings.push(step.title);
          for (const line of step.lines) {
            for (const inline of line) if (inline.kind !== 'seat') strings.push(inline.text);
            const sentence = sentenceOf(line);
            if (line.length > 1 && sentence !== null) strings.push(sentence);
          }
        }
        break;
      case 'roster':
        for (const row of block.rows) strings.push(row.role, row.status);
        break;
      case 'divider':
        break;
      default:
        throw new Error(`unexpected ${block.kind} block in the werewolf report`);
    }
  }
  return strings;
}

/** How many printed elements read exactly this text (the old getAllByText count). */
function countPrinted(document: RoomReviewDocument, text: string): number {
  return printedStrings(document).filter((printed) => printed === text).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheriff timeline
// ─────────────────────────────────────────────────────────────────────────────

function sheriffSteps(document: RoomReviewDocument): readonly ReviewTimelineStep[] {
  return timelineUnder(document, '警长竞选').steps;
}

function stepNamed(steps: readonly ReviewTimelineStep[], title: string): ReviewTimelineStep {
  const step = steps.find((candidate) => candidate.title === title);
  if (step === undefined) throw new Error(`expected a ${title} step`);
  return step;
}

/**
 * A line as readable tokens: text as is, a seat as its display number
 * (tone suffixed unless neutral), a tag in brackets.
 */
function lineTokens(line: readonly ReviewInline[]): string[] {
  return line.map((inline) => {
    switch (inline.kind) {
      case 'text':
        return inline.text;
      case 'seat':
        return `${inline.seat + 1}${inline.tone === 'neutral' ? '' : `:${inline.tone}`}`;
      case 'tag':
        return `[${inline.text}]`;
    }
  });
}

//

// ─────────────────────────────────────────────────────────────────────────────

describe('toWerewolfReviewDocument', () => {
  describe('document', () => {
    it('is one valid page titled 本局复盘, shared as the room 战报', () => {
      const document = documentOf(makeSettledNightState({ gameSequence: 2 }));

      expect(() => assertReviewDocument(document)).not.toThrow();
      expect(document).toMatchObject({
        kicker: '🌙 第一夜 · 夜报',
        fileStem: 'werewolf-1234-3',
        footer: FOOTER,
      });
      expect(document.pages.map((page) => ({ key: page.key, label: page.label }))).toEqual([
        { key: 'night-1', label: null },
      ]);
    });

    it('moves the round key and the file stem with the game sequence', () => {
      const first = documentOf(makeSettledNightState());
      const rebuilt = documentOf(makeSettledNightState());
      const next = documentOf(makeSettledNightState({ gameSequence: 1 }));

      expect(rebuilt.roundKey).toBe(first.roundKey);
      expect(next.roundKey).not.toBe(first.roundKey);
      expect(first.fileStem).toBe('werewolf-1234-1');
      expect(next.fileStem).toBe('werewolf-1234-2');
    });

    it('orders the blocks: hero, the night, the perforation, the identity wall', () => {
      expect(blockOutline(documentOf(makeSettledNightState()))).toEqual([
        'hero',
        'section:第一夜',
        'timeline',
        'divider',
        'section:全员身份',
        'roster:2',
      ]);
    });

    it('places the sheriff election between the night and the perforation', () => {
      const document = documentOf(
        electionState({
          sheriffElection: {
            phase: 'registration',
            registeredSeats: [1, 2],
            withdrawnSeats: [],
            completedRounds: [],
          },
        }),
      );

      expect(blockOutline(document)).toEqual([
        'hero',
        'section:第一夜',
        'timeline',
        'section:警长竞选',
        'timeline',
        'divider',
        'section:全员身份',
        'roster:2',
      ]);
    });
  });

  describe('night report', () => {
    it('prints a played night in night order with the outcome last', () => {
      const document = documentOf(makeSettledNightState());

      expect(nightSentences(document)).toEqual([
        '2号守卫未守护。',
        '狼队（1号）袭击5号。',
        '3号女巫未用解药。',
        '3号女巫未毒杀。',
        '4号预言家未查验。',
        '5号出局。',
      ]);
      expect(headlineOf(document)).toBe('昨夜 1 人出局');
      expect(heroOf(document).stamps).toEqual([
        { seat: 4, tone: 'out', title: '平民', caption: '狼杀出局', note: '狼队 1 票锁定' },
      ]);
    });

    it('lists every seat on the identity wall with exactly one out seat', () => {
      const rows = rosterOf(documentOf(makeSettledNightState())).rows;

      expect(rows.map((row) => `${row.seat + 1}:${row.role}:${row.status}`)).toEqual([
        '1:狼人:存活',
        '2:守卫:存活',
        '3:女巫:存活',
        '4:预言家:存活',
        '5:平民:狼杀出局',
      ]);
      expect(rows.map((row) => row.seatTone)).toEqual([
        'evil',
        'special',
        'special',
        'special',
        'out',
      ]);
      expect(rows.filter((row) => row.isOut).map((row) => row.seat)).toEqual([4]);
    });

    it('gives what a seat did the tone of its faction and leaves the rest neutral', () => {
      const document = reviewDocument({
        identities: [identity(0, 'wolf'), identity(1, 'seer'), identity(2, 'villager')],
        lines: [
          {
            kind: 'action',
            seat: 0,
            roleId: 'wolf',
            subject: '狼人',
            phrase: '袭击3号',
            result: null,
          },
          {
            kind: 'action',
            seat: 1,
            roleId: 'seer',
            subject: '预言家',
            phrase: '查验1号',
            result: '（查验结果：1号是狼人）',
          },
          {
            kind: 'action',
            seat: 2,
            roleId: 'slacker',
            subject: '混血儿',
            phrase: '选1号为榜样',
            result: null,
          },
          { kind: 'explanation', text: '3号感染失败' },
        ],
      });

      expect(nightSentences(document)).toEqual([
        '1号狼人袭击3号。',
        '2号预言家查验1号（查验结果：1号是狼人）。',
        '3号混血儿选1号为榜样。',
        '3号感染失败。',
        '本夜无人出局。',
      ]);
      expect(toneOf(document, '袭击3号')).toBe('evil');
      expect(toneOf(document, '查验1号')).toBe('special');
      expect(toneOf(document, '选1号为榜样')).toBe('highlight');
      expect(
        sentenceRuns(document, '2号预言家查验1号（查验结果：1号是狼人）。').map((run) => run.tone),
      ).toEqual(['neutral', 'special', 'neutral']);
      expect(toneOf(document, '3号感染失败。')).toBe('neutral');
    });

    it('prints the bottom cards first, each in its faction tone', () => {
      const document = reviewDocument({
        bottomCards: ['villager', 'seer', 'wolf'],
        identities: [identity(0, 'thief')],
        lines: [
          {
            kind: 'action',
            seat: 0,
            roleId: 'thief',
            subject: '盗贼',
            phrase: '选择底牌',
            result: '（选择的身份：预言家）',
          },
        ],
      });

      expect(nightSentences(document)).toEqual([
        '底牌：平民、预言家、狼人。',
        '1号盗贼选择底牌（选择的身份：预言家）。',
        '本夜无人出局。',
      ]);
      expect(toneOf(document, '平民')).toBe('good');
      expect(toneOf(document, '预言家')).toBe('special');
      expect(toneOf(document, '狼人')).toBe('evil');
    });

    it('reads a peaceful night in the headline and the last sentence', () => {
      const document = reviewDocument({ identities: [identity(0, 'villager')] });

      expect(headlineOf(document)).toBe('昨夜平安夜');
      expect(heroOf(document).stamps).toEqual([]);
      expect(nightSentences(document)).toEqual(['本夜无人出局。']);
    });

    it('joins several deaths in one sentence, each seat in its own faction tone', () => {
      const document = reviewDocument({
        identities: [
          identity(0, 'wolf', false),
          identity(1, 'seer', false),
          identity(2, 'villager', false),
        ],
        deaths: [
          { seat: 0, reason: 'poison', note: { kind: 'poisonedBy', actorRoleId: 'witch' } },
          { seat: 1, reason: 'wolfKill', note: { kind: 'wolfVotes', votes: 3 } },
          { seat: 2, reason: null, note: null },
        ],
      });

      expect(nightSentences(document)).toEqual(['1号、2号和3号出局。']);
      expect([toneOf(document, '1号'), toneOf(document, '2号'), toneOf(document, '3号')]).toEqual([
        'evil',
        'special',
        'good',
      ]);
      expect(headlineOf(document)).toBe('昨夜 3 人出局');
      expect(heroOf(document).stamps.map((stamp) => [stamp.caption, stamp.note])).toEqual([
        ['毒杀出局', '女巫下毒'],
        ['狼杀出局', '狼队 3 票锁定'],
        ['出局', null],
      ]);
      expect(rosterOf(document).rows.map((row) => row.status)).toEqual([
        '毒杀出局',
        '狼杀出局',
        '已出局',
      ]);
    });

    it('names an empty seat and an undealt seat on the identity wall', () => {
      const document = reviewDocument({
        identities: [
          { seat: 0, roleId: null, isEmptySeat: true, isAlive: true },
          identity(1, null),
        ],
      });

      expect(rosterOf(document).rows.map((row) => [row.role, row.seatTone])).toEqual([
        ['空座', 'neutral'],
        ['未分配', 'neutral'],
      ]);
    });
  });

  describe('sheriff card', () => {
    it('renders the full public record for a completed election', () => {
      const document = documentOf(
        electionState({
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [2, 5],
            withdrawnSeats: [],
            completedRounds: [FIRST_ROUND],
          },
          sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
        }),
      );
      const steps = sheriffSteps(document);

      // The section title is the one 警长竞选 (the panel's own header went
      // with the panel); the phase step heads the record, the outcome
      // step follows, and the records collapse to the 上警 step because
      // every registered seat is still standing (no 参选 / 候选 step).
      expect(countPrinted(document, '警长竞选')).toBe(1);
      expect(steps.map((step) => step.title)).toEqual([
        '竞选结束',
        '当选警长',
        '上警',
        '首轮投票结果',
      ]);
      expect(stepNamed(steps, '竞选结束').lines.map(lineTokens)).toEqual([
        ['报名、退水与每轮投票结果均已公开并保留'],
      ]);
      // The outcome (3号 · 当选警长): the sheriff's medal, then how the
      // badge was won.
      expect(stepNamed(steps, '当选警长').tone).toBe('highlight');
      expect(stepNamed(steps, '当选警长').lines.map(lineTokens)).toEqual([
        ['3:highlight', '首轮投票当选 · 警徽在 3号'],
      ]);
      expect(stepNamed(steps, '上警').lines.map(lineTokens)).toEqual([['3', '6']]);
      // The tally: each candidate's count (4 票, 2 票) ahead of its voters,
      // the abstention (弃票) on its own line.
      expect(stepNamed(steps, '首轮投票结果').lines.map(lineTokens)).toEqual([
        ['3:highlight', '4 票：', '1', '2', '4', '6', '[当选]'],
        ['6', '2 票：', '3', '7'],
        ['弃票：', '5:muted'],
      ]);
    });

    it('renders registration as status only — no seats, no counts', () => {
      const document = documentOf(
        electionState({
          sheriffElection: {
            phase: 'registration',
            registeredSeats: [1, 2],
            withdrawnSeats: [],
            completedRounds: [],
          },
        }),
      );

      // The registration phase step only — no records step, no seats, no
      // counts, for anyone.
      expect(sheriffSteps(document)).toEqual([
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
      // Nothing else prints before the identity appendix.
      const outline = blockOutline(document);
      expect(outline.slice(outline.indexOf('section:警长竞选'))).toEqual([
        'section:警长竞选',
        'timeline',
        'divider',
        'section:全员身份',
        'roster:2',
      ]);
    });

    it('renders an in-progress vote with progress counts and pending seats — ballot targets never surface', () => {
      const document = documentOf(
        electionState({
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
      const steps = sheriffSteps(document);

      // The phase step, the public registration and the progress step.
      // Only the submission count and the pending seats surface (2 of 7,
      // seats 3–7 still to vote); ballot targets never appear as tally
      // lines, voter medals, or per-candidate counts.
      expect(steps.map((step) => step.title)).toEqual(['首轮投票', '上警', '投票进度']);
      expect(stepNamed(steps, '投票进度').lines.map(lineTokens)).toEqual([
        ['2/7 已提交'],
        ['未投票：3号 4号 5号 6号 7号'],
      ]);
      expect(stepNamed(steps, '上警').lines.map(lineTokens)).toEqual([['3', '6']]);
      const inlines = steps.flatMap((step) => step.lines.flat());
      expect(inlines.flatMap((inline) => (inline.kind === 'seat' ? [inline.seat] : []))).toEqual([
        2, 5,
      ]);
      const words = inlines.flatMap((inline) => (inline.kind === 'seat' ? [] : [inline.text]));
      expect(words.filter((word) => /\d+ 票/.test(word))).toEqual([]);
      expect(words.filter((word) => word.startsWith('弃票'))).toEqual([]);
    });
  });
});
