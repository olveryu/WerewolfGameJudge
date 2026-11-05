/**
 * NightReviewModal component tests — 2026 timeline text-list report presentation.
 *
 * Asserts the full fact set of a composed night survives the report
 * rendering: conclusion header (headline, death stamps with derived
 * bylines), one sentence per action in night order behind a rail of dots
 * (wolf team sentence with the vote pairs inline and the verdict phrase,
 * one merged potion sentence per owner, idle sentences, determination
 * sentences), the sheriff group across the election state matrix, and
 * the identity roster. Sentences are asserted whole: a seat number
 * never appears as a standalone token outside the roster medals and
 * the death stamps. Colors are asserted per segment: only faction
 * colors appear in the timeline (verb by the actor's faction, result
 * role words and dead seat numbers by that role's / player's faction),
 * and words with no faction to point at stay in the body text color.
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
import { render } from '@testing-library/react-native';
import type { StyleProp } from 'react-native';
import { StyleSheet } from 'react-native';

import {
  makeReviewPlayer,
  makeReviewState,
  type ReviewPlayers,
} from '@/test-utils/werewolfNightReview';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import {
  NIGHT_REPORT_FOOTER_TEXT,
  NIGHT_REPORT_KICKER,
  NIGHT_REPORT_TIMELINE_TITLE,
} from '../../nightReviewLayout';
import { NightReviewModal } from '../NightReviewModal';

interface JsonNode {
  type: unknown;
  props?: { style?: unknown };
  children: (JsonNode | string)[] | null;
}

function textOf(node: JsonNode): string {
  if (!node.children) return '';
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
}

/** Every rendered Text's content in tree (document) order. */
function collectTextSequence(node: JsonNode | (JsonNode | string)[] | string | null): string[] {
  if (node === null || typeof node === 'string') return [];
  if (Array.isArray(node)) return node.flatMap((child) => collectTextSequence(child));
  if (node.type === 'Text') return [textOf(node)];
  return collectTextSequence(node.children);
}

interface FlatColorStyle {
  color?: string;
  backgroundColor?: string;
}

/** StyleSheet.flatten with the color fields typed (the RN signature infers any from props). */
function flattenStyle(style: unknown): FlatColorStyle | undefined {
  return StyleSheet.flatten<FlatColorStyle>(style as StyleProp<FlatColorStyle>);
}

interface ColoredSegment {
  readonly text: string;
  readonly color: string | undefined;
}

/**
 * Every leaf Text segment in tree order, with its own text color. A
 * timeline sentence contributes its nested segments (verb, result word,
 * seat number each carry their own color); a plain Text contributes
 * itself as one segment.
 */
function collectColoredSegments(
  node: JsonNode | (JsonNode | string)[] | string | null,
): ColoredSegment[] {
  if (node === null || typeof node === 'string') return [];
  if (Array.isArray(node)) return node.flatMap((child) => collectColoredSegments(child));
  if (node.type !== 'Text') return collectColoredSegments(node.children);
  const nested = (node.children ?? []).filter(
    (child): child is JsonNode => typeof child !== 'string' && child.type === 'Text',
  );
  if (nested.length === 0) {
    return [{ text: textOf(node), color: flattenStyle(node.props?.style)?.color }];
  }
  return nested.flatMap((child) => collectColoredSegments(child));
}

