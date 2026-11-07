/**
 * toWerewolfReviewDocument tests — the werewolf night report as data.
 *
 * The report used to be a werewolf React body whose suites
 * (NightReviewModal, NightReviewShareCard, nightReviewLayout) read
 * sentences and colors off the rendered tree. The builder now hands the
 * shared renderer one document for the room and the share image alike,
 * so every case is ported here as an assertion on that document. A night
 * sentence is one untitled timeline step whose text runs join into the
 * sentence; an old segment color is the run's semantic tone (wolf → evil,
 * god → special, villager → good, third party → highlight, body text →
 * neutral), and the death count and the death stamps read `out`. The
 * modal shell (testID, close button, scrolling) belongs to the platform
 * dialog and has no counterpart here; the sheriff card is a generic
 * timeline, pinned against the panel by sheriffRecordEquivalence.test.ts.
 */
import type {
  GameState,
  NightReviewActionEntry,
  NightReviewIdentityEntry,
  Player,
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
import {
  makeFiveSeatReviewPlayers,
  makeReviewPlayer,
  makeReviewState,
  type ReviewPlayers,
} from '@/test-utils/werewolfNightReview';

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

/** One identity row for a hand-built review fixture (B2: row rendering only). */
function reviewIdentity(
  seat: number,
  roleId: RoleId | null,
  isAlive = true,
): NightReviewIdentityEntry {
  return { seat, roleId, isEmptySeat: false, isAlive };
}

/**
 * The document for a hand-built review: entry construction stays pinned
 * by the engine tests, so these fixtures pin only the sentence each §4
 * row promises (verb, result word, tone) and the outcome entry stays
 * last, matching the engine's emission order.
 */
function reviewDocument(
  actions: readonly NightReviewActionEntry[],
  identities: readonly NightReviewIdentityEntry[],
): RoomReviewDocument {
  const review: WerewolfNightReview = { actions: [...actions], identities: [...identities] };
  return toWerewolfReviewDocument({ review, roomCode: ROOM_CODE, gameSequence: 0 });
}

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

/** Printed strings holding the fragment: a retired form prints nowhere, not even mid-sentence. */
function printedWith(document: RoomReviewDocument, fragment: string): string[] {
  return printedStrings(document).filter((printed) => printed.includes(fragment));
}

/** Every seat the document carries: death stamps, timeline medals, roster medals. */
function seatsOf(document: RoomReviewDocument): number[] {
  return blocksOf(document).flatMap((block) => {
    switch (block.kind) {
      case 'hero':
        return block.stamps.map((stamp) => stamp.seat);
      case 'timeline':
        return block.steps.flatMap((step) =>
          step.lines.flat().flatMap((inline) => (inline.kind === 'seat' ? [inline.seat] : [])),
        );
      case 'roster':
        return block.rows.map((row) => row.seat);
      default:
        return [];
    }
  });
}

/**
 * The -1 abstention sentinel never surfaces as a seat: no medal for seat
 * -1 (it would read 0), no 「0」 or 「0号」 element, and no standalone 0
 * inside a sentence (10号 and 20号 are real seats).
 */
function expectNoSeatZero(document: RoomReviewDocument): void {
  expect(seatsOf(document).filter((seat) => seat < 0)).toEqual([]);
  const strings = printedStrings(document);
  expect(strings).not.toContain('0');
  expect(strings).not.toContain('0号');
  expect(strings.filter((printed) => /(^|\D)0(?!\d)/.test(printed))).toEqual([]);
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

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function composedNightState(): GameState {
  return makeReviewState({
    players: makeFiveSeatReviewPlayers(),
    currentNightResults: {
      wolfVotesBySeat: { '0': 4 },
      guardedSeat: 3,
      savedSeat: 4,
    },
    seerReveal: { targetSeat: 0, result: '狼人' },
    lastNightDeaths: [4],
    deathReasons: { 4: 'wolfKill' },
    resolvedWolfKillTarget: 4,
    resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 4 },
  });
}

const FIRST_ROUND = {
  round: 'first',
  candidateSeats: [2, 5],
  eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
  ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2, 6: 5 },
  voteCounts: { 2: 4, 5: 2 },
  abstainingSeats: [4],
} as const;

function sevenVillagers(): ReviewPlayers {
  return new Map(
    [0, 1, 2, 3, 4, 5, 6].map((seat) => [seat, makeReviewPlayer(seat, 'villager')] as const),
  );
}