/** Color of the segment with exactly this text; fails when it never renders. */
function segmentColor(segments: readonly ColoredSegment[], text: string): string | undefined {
  const found = segments.find((segment) => segment.text === text);
  expect(found).toBeDefined();
  return found?.color;
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
 * A hand-built review: entry construction stays pinned by the engine
 * tests, so these fixtures pin only the sentence each §4 row promises
 * (verb, result word, color) and the outcome entry stays last, matching
 * the engine's emission order.
 */
function reviewData(
  actions: readonly NightReviewActionEntry[],
  identities: readonly NightReviewIdentityEntry[],
): WerewolfNightReview {
  return { actions: [...actions], identities: [...identities] };
}

/** Text sequence of the timeline only (between the section title and the roster title). */
function timelineSequence(sequence: string[]): string[] {
  return sequence.slice(
    sequence.indexOf(NIGHT_REPORT_TIMELINE_TITLE) + 1,
    sequence.indexOf('全员身份'),
  );
}

function composedNightState(): GameState {
  const players = new Map<number, Player | null>([
    [0, makeReviewPlayer(0, 'wolf')],
    [1, makeReviewPlayer(1, 'guard')],
    [2, makeReviewPlayer(2, 'witch')],
    [3, makeReviewPlayer(3, 'seer')],
    [4, makeReviewPlayer(4, 'villager')],
  ]);
  return makeReviewState({
    players,
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

describe('NightReviewModal', () => {
  it('renders the report sections and modal shell', () => {
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(composedNightState())}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByTestId(TESTIDS.nightReviewModal)).toBeTruthy();
    expect(view.getByText('本局复盘')).toBeTruthy();
    expect(view.getByText(NIGHT_REPORT_KICKER)).toBeTruthy();
    expect(view.getByText(NIGHT_REPORT_TIMELINE_TITLE)).toBeTruthy();
    expect(view.getByText('全员身份')).toBeTruthy();
    expect(view.getByText(NIGHT_REPORT_FOOTER_TEXT)).toBeTruthy();
    // The timeline form has no day tab, no day block, no stats ledger,
    // no portraits, no ✗, no arrows.
    expect(view.queryByText('第一天')).toBeNull();
    expect(view.queryByText('✗')).toBeNull();
    expect(view.queryByText('→')).toBeNull();
    expect(view.queryByText('爪击')).toBeNull();
    expect(view.queryByText('底牌组成')).toBeNull();
  });

  it('renders every action fact of the composed night', () => {
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(composedNightState())}
        onClose={jest.fn()}
      />,
    );

    // Conclusion header: headline + death card with the derived byline.
    expect(view.getByText('昨夜 1 人出局')).toBeTruthy();
    expect(view.getAllByText('狼杀出局')).toHaveLength(2);
    expect(view.getByText('狼队 1 票锁定')).toBeTruthy();
    // Timeline: one sentence per action, in night order, then the
    // outcome sentence last.
    expect(view.getByText('狼队（1号）袭击5号。')).toBeTruthy();
    expect(view.getByText('2号守卫守护4号。')).toBeTruthy();
    expect(view.getByText('3号女巫使用解药救起5号。毒药未使用。')).toBeTruthy();
    expect(view.getByText('4号预言家查验1号，结果：狼人。')).toBeTruthy();
    expect(view.getByText('5号出局。')).toBeTruthy();
    // 狼人 appears twice: the check result word and the roster name.
    expect(view.getAllByText('狼人')).toHaveLength(2);
    // Colors: verbs by the actor's faction, the check result by the
    // result role's faction, the dead seat by the dead player's faction.
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '袭击5号')).toBe(colors.wolf);
    expect(segmentColor(segments, '守护')).toBe(colors.god);
    expect(segmentColor(segments, '使用解药救起5号')).toBe(colors.god);
    expect(segmentColor(segments, '查验')).toBe(colors.god);
    expect(segmentColor(segments, '狼人')).toBe(colors.wolf);
    expect(segmentColor(segments, '5号')).toBe(colors.villager);
    // Number discipline: no ✗, no arrow anywhere. (Seat numbers live
    // inside the timeline sentences by design, so no bare-number
    // assertion applies to this form.)
    expect(view.queryByText('✗')).toBeNull();
    expect(view.queryByText('→')).toBeNull();
    expect(view.queryByText('死亡')).toBeNull();
  });

  it('renders the full identity wall with exactly one out seat', () => {
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(composedNightState())}
        onClose={jest.fn()}
      />,
    );

    const sequence = collectTextSequence(view.toJSON());
    const afterIdentities = sequence.slice(sequence.indexOf('全员身份'));
    const roleOrder = ['狼人', '守卫', '女巫', '预言家', '平民'].map((name) =>
      afterIdentities.indexOf(name),
    );
    for (const index of roleOrder) expect(index).toBeGreaterThanOrEqual(0);
    expect([...roleOrder].sort((a, b) => a - b)).toEqual(roleOrder);
    expect(view.getAllByText('存活')).toHaveLength(4);
    expect(view.queryByText('已出局')).toBeNull();
  });

  it('renders bottom cards and villager identities on the report', () => {
    const players = new Map<number, Player | null>([[0, makeReviewPlayer(0, 'villager')]]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({ players, bottomCards: ['villager', 'seer', 'guard'] }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('底牌：平民、预言家、守卫。')).toBeTruthy();
    expect(view.getByText('本夜无人出局。')).toBeTruthy();
    // 平民 appears in the bottom-cards sentence and on the identity wall.
    expect(view.getAllByText('平民')).toHaveLength(2);
    expect(view.getByText('存活')).toBeTruthy();
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '平民')).toBe(colors.villager);
    expect(segmentColor(segments, '预言家')).toBe(colors.god);
    expect(segmentColor(segments, '守卫')).toBe(colors.god);
  });

  it('renders a peaceful night and placeholder identities', () => {
    const players = new Map<number, Player | null>([
      [0, null],
      [1, makeReviewPlayer(1, null)],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(makeReviewState({ players }))}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('昨夜平安夜')).toBeTruthy();
    expect(view.getByText('本夜无人出局。')).toBeTruthy();
    expect(view.getByText('空座')).toBeTruthy();
    expect(view.getByText('未分配')).toBeTruthy();
    expect(view.queryByText('狼杀出局')).toBeNull();
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
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: {
              wolfVotesBySeat: { '0': 4, '1': 4, '2': 4, '3': 4 },
            },
            resolvedWolfKillTarget: 4,
            resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 4 },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('狼队（1、2、3、4号）袭击5号。')).toBeTruthy();
    expect(view.getByText('本夜无人出局。')).toBeTruthy();
    expect(view.queryByText('狼队共同目标')).toBeNull();
    expect(view.queryByText('↓')).toBeNull();
    expect(view.queryByText('✗')).toBeNull();
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '袭击5号')).toBe(colors.wolf);
  });

  it('marks tied split wolf votes without a settlement as tie pending, not as no kill', () => {
    const players = new Map<number, Player | null>([
      [0, makeReviewPlayer(0, 'wolf')],
      [1, makeReviewPlayer(1, 'wolf')],
      [4, makeReviewPlayer(4, 'villager')],
      [5, makeReviewPlayer(5, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': 5, '1': 4 } },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    // The vote pairs list in target-group order (most votes first,
    // ties by target seat ascending); no resolved target exists, so
    // the verdict phrase and the pairs stay uncolored. No verdict was
    // recorded, so the engine reports tie pending.
    expect(view.getByText('狼队投票不一致（2号投5号、1号投6号），平票，目标未记录。')).toBeTruthy();
    expect(view.getByText('本夜无人出局。')).toBeTruthy();
    expect(view.queryByText('狼队目标不一致 — 平票，未击杀')).toBeNull();
    expect(view.queryByText('狼队共同目标')).toBeNull();
    expect(view.queryByText('✗')).toBeNull();
  });

  it('marks a tied split wolf vote settled to a kill with the tie-picked verdict', () => {
    const players = new Map<number, Player | null>([
      [0, makeReviewPlayer(0, 'wolf')],
      [1, makeReviewPlayer(1, 'wolf')],
      [4, makeReviewPlayer(4, 'villager')],
      [5, makeReviewPlayer(5, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': 5, '1': 4 } },
            lastNightDeaths: [5],
            deathReasons: { 5: 'wolfKill' },
            resolvedWolfKillTarget: 5,
            resolvedWolfKillVerdict: { type: 'tiePicked', targetSeat: 5 },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('狼队投票不一致（2号投5号、1号投6号），平票抽中6号。')).toBeTruthy();
    expect(view.getByText('6号出局。')).toBeTruthy();
    expect(view.queryByText('狼队目标不一致 — 平票，未击杀')).toBeNull();
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '平票抽中6号')).toBe(colors.wolf);
    expect(segmentColor(segments, '6号')).toBe(colors.villager);
  });

  it('keeps the no-kill verdict only for a tied split vote settled to no kill', () => {
    const players = new Map<number, Player | null>([
      [0, makeReviewPlayer(0, 'wolf')],
      [1, makeReviewPlayer(1, 'wolf')],
      [4, makeReviewPlayer(4, 'villager')],
      [5, makeReviewPlayer(5, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': 5, '1': 4 } },
            resolvedWolfKillTarget: null,
            resolvedWolfKillVerdict: { type: 'splitTied' },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('狼队投票不一致（2号投5号、1号投6号），平票，未击杀。')).toBeTruthy();
    expect(view.getByText('本夜无人出局。')).toBeTruthy();
    expect(view.queryByText('✗')).toBeNull();
  });

  it('merges the witch poison and unused antidote into one sentence', () => {
    const players = new Map<number, Player | null>([
      [0, makeReviewPlayer(0, 'wolf')],
      [1, makeReviewPlayer(1, 'villager')],
      [2, makeReviewPlayer(2, 'witch')],
      [3, makeReviewPlayer(3, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': 1 }, poisonedSeat: 3 },
            lastNightDeaths: [3],
            deathReasons: { 3: 'poison' },
            resolvedWolfKillTarget: 1,
            resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 1 },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('狼队（1号）袭击2号。')).toBeTruthy();
    expect(view.getByText('3号女巫毒杀4号。解药未使用。')).toBeTruthy();
    expect(view.getByText('4号出局。')).toBeTruthy();
    // Death card byline names the poison owner.
    expect(view.getByText('女巫下毒')).toBeTruthy();
    expect(view.getAllByText('毒杀出局')).toHaveLength(2);
    // The unused antidote is plain words in the same sentence — no ✗,
    // no separate note, no derived "wolf target not saved" note.
    expect(view.getByText('解药未使用。')).toBeTruthy();
    expect(view.queryByText('目标出局')).toBeNull();
    expect(view.queryByText('狼刀目标未救')).toBeNull();
    expect(view.queryByText('✗')).toBeNull();
    expect(view.queryByText('女巫未使用解药')).toBeNull();
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '毒杀4号')).toBe(colors.god);
    expect(segmentColor(segments, '解药未使用。')).toBeUndefined();
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
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
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
        )}
        onClose={jest.fn()}
      />,
    );

    // Conclusion header: both deaths, derived bylines.
    expect(view.getByText('昨夜 2 人出局')).toBeTruthy();
    expect(view.getByText('狼队 2 票锁定')).toBeTruthy();
    expect(view.getByText('女巫下毒')).toBeTruthy();
    // Timeline sentences in night order.
    expect(
      view.getByText('狼队投票不一致（7号投6号、8号投6号、9号投5号），按多数票击杀6号。'),
    ).toBeTruthy();
    expect(view.getByText('10号女巫毒杀12号。解药未使用。')).toBeTruthy();
    expect(view.getByText('4号预言家查验5号，结果：好人。')).toBeTruthy();
    expect(view.getByText('3号猎人可以发动。')).toBeTruthy();
    expect(view.getByText('6号和12号出局。')).toBeTruthy();
    // The partial abstention is not named anywhere on the page.
    expect(view.queryByText('空刀')).toBeNull();
    // The -1 abstention sentinel never surfaces as a seat: no bare 「0」
    // medal and no 「0号」 text in the whole sequence.
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence).not.toContain('0');
    expect(sequence).not.toContain('0号');
    // Colors: the resolved kill phrase by the wolf faction, the poison
    // by the witch's faction, the check verb by the seer's faction, the
    // 好人 result plain, the determination by the hunter's faction, and
    // each dead seat by that player's faction.
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '按多数票击杀6号')).toBe(colors.wolf);
    expect(segmentColor(segments, '毒杀12号')).toBe(colors.god);
    expect(segmentColor(segments, '查验')).toBe(colors.god);
    expect(segmentColor(segments, '好人')).toBeUndefined();
    expect(segmentColor(segments, '可以发动')).toBe(colors.god);
    expect(segmentColor(segments, '6号')).toBe(colors.villager);
    expect(segmentColor(segments, '12号')).toBe(colors.wolf);
    // Hunter: the seat lives inside the sentence only — no （3号） text.
    expect(view.queryByText('（3号）')).toBeNull();
    expect(view.queryByText('3号')).toBeNull();
    // Identity wall statuses.
    expect(view.getAllByText('存活')).toHaveLength(10);
    expect(view.getAllByText('狼杀出局')).toHaveLength(2);
    expect(view.getAllByText('毒杀出局')).toHaveLength(2);
    // No idle entries this night: no strip.
    expect(view.queryByText('未行动')).toBeNull();
  });

  it('renders an all-abstain wolf night with only the abstain sentence', () => {
    const players = new Map<number, Player | null>([
      [0, makeReviewPlayer(0, 'wolf')],
      [1, makeReviewPlayer(1, 'wolf')],
      [2, makeReviewPlayer(2, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': -1, '1': -1 } },
            resolvedWolfKillTarget: null,
            resolvedWolfKillVerdict: { type: 'allAbstain' },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('狼队全员空刀。')).toBeTruthy();
    expect(view.getByText('本夜无人出局。')).toBeTruthy();
    expect(view.queryByText('狼队共同目标')).toBeNull();
    expect(view.queryByText('狼队目标不一致 — 按多数票击杀')).toBeNull();
    expect(view.queryByText('✗')).toBeNull();
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence).not.toContain('0');
    expect(sequence).not.toContain('0号');
  });

  it('renders idle actors as plain sentences in night order', () => {
    const players = new Map<number, Player | null>([
      [0, makeReviewPlayer(0, 'wolf')],
      [1, makeReviewPlayer(1, 'guard')],
      [3, makeReviewPlayer(3, 'seer')],
      [4, makeReviewPlayer(4, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': 4 } },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    const sequence = collectTextSequence(view.toJSON());
    const indexOf = (text: string): number => {
      const index = sequence.indexOf(text);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    };
    // The guard never guarded and the seer never checked: each is a
    // sentence carrying its phrase; the order on the page is the
    // engine's summary order (wolf, then guard, then seer), with no
    // faction regrouping. No verdict was recorded for the single wolf
    // vote, so the engine reports tie pending.
    expect(view.getByText('狼队投票不一致（1号投5号），平票，目标未记录。')).toBeTruthy();
    expect(view.getByText('2号守卫未守护。')).toBeTruthy();
    expect(view.getByText('4号预言家未查验。')).toBeTruthy();
    expect(view.getByText('本夜无人出局。')).toBeTruthy();
    expect(view.queryByText('未行动')).toBeNull();
    expect(indexOf(NIGHT_REPORT_TIMELINE_TITLE)).toBeLessThan(
      indexOf('狼队投票不一致（1号投5号），平票，目标未记录。'),
    );
    expect(indexOf('狼队投票不一致（1号投5号），平票，目标未记录。')).toBeLessThan(
      indexOf('2号守卫未守护。'),
    );
    expect(indexOf('2号守卫未守护。')).toBeLessThan(indexOf('4号预言家未查验。'));
    expect(indexOf('4号预言家未查验。')).toBeLessThan(indexOf('本夜无人出局。'));
    expect(indexOf('本夜无人出局。')).toBeLessThan(indexOf('全员身份'));
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
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(makeReviewState({ players }))}
        onClose={jest.fn()}
      />,
    );

    // Knowledge confirmations are sentences, not absences; the witch
    // used no antidote and the poisoner did not poison, so both read
    // as unused-potion sentences. The wolf team recorded no vote.
    expect(view.getByText('狼队未选择目标。')).toBeTruthy();
    expect(view.getByText('1号隐狼已确认狼同伴。')).toBeTruthy();
    expect(view.getByText('2号复仇者已确认阵营。')).toBeTruthy();
    expect(view.getByText('3号女巫未使用解药。')).toBeTruthy();
    expect(view.getByText('4号毒师未使用毒药。')).toBeTruthy();
    expect(view.getByText('5号机械狼人未学习。')).toBeTruthy();
    expect(view.getByText('本夜无人出局。')).toBeTruthy();
    expect(view.queryByText('✗')).toBeNull();
    expect(view.queryByText('未行动')).toBeNull();
    // The confirmation phrases carry the actor's faction color; the
    // unused-potion sentences are plain.
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '已确认狼同伴')).toBe(colors.wolf);
    expect(segmentColor(segments, '已确认阵营')).toBe(colors.third);
    expect(segmentColor(segments, '未使用解药')).toBeUndefined();
    expect(segmentColor(segments, '未使用毒药')).toBeUndefined();
  });

  it('names an identity-family check result with the Chinese role name', () => {
    const players = new Map<number, Player | null>([
      [0, makeReviewPlayer(0, 'villager')],
      [4, makeReviewPlayer(4, 'psychic')],
      [9, makeReviewPlayer(9, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            psychicReveal: { targetSeat: 9, result: 'villager' },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('5号通灵师查验10号，结果：平民。')).toBeTruthy();
    // 平民 appears three times: the check result word and the two
    // villager rows on the identity wall.
    expect(view.getAllByText('平民')).toHaveLength(3);
    // The result word is a timeline segment, before the roster title.
    const segments = collectColoredSegments(view.toJSON());
    const resultAt = segments.findIndex((segment) => segment.text === '平民');
    const rosterAt = segments.findIndex((segment) => segment.text === '全员身份');
    expect(resultAt).toBeGreaterThanOrEqual(0);
    expect(rosterAt).toBeGreaterThan(resultAt);
    expect(view.getByText('查验')).toBeTruthy();
    expect(view.queryByText('villager')).toBeNull();
    expect(segmentColor(segments, '查验')).toBe(colors.god);
    expect(segmentColor(segments, '平民')).toBe(colors.villager);
  });

  it('shows a faction check as a faction word only, never the target identity', () => {
    const players = new Map<number, Player | null>([
      [0, makeReviewPlayer(0, 'witch')],
      [3, makeReviewPlayer(3, 'seer')],
      [4, makeReviewPlayer(4, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            seerReveal: { targetSeat: 0, result: '狼人' },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('4号预言家查验1号，结果：狼人。')).toBeTruthy();
    expect(view.getByText('1号女巫未使用药水。')).toBeTruthy();
    // 女巫 appears once as a standalone word — the identity wall row.
    // The idle sentence carries it inside "1号女巫", and the check
    // sentence never names the target's role.
    expect(view.getAllByText('女巫')).toHaveLength(1);
    expect(view.queryByText('villager')).toBeNull();
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '查验')).toBe(colors.god);
    expect(segmentColor(segments, '狼人')).toBe(colors.wolf);
  });

  it('moves the learned role into the sentence as a result word', () => {
    const players = new Map<number, Player | null>([
      [0, makeReviewPlayer(0, 'wolfRobot')],
      [1, makeReviewPlayer(1, 'witch')],
      [2, makeReviewPlayer(2, 'villager')],
      [3, makeReviewPlayer(3, 'wolf')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: { wolfVotesBySeat: { '3': 2 }, savedSeat: 2 },
            wolfRobotReveal: { targetSeat: 1, result: '女巫', learnedRoleId: 'witch' },
            lastNightDeaths: [],
            resolvedWolfKillTarget: 2,
            resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 2 },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('狼队（4号）袭击3号。')).toBeTruthy();
    expect(view.getByText('2号女巫使用解药救起3号。毒药未使用。')).toBeTruthy();
    expect(view.getByText('1号机械狼人学习2号，学到身份：女巫。')).toBeTruthy();
    expect(view.getByText('本夜无人出局。')).toBeTruthy();
    // 女巫 appears twice: the learned-role word and the identity wall.
    expect(view.getAllByText('女巫')).toHaveLength(2);
    expect(view.queryByText('（女巫）')).toBeNull();
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '学习')).toBe(colors.wolf);
    expect(segmentColor(segments, '女巫')).toBe(colors.god);
  });

  it('renders the hunter determination in both states', () => {
    const hunterPlayers = new Map<number, Player | null>([
      [0, makeReviewPlayer(0, 'wolf')],
      [2, makeReviewPlayer(2, 'hunter')],
      [4, makeReviewPlayer(4, 'villager')],
    ]);
    const canShoot = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players: hunterPlayers,
            currentNightResults: { wolfVotesBySeat: { '0': 4 } },
          }),
        )}
        onClose={jest.fn()}
      />,
    );
    expect(canShoot.getByText('3号猎人可以发动。')).toBeTruthy();
    expect(canShoot.queryByText('3号猎人不能发动。')).toBeNull();
    expect(segmentColor(collectColoredSegments(canShoot.toJSON()), '可以发动')).toBe(colors.god);

    const cannotShoot = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players: new Map<number, Player | null>([
              [0, makeReviewPlayer(0, 'wolf')],
              [1, makeReviewPlayer(1, 'witch')],
              [2, makeReviewPlayer(2, 'hunter')],
              [4, makeReviewPlayer(4, 'villager')],
            ]),
            currentNightResults: { wolfVotesBySeat: { '0': 4 }, poisonedSeat: 2 },
          }),
        )}
        onClose={jest.fn()}
      />,
    );
    expect(cannotShoot.getByText('3号猎人不能发动。')).toBeTruthy();
    expect(cannotShoot.queryByText('3号猎人可以发动。')).toBeNull();
    expect(segmentColor(collectColoredSegments(cannotShoot.toJSON()), '不能发动')).toBeUndefined();
  });

  it('lists the wolf vote pairs in target-group order for a split kill', () => {
    const players = new Map<number, Player | null>([
      [4, makeReviewPlayer(4, 'villager')],
      [5, makeReviewPlayer(5, 'villager')],
      [6, makeReviewPlayer(6, 'wolf')],
      [7, makeReviewPlayer(7, 'wolf')],
      [8, makeReviewPlayer(8, 'wolf')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: { wolfVotesBySeat: { '6': 5, '7': 5, '8': 4 } },
            lastNightDeaths: [5],
            deathReasons: { 5: 'wolfKill' },
            resolvedWolfKillTarget: 5,
            resolvedWolfKillVerdict: { type: 'splitKilled', targetSeat: 5 },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    // The vote pairs list in target-group order: the two-voter group
    // first (most votes, target seat ascending on ties), then the
    // one-voter group, then the verdict phrase — no diagram, no arrow.
    expect(
      view.getByText('狼队投票不一致（7号投6号、8号投6号、9号投5号），按多数票击杀6号。'),
    ).toBeTruthy();
    expect(view.getByText('6号出局。')).toBeTruthy();
    expect(view.queryByText('↓')).toBeNull();
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '按多数票击杀6号')).toBe(colors.wolf);
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
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
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
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('4号同守同救，仍然死亡。')).toBeTruthy();
    expect(view.getByText('5号舞者免疫毒药。')).toBeTruthy();
    expect(view.getByText('6号预言家查验7号，反伤。')).toBeTruthy();
    // 查验 appears twice: the seer check row and the reflection row.
    expect(view.getAllByText('查验')).toHaveLength(2);
    const segments = collectColoredSegments(view.toJSON());
    expect(segmentColor(segments, '4号同守同救，仍然死亡。')).toBeUndefined();
    expect(segmentColor(segments, '舞者')).toBe(colors.god);
    expect(segmentColor(segments, '7号，反伤。')).toBeUndefined();
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
    const poisonerPresent = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: { wolfKillOverride: { source: 'poisoner', ui: overrideUi } },
          }),
        )}
        onClose={jest.fn()}
      />,
    );
    expect(poisonerPresent.getByText('狼队放弃袭击，毒师在场。')).toBeTruthy();
    expect(poisonerPresent.queryByText('✗')).toBeNull();

    const nightmareBlocked = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(
          makeReviewState({
            players,
            currentNightResults: { wolfKillOverride: { source: 'nightmare', ui: overrideUi } },
          }),
        )}
        onClose={jest.fn()}
      />,
    );
    expect(nightmareBlocked.getByText('狼队放弃袭击，被噩梦之影封锁。')).toBeTruthy();
    expect(nightmareBlocked.queryByText('✗')).toBeNull();
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
    const view = render(
      <NightReviewModal
        visible
        data={getWerewolfNightReview(makeReviewState({ players }))}
        onClose={jest.fn()}
      />,
    );

    for (const sentence of [
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
    ]) {
      expect(view.getByText(sentence)).toBeTruthy();
    }
  });

  describe('sheriff card', () => {
    const FIRST_ROUND = {
      round: 'first',
      candidateSeats: [2, 5],
      eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
      ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2, 6: 5 },
      voteCounts: { 2: 4, 5: 2 },
      abstainingSeats: [4],
    } as const;
    const sevenVillagers = (): ReviewPlayers =>
      new Map(
        [0, 1, 2, 3, 4, 5, 6].map((seat) => [seat, makeReviewPlayer(seat, 'villager')] as const),
      );

    it('renders the full public record for a completed election', () => {
      const view = render(
        <NightReviewModal
          visible
          data={getWerewolfNightReview(
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
          )}
          onClose={jest.fn()}
        />,
      );

      // Panel UI: the report's section title plus the panel header both
      // read 警长竞选; the outcome is the panel's result banner, and the
      // records collapse to the 上警 row because every registered seat is
      // still standing (no separate 参选 row under the panel's rule).
      expect(view.getAllByText('警长竞选')).toHaveLength(2);
      expect(view.getByText('竞选结束')).toBeTruthy();
      expect(view.getByText('3号 · 当选警长')).toBeTruthy();
      expect(view.getByText('首轮投票当选 · 警徽在 3号')).toBeTruthy();
      expect(view.getByText('上警')).toBeTruthy();
      expect(view.queryByText('参选')).toBeNull();
      expect(view.getByText('首轮投票结果')).toBeTruthy();
      expect(view.getByText('4 票')).toBeTruthy();
      expect(view.getByText('2 票')).toBeTruthy();
      expect(view.getByText('弃票')).toBeTruthy();
    });

    it('renders registration as status only — no seats, no counts', () => {
      const view = render(
        <NightReviewModal
          visible
          data={getWerewolfNightReview(
            makeReviewState({
              players: sevenVillagers(),
              sheriffElection: {
                phase: 'registration',
                registeredSeats: [1, 2],
                withdrawnSeats: [],
                completedRounds: [],
              },
            }),
          )}
          onClose={jest.fn()}
        />,
      );

      // Panel UI: the registration phase header only — no records row,
      // no seats, no counts, for anyone.
      expect(view.getByText('报名上警')).toBeTruthy();
      expect(view.queryByText('上警')).toBeNull();
      expect(view.queryByText('首轮投票结果')).toBeNull();
      const sequence = collectTextSequence(view.toJSON());
      const cardHead = sequence.lastIndexOf('警长竞选');
      expect(sequence[cardHead + 1]).toBe('报名上警');
      expect(sequence[cardHead + 2]).toBe(
        '想竞选警长的玩家可在手机上报名，系统随后将随机确定发言顺序。',
      );
      expect(sequence[cardHead + 3]).toBe('全员身份');
    });

    it('renders an in-progress vote with progress counts only — ballot targets never surface', () => {
      const view = render(
        <NightReviewModal
          visible
          data={getWerewolfNightReview(
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
          )}
          onClose={jest.fn()}
        />,
      );

      // Panel UI: the phase header plus the read-only progress row. Only
      // the submission count surfaces (2 of 7); ballot targets never
      // appear as tally rows, voter rows, or per-candidate counts.
      expect(view.getByText('首轮投票')).toBeTruthy();
      expect(view.getByText('投票进度')).toBeTruthy();
      expect(view.getByText('2/7 已提交')).toBeTruthy();
      expect(view.queryByText('4 票')).toBeNull();
      expect(view.queryByText('1 票')).toBeNull();
      expect(view.queryByText('弃票')).toBeNull();
      expect(view.queryByText('首轮投票结果')).toBeNull();
    });

    it('renders every T1 single-target row in §4 (B2 coverage)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              { kind: 'shelter', actorSeat: 0, targetSeat: 9 },
              { kind: 'curse', actorSeat: 1, targetSeat: 10 },
              { kind: 'dream', actorSeat: 2, targetSeat: 11 },
              { kind: 'silence', actorSeat: 3, targetSeat: 12 },
              { kind: 'voteban', actorSeat: 4, targetSeat: 13 },
              { kind: 'charm', actorSeat: 5, targetSeat: 14 },
              { kind: 'convert', actorSeat: 6, targetSeat: 15 },
              { kind: 'wolfGirlConfess', actorSeat: 7, targetSeat: 16 },
              {
                kind: 'idolChoice',
                actorSeat: 8,
                actorRoleId: 'slacker',
                targetSeat: 17,
              },
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
          )}
          onClose={jest.fn()}
        />,
      );
      const slice = timelineSequence(collectTextSequence(view.toJSON()));
      expect(slice).toEqual([
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
      // Verbs by the actor's faction: wolf roles red, god roles violet,
      // the third-party idol choice gold.
      const segments = collectColoredSegments(view.toJSON());
      expect(segmentColor(segments, '庇护')).toBe(colors.wolf);
      expect(segmentColor(segments, '诅咒')).toBe(colors.god);
      expect(segmentColor(segments, '摄梦')).toBe(colors.god);
      expect(segmentColor(segments, '禁言')).toBe(colors.god);
      expect(segmentColor(segments, '禁票')).toBe(colors.god);
      expect(segmentColor(segments, '魅惑')).toBe(colors.wolf);
      expect(segmentColor(segments, '转化')).toBe(colors.wolf);
      expect(segmentColor(segments, '表白')).toBe(colors.wolf);
      expect(segmentColor(segments, '选择榜样')).toBe(colors.third);
    });

    it('renders swap and cupidLink targets without role words (B2, §4.1)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
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
          )}
          onClose={jest.fn()}
        />,
      );
      const slice = timelineSequence(collectTextSequence(view.toJSON()));
      expect(slice).toEqual([
        '1号魔术师交换2号和3号。',
        '4号丘比特连线5号和6号。',
        '本夜无人出局。',
      ]);
      expect(slice).not.toContain('平民');
      expect(slice).not.toContain('守卫');
      expect(slice).not.toContain('女巫');
      expect(slice).not.toContain('预言家');
    });

    it('renders hypnotize targets without role words (B2, §4.1)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              { kind: 'hypnotize', actorSeat: 0, targetSeats: [1, 2, 3] },
              { kind: 'peacefulNight' },
            ],
            [
              reviewIdentity(0, 'piper'),
              reviewIdentity(1, 'villager'),
              reviewIdentity(2, 'guard'),
              reviewIdentity(3, 'witch'),
            ],
          )}
          onClose={jest.fn()}
        />,
      );
      const slice = timelineSequence(collectTextSequence(view.toJSON()));
      expect(slice).toEqual(['1号吹笛者催眠2号、3号、4号。', '本夜无人出局。']);
      expect(slice).not.toContain('平民');
      expect(slice).not.toContain('守卫');
      expect(slice).not.toContain('女巫');
      const segments = collectColoredSegments(view.toJSON());
      expect(segmentColor(segments, '催眠')).toBe(colors.third);
    });

    it('renders cardChoice as a role word with no seat number (B2, §4)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              { kind: 'cardChoice', actorSeat: 0, actorRoleId: 'seer', chosenRoleId: 'wolf' },
              { kind: 'peacefulNight' },
            ],
            [reviewIdentity(0, 'seer')],
          )}
          onClose={jest.fn()}
        />,
      );
      const slice = timelineSequence(collectTextSequence(view.toJSON()));
      expect(slice).toEqual(['1号预言家选择了狼人。', '本夜无人出局。']);
      const segments = collectColoredSegments(view.toJSON());
      expect(segmentColor(segments, '选择了')).toBe(colors.god);
      expect(segmentColor(segments, '狼人')).toBe(colors.wolf);
    });

    it('renders nightmareBlock and mimic notes (B2, §4)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
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
          )}
          onClose={jest.fn()}
        />,
      );
      const slice = timelineSequence(collectTextSequence(view.toJSON()));
      expect(slice).toEqual([
        '1号噩梦之影封锁2号（女巫，技能无效）。',
        '3号影子模仿4号（绑定）。',
        '本夜无人出局。',
      ]);
      expect(view.getByText('（女巫，技能无效）')).toBeTruthy();
      const segments = collectColoredSegments(view.toJSON());
      expect(segmentColor(segments, '封锁')).toBe(colors.wolf);
      expect(segmentColor(segments, '模仿')).toBe(colors.third);
    });

    it('renders seed wolf infection success and failure (B2, §4)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
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
          )}
          onClose={jest.fn()}
        />,
      );
      const slice = timelineSequence(collectTextSequence(view.toJSON()));
      expect(slice).toEqual(['1号种狼感染2号，成功。', '3号种狼感染4号，失败。', '本夜无人出局。']);
      expect(view.getAllByText('感染')).toHaveLength(2);
      const segments = collectColoredSegments(view.toJSON());
      expect(segmentColor(segments, '感染')).toBe(colors.wolf);
    });

    it('colors a roleName check on a wolf by the result role faction (B1 ruling B overturned)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
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
          )}
          onClose={jest.fn()}
        />,
      );
      const slice = timelineSequence(collectTextSequence(view.toJSON()));
      expect(slice).toEqual(['1号通灵师查验2号，结果：狼人。', '本夜无人出局。']);
      const segments = collectColoredSegments(view.toJSON());
      expect(segmentColor(segments, '查验')).toBe(colors.god);
      expect(segmentColor(segments, '狼人')).toBe(colors.wolf);
    });
  });
});