describe('toWerewolfReviewDocument', () => {
  describe('document', () => {
    it('is one valid page titled 本局复盘, shared as the room 战报', () => {
      const document = documentOf({ ...composedNightState(), gameSequence: 2 });

      expect(() => assertReviewDocument(document)).not.toThrow();
      expect(document).toMatchObject({
        kicker: '🌙 第一夜 · 夜报',
        fileStem: 'werewolf-1234-3',
        footer: FOOTER,
        isAborted: false,
      });
      expect(document.pages.map((page) => ({ key: page.key, label: page.label }))).toEqual([
        { key: 'night-1', label: null },
      ]);
    });

    it('moves the round key and the file stem with the game sequence', () => {
      const first = documentOf(composedNightState());
      const rebuilt = documentOf(composedNightState());
      const next = documentOf({ ...composedNightState(), gameSequence: 1 });

      expect(rebuilt.roundKey).toBe(first.roundKey);
      expect(next.roundKey).not.toBe(first.roundKey);
      expect(first.fileStem).toBe('werewolf-1234-1');
      expect(next.fileStem).toBe('werewolf-1234-2');
    });

    it('orders the blocks: hero, the night, the perforation, the identity wall', () => {
      expect(blockOutline(documentOf(composedNightState()))).toEqual([
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
        makeReviewState({
          players: sevenVillagers(),
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
    it('renders the report sections (the modal shell is the platform dialog)', () => {
      const document = documentOf(composedNightState());

      expect(document.kicker).toBe('🌙 第一夜 · 夜报');
      expect(blockOutline(document)).toEqual(
        expect.arrayContaining(['section:第一夜', 'section:全员身份']),
      );
      expect(document.footer).toBe(FOOTER);
      // The timeline form has no day tab, no day block, no stats ledger,
      // no portraits, no ✗, no arrows.
      expect(blockOutline(document)).not.toContain('stats');
      expect(blockOutline(document)).not.toContain('image');
      for (const fragment of ['第一天', '✗', '→', '爪击', '底牌组成']) {
        expect(printedWith(document, fragment)).toEqual([]);
      }
    });

    it('renders every action fact of the composed night', () => {
      const document = documentOf(composedNightState());

      // Conclusion header: headline + death stamp with the derived byline.
      expect(headlineOf(document)).toBe('昨夜 1 人出局');
      expect(heroOf(document)).toEqual({
        kind: 'hero',
        headline: [
          { kind: 'text', text: '昨夜 ' },
          { kind: 'figure', text: '1', tone: 'out' },
          { kind: 'text', text: ' 人出局' },
        ],
        tone: 'neutral',
        stamps: [
          { seat: 4, tone: 'out', title: '平民', caption: '狼杀出局', note: '狼队 1 票锁定' },
        ],
        byline: null,
      });
      // 狼杀出局 prints twice: the death stamp and the roster status.
      expect(countPrinted(document, '狼杀出局')).toBe(2);
      // Timeline: one sentence per action, in night order, then the
      // outcome sentence last.
      expect(nightSentences(document)).toEqual([
        '狼队（1号）袭击5号。',
        '2号守卫守护4号。',
        '3号女巫使用解药救起5号。毒药未使用。',
        '4号预言家查验1号，结果：狼人。',
        '5号出局。',
      ]);
      // 狼人 prints twice: the check result word and the roster role.
      expect(countPrinted(document, '狼人')).toBe(2);
      // Tones: verbs by the actor's faction, the check result by the
      // result role's faction, the dead seat by the dead player's faction.
      expect(toneOf(document, '袭击5号')).toBe('evil');
      expect(toneOf(document, '守护')).toBe('special');
      expect(toneOf(document, '使用解药救起5号')).toBe('special');
      expect(toneOf(document, '查验')).toBe('special');
      expect(toneOf(document, '狼人')).toBe('evil');
      expect(toneOf(document, '5号')).toBe('good');
      // Number discipline: no ✗, no arrow, no 死亡 anywhere.
      for (const fragment of ['✗', '→', '死亡']) {
        expect(printedWith(document, fragment)).toEqual([]);
      }
    });

    it('renders the full identity wall with exactly one out seat', () => {
      const document = documentOf(composedNightState());

      // Seat order, faction medals for the living, the one out seat
      // stamped out with its cause.
      expect(rosterOf(document)).toEqual({
        kind: 'roster',
        columns: 2,
        rows: [
          {
            seat: 0,
            seatTone: 'evil',
            name: null,
            role: '狼人',
            status: '存活',
            statusTone: 'muted',
            isOut: false,
          },
          {
            seat: 1,
            seatTone: 'special',
            name: null,
            role: '守卫',
            status: '存活',
            statusTone: 'muted',
            isOut: false,
          },
          {
            seat: 2,
            seatTone: 'special',
            name: null,
            role: '女巫',
            status: '存活',
            statusTone: 'muted',
            isOut: false,
          },
          {
            seat: 3,
            seatTone: 'special',
            name: null,
            role: '预言家',
            status: '存活',
            statusTone: 'muted',
            isOut: false,
          },
          {
            seat: 4,
            seatTone: 'out',
            name: null,
            role: '平民',
            status: '狼杀出局',
            statusTone: 'out',
            isOut: true,
          },
        ],
      });
      expect(countPrinted(document, '存活')).toBe(4);
      expect(printedWith(document, '已出局')).toEqual([]);
    });

    it('renders bottom cards and villager identities on the report', () => {
      const players = new Map<number, Player | null>([[0, makeReviewPlayer(0, 'villager')]]);
      const document = documentOf(
        makeReviewState({ players, bottomCards: ['villager', 'seer', 'guard'] }),
      );

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining(['底牌：平民、预言家、守卫。', '本夜无人出局。']),
      );
      // 平民 prints twice: the bottom-cards word and the identity wall.
      expect(countPrinted(document, '平民')).toBe(2);
      expect(countPrinted(document, '存活')).toBe(1);
      expect(toneOf(document, '平民')).toBe('good');
      expect(toneOf(document, '预言家')).toBe('special');
      expect(toneOf(document, '守卫')).toBe('special');
    });

    it('renders a peaceful night and placeholder identities', () => {
      const players = new Map<number, Player | null>([
        [0, null],
        [1, makeReviewPlayer(1, null)],
      ]);
      const document = documentOf(makeReviewState({ players }));

      expect(heroOf(document)).toEqual({
        kind: 'hero',
        headline: [{ kind: 'text', text: '昨夜平安夜' }],
        tone: 'neutral',
        stamps: [],
        byline: null,
      });
      expect(nightSentences(document)).toContain('本夜无人出局。');
      expect(rosterOf(document).rows.map((row) => [row.role, row.seatTone])).toEqual([
        ['空座', 'neutral'],
        ['未分配', 'neutral'],
      ]);
      expect(printedWith(document, '狼杀出局')).toEqual([]);
    });

    it('aggregates wolf votes by target into one team sentence', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'wolf')],
        [2, makeReviewPlayer(2, 'wolf')],
        [3, makeReviewPlayer(3, 'wolf')],
        [4, makeReviewPlayer(4, 'villager')],
        [5, makeReviewPlayer(5, 'seer')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '0': 4, '1': 4, '2': 4, '3': 4 },
          },
          resolvedWolfKillTarget: 4,
          resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 4 },
        }),
      );

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining(['狼队（1、2、3、4号）袭击5号。', '本夜无人出局。']),
      );
      for (const fragment of ['狼队共同目标', '↓', '✗']) {
        expect(printedWith(document, fragment)).toEqual([]);
      }
      expect(toneOf(document, '袭击5号')).toBe('evil');
    });

    it('marks tied split wolf votes without a settlement as tie pending, not as no kill', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'wolf')],
        [4, makeReviewPlayer(4, 'villager')],
        [5, makeReviewPlayer(5, 'villager')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfVotesBySeat: { '0': 5, '1': 4 } },
        }),
      );
      const wolfSentence = '狼队投票不一致（2号投5号、1号投6号），平票，目标未记录。';

      // The vote pairs list in target-group order (most votes first,
      // ties by target seat ascending). No verdict was recorded, so the
      // engine reports tie pending; no resolved target exists, so the
      // verdict phrase and the pairs stay neutral.
      expect(nightSentences(document)).toEqual(
        expect.arrayContaining([wolfSentence, '本夜无人出局。']),
      );
      expect(sentenceRuns(document, wolfSentence).filter((run) => run.tone !== 'neutral')).toEqual(
        [],
      );
      for (const fragment of ['狼队目标不一致 — 平票，未击杀', '狼队共同目标', '✗']) {
        expect(printedWith(document, fragment)).toEqual([]);
      }
    });

    it('marks a tied split wolf vote settled to a kill with the tie-picked verdict', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'wolf')],
        [4, makeReviewPlayer(4, 'villager')],
        [5, makeReviewPlayer(5, 'villager')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfVotesBySeat: { '0': 5, '1': 4 } },
          lastNightDeaths: [5],
          deathReasons: { 5: 'wolfKill' },
          resolvedWolfKillTarget: 5,
          resolvedWolfKillVerdict: { type: 'tiePicked', targetSeat: 5 },
        }),
      );

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining([
          '狼队投票不一致（2号投5号、1号投6号），平票抽中6号。',
          '6号出局。',
        ]),
      );
      expect(printedWith(document, '狼队目标不一致 — 平票，未击杀')).toEqual([]);
      expect(toneOf(document, '平票抽中6号')).toBe('evil');
      expect(toneOf(document, '6号')).toBe('good');
    });

    it('keeps the no-kill verdict only for a tied split vote settled to no kill', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'wolf')],
        [4, makeReviewPlayer(4, 'villager')],
        [5, makeReviewPlayer(5, 'villager')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfVotesBySeat: { '0': 5, '1': 4 } },
          resolvedWolfKillTarget: null,
          resolvedWolfKillVerdict: { type: 'splitTied' },
        }),
      );

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining([
          '狼队投票不一致（2号投5号、1号投6号），平票，未击杀。',
          '本夜无人出局。',
        ]),
      );
      expect(printedWith(document, '✗')).toEqual([]);
    });

    it('merges the witch poison and unused antidote into one sentence', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'villager')],
        [2, makeReviewPlayer(2, 'witch')],
        [3, makeReviewPlayer(3, 'villager')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfVotesBySeat: { '0': 1 }, poisonedSeat: 3 },
          lastNightDeaths: [3],
          deathReasons: { 3: 'poison' },
          resolvedWolfKillTarget: 1,
          resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 1 },
        }),
      );

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining([
          '狼队（1号）袭击2号。',
          '3号女巫毒杀4号。解药未使用。',
          '4号出局。',
        ]),
      );
      // Death stamp note names the poison owner.
      expect(heroOf(document).stamps).toEqual([
        { seat: 3, tone: 'out', title: '平民', caption: '毒杀出局', note: '女巫下毒' },
      ]);
      expect(countPrinted(document, '女巫下毒')).toBe(1);
      expect(countPrinted(document, '毒杀出局')).toBe(2);
      // The unused antidote is plain words in the same sentence — no ✗,
      // no separate note, no derived "wolf target not saved" note.
      expect(countPrinted(document, '解药未使用。')).toBe(1);
      for (const fragment of ['目标出局', '狼刀目标未救', '✗', '女巫未使用解药']) {
        expect(printedWith(document, fragment)).toEqual([]);
      }
      expect(toneOf(document, '毒杀4号')).toBe('special');
      expect(toneOf(document, '解药未使用。')).toBe('neutral');
    });

    it('renders the screenshot night: split votes, one abstention, seat identities', () => {
      // The user-reported night (room 2219), seats 0-based: wolves on seats
      // 7/8/9/12号 vote 6号 + 5号, 12号 abstains; the witch poisons 12号 (a
      // wolf), the seer checks 5号, the hunter sits on 3号.
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'villager')],
        [1, makeReviewPlayer(1, 'villager')],
        [2, makeReviewPlayer(2, 'hunter')],
        [3, makeReviewPlayer(3, 'seer')],
        [4, makeReviewPlayer(4, 'villager')],
        [5, makeReviewPlayer(5, 'villager')],
        [6, makeReviewPlayer(6, 'wolf')],
        [7, makeReviewPlayer(7, 'wolf')],
        [8, makeReviewPlayer(8, 'wolf')],
        [9, makeReviewPlayer(9, 'witch')],
        [10, makeReviewPlayer(10, 'villager')],
        [11, makeReviewPlayer(11, 'wolf')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '6': 5, '7': 5, '8': 4, '11': -1 },
            poisonedSeat: 11,
          },
          seerReveal: { targetSeat: 4, result: '好人' },
          lastNightDeaths: [5, 11],
          deathReasons: { 5: 'wolfKill', 11: 'poison' },
          resolvedWolfKillTarget: 5,
          resolvedWolfKillVerdict: { type: 'splitKilled', targetSeat: 5 },
        }),
      );

      // Conclusion header: both deaths, derived bylines.
      expect(headlineOf(document)).toBe('昨夜 2 人出局');
      expect(heroOf(document).stamps).toEqual([
        { seat: 5, tone: 'out', title: '平民', caption: '狼杀出局', note: '狼队 2 票锁定' },
        { seat: 11, tone: 'out', title: '狼人', caption: '毒杀出局', note: '女巫下毒' },
      ]);
      // Timeline sentences in night order.
      expect(nightSentences(document)).toEqual([
        '狼队投票不一致（7号投6号、8号投6号、9号投5号），按多数票击杀6号。',
        '10号女巫毒杀12号。解药未使用。',
        '4号预言家查验5号，结果：好人。',
        '3号猎人可以发动。',
        '6号和12号出局。',
      ]);
      // The partial abstention is not named anywhere on the page, and the
      // -1 abstention sentinel never surfaces as a seat.
      expect(printedWith(document, '空刀')).toEqual([]);
      expectNoSeatZero(document);
      // Tones: the resolved kill phrase by the wolf faction, the poison
      // by the witch's faction, the check verb by the seer's faction, the
      // 好人 result neutral, the determination by the hunter's faction,
      // and each dead seat by that player's faction.
      expect(toneOf(document, '按多数票击杀6号')).toBe('evil');
      expect(toneOf(document, '毒杀12号')).toBe('special');
      expect(toneOf(document, '查验')).toBe('special');
      expect(toneOf(document, '好人')).toBe('neutral');
      expect(toneOf(document, '可以发动')).toBe('special');
      expect(toneOf(document, '6号')).toBe('good');
      expect(toneOf(document, '12号')).toBe('evil');
      // Hunter: the seat lives inside the sentence only — no （3号） text.
      expect(printedWith(document, '（3号）')).toEqual([]);
      expect(printedStrings(document)).not.toContain('3号');
      // Identity wall statuses (each death cause also prints on its stamp).
      expect(countPrinted(document, '存活')).toBe(10);
      expect(countPrinted(document, '狼杀出局')).toBe(2);
      expect(countPrinted(document, '毒杀出局')).toBe(2);
      // No idle entries this night: no strip.
      expect(printedWith(document, '未行动')).toEqual([]);
    });

    it('renders an all-abstain wolf night with only the abstain sentence', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'wolf')],
        [2, makeReviewPlayer(2, 'villager')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfVotesBySeat: { '0': -1, '1': -1 } },
          resolvedWolfKillTarget: null,
          resolvedWolfKillVerdict: { type: 'allAbstain' },
        }),
      );

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining(['狼队全员空刀。', '本夜无人出局。']),
      );
      for (const fragment of ['狼队共同目标', '狼队目标不一致 — 按多数票击杀', '✗']) {
        expect(printedWith(document, fragment)).toEqual([]);
      }
      expectNoSeatZero(document);
    });

    it('renders idle actors as plain sentences in night order', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'guard')],
        [3, makeReviewPlayer(3, 'seer')],
        [4, makeReviewPlayer(4, 'villager')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfVotesBySeat: { '0': 4 } },
        }),
      );

      // The guard never guarded and the seer never checked: each is a
      // sentence carrying its phrase; the order on the page is the
      // engine's summary order (wolf, then guard, then seer), with no
      // faction regrouping. No verdict was recorded for the single wolf
      // vote, so the engine reports tie pending.
      expect(nightSentences(document)).toEqual([
        '狼队投票不一致（1号投5号），平票，目标未记录。',
        '2号守卫未守护。',
        '4号预言家未查验。',
        '本夜无人出局。',
      ]);
      expect(printedWith(document, '未行动')).toEqual([]);
      // The night timeline sits under 第一夜, ahead of the 全员身份 appendix.
      const outline = blockOutline(document);
      expect(outline.indexOf('section:第一夜') + 1).toBeLessThan(
        outline.indexOf('section:全员身份'),
      );
    });

    it('renders idle confirmations and unused potions as sentences', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'hiddenWolf')],
        [1, makeReviewPlayer(1, 'avenger')],
        [2, makeReviewPlayer(2, 'witch')],
        [3, makeReviewPlayer(3, 'poisoner')],
        [4, makeReviewPlayer(4, 'wolfRobot')],
        [5, makeReviewPlayer(5, 'villager')],
      ]);
      const document = documentOf(makeReviewState({ players }));

      // Knowledge confirmations are sentences, not absences; the witch
      // used no antidote and the poisoner did not poison, so both read
      // as unused-potion sentences. The wolf team recorded no vote.
      expect(nightSentences(document)).toEqual(
        expect.arrayContaining([
          '狼队未选择目标。',
          '1号隐狼已确认狼同伴。',
          '2号复仇者已确认阵营。',
          '3号女巫未使用解药。',
          '4号毒师未使用毒药。',
          '5号机械狼人未学习。',
          '本夜无人出局。',
        ]),
      );
      for (const fragment of ['✗', '未行动']) {
        expect(printedWith(document, fragment)).toEqual([]);
      }
      // The confirmation phrases carry the actor's faction tone; the
      // unused-potion sentences stay neutral.
      expect(toneOf(document, '已确认狼同伴')).toBe('evil');
      expect(toneOf(document, '已确认阵营')).toBe('highlight');
      expect(toneOf(document, '未使用解药')).toBe('neutral');
      expect(toneOf(document, '未使用毒药')).toBe('neutral');
    });

    it('names an identity-family check result with the Chinese role name', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'villager')],
        [4, makeReviewPlayer(4, 'psychic')],
        [9, makeReviewPlayer(9, 'villager')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          psychicReveal: { targetSeat: 9, result: 'villager' },
        }),
      );

      expect(nightSentences(document)).toContain('5号通灵师查验10号，结果：平民。');
      // 平民 prints three times: the check result word on the timeline and
      // the two villager rows on the identity wall.
      expect(countPrinted(document, '平民')).toBe(3);
      expect(tonesOf(document, '平民')).toHaveLength(1);
      expect(rosterOf(document).rows.filter((row) => row.role === '平民')).toHaveLength(2);
      expect(countPrinted(document, '查验')).toBe(1);
      expect(printedWith(document, 'villager')).toEqual([]);
      expect(toneOf(document, '查验')).toBe('special');
      expect(toneOf(document, '平民')).toBe('good');
    });

    it('shows a faction check as a faction word only, never the target identity', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'witch')],
        [3, makeReviewPlayer(3, 'seer')],
        [4, makeReviewPlayer(4, 'villager')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          seerReveal: { targetSeat: 0, result: '狼人' },
        }),
      );

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining(['4号预言家查验1号，结果：狼人。', '1号女巫未使用药水。']),
      );
      // 女巫 prints once as a word of its own — the identity wall row.
      // The idle sentence carries it inside "1号女巫", and the check
      // sentence never names the target's role.
      expect(countPrinted(document, '女巫')).toBe(1);
      expect(rosterOf(document).rows.map((row) => row.role)).toContain('女巫');
      expect(printedWith(document, 'villager')).toEqual([]);
      expect(toneOf(document, '查验')).toBe('special');
      expect(toneOf(document, '狼人')).toBe('evil');
    });

    it('moves the learned role into the sentence as a result word', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolfRobot')],
        [1, makeReviewPlayer(1, 'witch')],
        [2, makeReviewPlayer(2, 'villager')],
        [3, makeReviewPlayer(3, 'wolf')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfVotesBySeat: { '3': 2 }, savedSeat: 2 },
          wolfRobotReveal: { targetSeat: 1, result: '女巫', learnedRoleId: 'witch' },
          lastNightDeaths: [],
          resolvedWolfKillTarget: 2,
          resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 2 },
        }),
      );

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining([
          '狼队（4号）袭击3号。',
          '2号女巫使用解药救起3号。毒药未使用。',
          '1号机械狼人学习2号，学到身份：女巫。',
          '本夜无人出局。',
        ]),
      );
      // 女巫 prints twice: the learned-role word and the identity wall.
      expect(countPrinted(document, '女巫')).toBe(2);
      expect(printedWith(document, '（女巫）')).toEqual([]);
      expect(toneOf(document, '学习')).toBe('evil');
      expect(toneOf(document, '女巫')).toBe('special');
    });

    it('renders the hunter determination in both states', () => {
      const canShoot = documentOf(
        makeReviewState({
          players: new Map<number, Player | null>([
            [0, makeReviewPlayer(0, 'wolf')],
            [2, makeReviewPlayer(2, 'hunter')],
            [4, makeReviewPlayer(4, 'villager')],
          ]),
          currentNightResults: { wolfVotesBySeat: { '0': 4 } },
        }),
      );
      expect(nightSentences(canShoot)).toContain('3号猎人可以发动。');
      expect(nightSentences(canShoot)).not.toContain('3号猎人不能发动。');
      expect(toneOf(canShoot, '可以发动')).toBe('special');

      const cannotShoot = documentOf(
        makeReviewState({
          players: new Map<number, Player | null>([
            [0, makeReviewPlayer(0, 'wolf')],
            [1, makeReviewPlayer(1, 'witch')],
            [2, makeReviewPlayer(2, 'hunter')],
            [4, makeReviewPlayer(4, 'villager')],
          ]),
          currentNightResults: { wolfVotesBySeat: { '0': 4 }, poisonedSeat: 2 },
        }),
      );
      expect(nightSentences(cannotShoot)).toContain('3号猎人不能发动。');
      expect(nightSentences(cannotShoot)).not.toContain('3号猎人可以发动。');
      expect(toneOf(cannotShoot, '不能发动')).toBe('neutral');
    });

    it('lists the wolf vote pairs in target-group order for a split kill', () => {
      const players = new Map<number, Player | null>([
        [4, makeReviewPlayer(4, 'villager')],
        [5, makeReviewPlayer(5, 'villager')],
        [6, makeReviewPlayer(6, 'wolf')],
        [7, makeReviewPlayer(7, 'wolf')],
        [8, makeReviewPlayer(8, 'wolf')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfVotesBySeat: { '6': 5, '7': 5, '8': 4 } },
          lastNightDeaths: [5],
          deathReasons: { 5: 'wolfKill' },
          resolvedWolfKillTarget: 5,
          resolvedWolfKillVerdict: { type: 'splitKilled', targetSeat: 5 },
        }),
      );

      // The vote pairs list in target-group order: the two-voter group
      // first (most votes, target seat ascending on ties), then the
      // one-voter group, then the verdict phrase — no diagram, no arrow.
      expect(nightSentences(document)).toEqual(
        expect.arrayContaining([
          '狼队投票不一致（7号投6号、8号投6号、9号投5号），按多数票击杀6号。',
          '6号出局。',
        ]),
      );
      expect(printedWith(document, '↓')).toEqual([]);
      expect(toneOf(document, '按多数票击杀6号')).toBe('evil');
    });

    it('renders the warning rows: same-guard-same-save, poison immunity, reflection', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'guard')],
        [2, makeReviewPlayer(2, 'witch')],
        [3, makeReviewPlayer(3, 'villager')],
        [4, makeReviewPlayer(4, 'dancer')],
        [5, makeReviewPlayer(5, 'seer')],
        [6, makeReviewPlayer(6, 'spiritKnight')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '0': 3 },
            guardedSeat: 3,
            savedSeat: 3,
            poisonedSeat: 4,
          },
          seerReveal: { targetSeat: 6, result: '狼人' },
          lastNightDeaths: [3],
          deathReasons: { 3: 'wolfKill' },
          resolvedWolfKillTarget: 3,
          resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 3 },
        }),
      );

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining([
          '4号同守同救，仍然死亡。',
          '5号舞者免疫毒药。',
          '6号预言家查验7号，反伤。',
        ]),
      );
      // 查验 prints twice: the seer check row and the reflection row.
      expect(countPrinted(document, '查验')).toBe(2);
      expect(toneOf(document, '4号同守同救，仍然死亡。')).toBe('neutral');
      expect(toneOf(document, '舞者')).toBe('special');
      expect(toneOf(document, '7号，反伤。')).toBe('neutral');
    });

    it('renders both wolf give-up reasons', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'villager')],
      ]);
      const overrideUi = {
        promptTitle: 't',
        promptMessage: 'm',
        emptyVoteText: 'e',
        rejectMessage: 'r',
      };
      const poisonerPresent = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfKillOverride: { source: 'poisoner', ui: overrideUi } },
        }),
      );
      expect(nightSentences(poisonerPresent)).toContain('狼队放弃袭击，毒师在场。');
      expect(printedWith(poisonerPresent, '✗')).toEqual([]);

      const nightmareBlocked = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfKillOverride: { source: 'nightmare', ui: overrideUi } },
        }),
      );
      expect(nightSentences(nightmareBlocked)).toContain('狼队放弃袭击，被噩梦之影封锁。');
      expect(printedWith(nightmareBlocked, '✗')).toEqual([]);
    });

    it('renders an abstaining wolf night under a poisoner override as one give-up sentence', () => {
      // Room 8257, first night: poisoner present, both wolves recorded
      // empty votes (-1) and the settled verdict is null (override).
      // The wolf team's only line is the give-up sentence; the
      // abstentions must not render as an inconsistent vote / tie.
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'guard')],
        [1, makeReviewPlayer(1, 'wolf')],
        [2, makeReviewPlayer(2, 'wolf')],
        [3, makeReviewPlayer(3, 'villager')],
        [4, makeReviewPlayer(4, 'villager')],
        [5, makeReviewPlayer(5, 'wolfGirl')],
        [6, makeReviewPlayer(6, 'poisoner')],
        [7, makeReviewPlayer(7, 'villager')],
        [8, makeReviewPlayer(8, 'hunter')],
        [9, makeReviewPlayer(9, 'villager')],
        [10, makeReviewPlayer(10, 'villager')],
        [11, makeReviewPlayer(11, 'seer')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '1': -1, '2': -1 },
            wolfKillOverride: {
              source: 'poisoner',
              ui: {
                promptTitle: 't',
                promptMessage: 'm',
                emptyVoteText: 'e',
                rejectMessage: 'r',
              },
            },
          },
          resolvedWolfKillTarget: null,
          resolvedWolfKillVerdict: null,
        }),
      );

      const sentences = nightSentences(document);
      expect(sentences.filter((sentence) => sentence.startsWith('狼队'))).toEqual([
        '狼队放弃袭击，毒师在场。',
      ]);
      expect(sentences.filter((sentence) => sentence.includes('投票不一致'))).toEqual([]);
      expect(sentences).toContain('本夜无人出局。');
    });

    it('renders every idle phrase in one quiet night', () => {
      const roles: RoleId[] = [
        'nightmare',
        'eclipseWolfQueen',
        'guard',
        'silenceElder',
        'votebanElder',
        'crow',
        'dreamcatcher',
        'magician',
        'wolfQueen',
        'piper',
        'seedWolf',
        'witch',
        'seer',
        'wolfRobot',
        'hiddenWolf',
        'avenger',
      ];
      const players = new Map<number, Player | null>(
        roles.map((role, seat) => [seat, makeReviewPlayer(seat, role)] as const),
      );
      const document = documentOf(makeReviewState({ players }));

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining([
          '狼队未选择目标。',
          '1号噩梦之影未封锁。',
          '2号蚀时狼妃未庇护。',
          '3号守卫未守护。',
          '4号禁言长老未禁言。',
          '5号禁票长老未禁票。',
          '6号乌鸦未诅咒。',
          '7号摄梦人未摄梦。',
          '8号魔术师未交换。',
          '9号狼美人未魅惑。',
          '10号吹笛者未催眠。',
          '11号种狼未使用感染。',
          '12号女巫未使用药水。',
          '13号预言家未查验。',
          '14号机械狼人未学习。',
          '15号隐狼已确认狼同伴。',
          '16号复仇者已确认阵营。',
          '本夜无人出局。',
        ]),
      );
    });
  });

  describe('sheriff card', () => {
    it('renders the full public record for a completed election', () => {
      const document = documentOf(
        makeReviewState({
          players: sevenVillagers(),
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
        makeReviewState({
          players: sevenVillagers(),
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

    it('renders an in-progress vote with progress counts only — ballot targets never surface', () => {
      const document = documentOf(
        makeReviewState({
          players: sevenVillagers(),
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
      // Only the submission count surfaces (2 of 7); ballot targets never
      // appear as tally lines, voter medals, or per-candidate counts.
      expect(steps.map((step) => step.title)).toEqual(['首轮投票', '上警', '投票进度']);
      expect(stepNamed(steps, '投票进度').lines.map(lineTokens)).toEqual([['2/7 已提交']]);
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

  describe('hand-built rows (B2 coverage)', () => {
    it('renders every T1 single-target row in §4 (B2 coverage)', () => {
      const document = reviewDocument(
        [
          { kind: 'shelter', actorSeat: 0, targetSeat: 9 },
          { kind: 'curse', actorSeat: 1, targetSeat: 10 },
          { kind: 'dream', actorSeat: 2, targetSeat: 11 },
          { kind: 'silence', actorSeat: 3, targetSeat: 12 },
          { kind: 'voteban', actorSeat: 4, targetSeat: 13 },
          { kind: 'charm', actorSeat: 5, targetSeat: 14 },
          { kind: 'convert', actorSeat: 6, targetSeat: 15 },
          { kind: 'wolfGirlConfess', actorSeat: 7, targetSeat: 16 },
          { kind: 'idolChoice', actorSeat: 8, actorRoleId: 'slacker', targetSeat: 17 },
          { kind: 'peacefulNight' },
        ],
        [
          reviewIdentity(0, 'eclipseWolfQueen'),
          reviewIdentity(1, 'crow'),
          reviewIdentity(2, 'dreamcatcher'),
          reviewIdentity(3, 'silenceElder'),
          reviewIdentity(4, 'votebanElder'),
          reviewIdentity(5, 'wolfQueen'),
          reviewIdentity(6, 'awakenedGargoyle'),
          reviewIdentity(7, 'wolfGirl'),
          reviewIdentity(8, 'slacker'),
          reviewIdentity(9, 'villager'),
          reviewIdentity(10, 'guard'),
          reviewIdentity(11, 'witch'),
          reviewIdentity(12, 'seer'),
          reviewIdentity(13, 'wolf'),
          reviewIdentity(14, 'hunter'),
          reviewIdentity(15, 'wolfRobot'),
          reviewIdentity(16, 'gargoyle'),
          reviewIdentity(17, 'pureWhite'),
        ],
      );

      expect(nightSentences(document)).toEqual([
        '1号蚀时狼妃庇护10号。',
        '2号乌鸦诅咒11号。',
        '3号摄梦人摄梦12号。',
        '4号禁言长老禁言13号。',
        '5号禁票长老禁票14号。',
        '6号狼美人魅惑15号。',
        '7号觉醒石像鬼转化16号。',
        '8号狼女孩表白17号。',
        '9号混血儿选择榜样18号。',
        '本夜无人出局。',
      ]);
      // Verbs by the actor's faction: wolf roles evil, god roles special,
      // the third-party idol choice highlight.
      expect(toneOf(document, '庇护')).toBe('evil');
      expect(toneOf(document, '诅咒')).toBe('special');
      expect(toneOf(document, '摄梦')).toBe('special');
      expect(toneOf(document, '禁言')).toBe('special');
      expect(toneOf(document, '禁票')).toBe('special');
      expect(toneOf(document, '魅惑')).toBe('evil');
      expect(toneOf(document, '转化')).toBe('evil');
      expect(toneOf(document, '表白')).toBe('evil');
      expect(toneOf(document, '选择榜样')).toBe('highlight');
    });

    it('renders swap and cupidLink targets without role words (B2, §4.1)', () => {
      const document = reviewDocument(
        [
          { kind: 'swap', actorSeat: 0, seats: [1, 2] },
          { kind: 'cupidLink', actorSeat: 3, seats: [4, 5] },
          { kind: 'peacefulNight' },
        ],
        [
          reviewIdentity(0, 'magician'),
          reviewIdentity(1, 'villager'),
          reviewIdentity(2, 'guard'),
          reviewIdentity(3, 'cupid'),
          reviewIdentity(4, 'witch'),
          reviewIdentity(5, 'seer'),
        ],
      );
      const sentences = nightSentences(document);

      expect(sentences).toEqual([
        '1号魔术师交换2号和3号。',
        '4号丘比特连线5号和6号。',
        '本夜无人出局。',
      ]);
      for (const role of ['平民', '守卫', '女巫', '预言家']) {
        expect(sentences.filter((sentence) => sentence.includes(role))).toEqual([]);
      }
    });

    it('renders hypnotize targets without role words (B2, §4.1)', () => {
      const document = reviewDocument(
        [{ kind: 'hypnotize', actorSeat: 0, targetSeats: [1, 2, 3] }, { kind: 'peacefulNight' }],
        [
          reviewIdentity(0, 'piper'),
          reviewIdentity(1, 'villager'),
          reviewIdentity(2, 'guard'),
          reviewIdentity(3, 'witch'),
        ],
      );
      const sentences = nightSentences(document);

      expect(sentences).toEqual(['1号吹笛者催眠2号、3号、4号。', '本夜无人出局。']);
      for (const role of ['平民', '守卫', '女巫']) {
        expect(sentences.filter((sentence) => sentence.includes(role))).toEqual([]);
      }
      expect(toneOf(document, '催眠')).toBe('highlight');
    });

    it('renders cardChoice as a role word with no seat number (B2, §4)', () => {
      const document = reviewDocument(
        [
          { kind: 'cardChoice', actorSeat: 0, actorRoleId: 'seer', chosenRoleId: 'wolf' },
          { kind: 'peacefulNight' },
        ],
        [reviewIdentity(0, 'seer')],
      );

      expect(nightSentences(document)).toEqual(['1号预言家选择了狼人。', '本夜无人出局。']);
      expect(toneOf(document, '选择了')).toBe('special');
      expect(toneOf(document, '狼人')).toBe('evil');
    });

    it('renders nightmareBlock and mimic notes (B2, §4)', () => {
      const document = reviewDocument(
        [
          { kind: 'nightmareBlock', actorSeat: 0, targetSeat: 1, targetRoleId: 'witch' },
          { kind: 'mimic', actorSeat: 2, targetSeat: 3, isBound: true },
          { kind: 'peacefulNight' },
        ],
        [
          reviewIdentity(0, 'nightmare'),
          reviewIdentity(1, 'witch'),
          reviewIdentity(2, 'shadow'),
          reviewIdentity(3, 'guard'),
        ],
      );

      expect(nightSentences(document)).toEqual([
        '1号噩梦之影封锁2号（女巫，技能无效）。',
        '3号影子模仿4号（绑定）。',
        '本夜无人出局。',
      ]);
      expect(countPrinted(document, '（女巫，技能无效）')).toBe(1);
      expect(toneOf(document, '封锁')).toBe('evil');
      expect(toneOf(document, '模仿')).toBe('highlight');
    });

    it('renders seed wolf infection success and failure (B2, §4)', () => {
      const document = reviewDocument(
        [
          { kind: 'infectConverted', actorSeat: 0, targetSeat: 1 },
          { kind: 'infectFailed', actorSeat: 2, targetSeat: 3 },
          { kind: 'peacefulNight' },
        ],
        [
          reviewIdentity(0, 'seedWolf'),
          reviewIdentity(1, 'villager'),
          reviewIdentity(2, 'seedWolf'),
          reviewIdentity(3, 'guard'),
        ],
      );

      expect(nightSentences(document)).toEqual([
        '1号种狼感染2号，成功。',
        '3号种狼感染4号，失败。',
        '本夜无人出局。',
      ]);
      // 感染 prints twice, both times in the seed wolf's faction tone.
      expect(countPrinted(document, '感染')).toBe(2);
      expect(tonesOf(document, '感染')).toEqual(['evil', 'evil']);
    });

    it('colors a roleName check on a wolf by the result role faction (B1 ruling B overturned)', () => {
      const document = reviewDocument(
        [
          {
            kind: 'check',
            actorSeat: 0,
            actorRoleId: 'psychic',
            targetSeat: 1,
            result: 'wolf',
            resultFormat: 'roleName',
          },
          { kind: 'peacefulNight' },
        ],
        [reviewIdentity(0, 'psychic'), reviewIdentity(1, 'wolf')],
      );

      expect(nightSentences(document)).toEqual([
        '1号通灵师查验2号，结果：狼人。',
        '本夜无人出局。',
      ]);
      expect(toneOf(document, '查验')).toBe('special');
      expect(toneOf(document, '狼人')).toBe('evil');
    });
  });

  describe('share image', () => {
    // One document feeds the room dialog and the share image, so the
    // share image carries exactly the in-room facts.

    it('prints the shared presentation sections', () => {
      const document = documentOf(composedNightState());

      expect(blockOutline(document)).toEqual(
        expect.arrayContaining(['section:第一夜', 'section:全员身份']),
      );
      expect(document.footer).toBe(FOOTER);
      expect(printedWith(document, '第一天')).toEqual([]);
    });

    it('renders the same action facts as the modal presentation', () => {
      const document = documentOf(composedNightState());

      expect(nightSentences(document)).toEqual(
        expect.arrayContaining([
          '狼队（1号）袭击5号。',
          '2号守卫守护4号。',
          '3号女巫使用解药救起5号。毒药未使用。',
          '4号预言家查验1号，结果：狼人。',
          '5号出局。',
        ]),
      );
      expect(countPrinted(document, '狼人')).toBeGreaterThanOrEqual(2);
      // Same conclusion header as the room: headline + death stamp + byline.
      expect(headlineOf(document)).toBe('昨夜 1 人出局');
      expect(countPrinted(document, '狼杀出局')).toBe(2);
      expect(countPrinted(document, '狼队 1 票锁定')).toBe(1);
      for (const fragment of ['5号 · 平民', '死亡', '✗', '→']) {
        expect(printedWith(document, fragment)).toEqual([]);
      }
    });

    it('renders the same header and idle row as the modal', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'guard')],
        [4, makeReviewPlayer(4, 'villager')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfVotesBySeat: { '0': 4 } },
        }),
      );

      expect(headlineOf(document)).toBe('昨夜平安夜');
      // No verdict was recorded for the single wolf vote, so the engine
      // reports tie pending.
      expect(nightSentences(document)).toContain('狼队投票不一致（1号投5号），平票，目标未记录。');
      // The idle guard is a plain sentence: seat and role inside it, no
      // standalone role word outside the identity wall.
      expect(printedWith(document, '未行动')).toEqual([]);
      expect(countPrinted(document, '守卫')).toBe(1);
      expect(nightSentences(document)).toContain('2号守卫未守护。');
      expect(countPrinted(document, '未守护')).toBe(1);
      expect(printedWith(document, '守卫 2号 未守护')).toEqual([]);
    });

    it('renders wolf abstentions as a shared-target sentence, never as seat 0', () => {
      const players = new Map<number, Player | null>([
        [0, makeReviewPlayer(0, 'wolf')],
        [1, makeReviewPlayer(1, 'wolf')],
        [4, makeReviewPlayer(4, 'villager')],
      ]);
      const document = documentOf(
        makeReviewState({
          players,
          currentNightResults: { wolfVotesBySeat: { '0': 4, '1': -1 } },
          resolvedWolfKillTarget: 4,
          resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 4 },
        }),
      );

      // The shared-target sentence names the voting wolf only; the
      // partial abstention is not named, and the -1 sentinel never
      // surfaces as a 「0」 seat anywhere on the image.
      expect(headlineOf(document)).toBe('昨夜平安夜');
      expect(nightSentences(document)).toEqual(
        expect.arrayContaining(['狼队（1号）袭击5号。', '本夜无人出局。']),
      );
      expect(printedWith(document, '空刀')).toEqual([]);
      expectNoSeatZero(document);
    });

    it('renders the identity wall with exactly one out seat', () => {
      const document = documentOf(composedNightState());
      const roster = rosterOf(document);

      expect(roster.rows.map((row) => row.role)).toEqual(
        expect.arrayContaining(['守卫', '女巫', '预言家', '平民']),
      );
      expect(countPrinted(document, '存活')).toBe(4);
      expect(countPrinted(document, '狼杀出局')).toBe(2);
      expect(roster.rows.filter((row) => row.isOut).map((row) => row.seat)).toEqual([4]);
    });

    it('does not render the legacy plain-text summary lines', () => {
      const document = documentOf(composedNightState());

      // The pre-extraction card printed plain-text summary lines verbatim
      // (e.g. "🐺 狼人袭击：1号→5号"); the document carries structure instead.
      expect(
        printedStrings(document).filter((printed) => /狼人袭击：|5号: 平民/.test(printed)),
      ).toEqual([]);
    });
  });

  describe('static copy', () => {
    it('pins the static timeline copy', () => {
      const document = documentOf(composedNightState());

      expect(blocksOf(document)).toContainEqual({ kind: 'section', title: '第一夜' });
      expect(document.kicker).toBe('🌙 第一夜 · 夜报');
    });
  });
});
