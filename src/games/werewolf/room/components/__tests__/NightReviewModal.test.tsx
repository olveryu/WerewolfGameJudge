/**
 * NightReviewModal component tests — 2026 pictorial report presentation.
 *
 * Asserts the full fact set of a composed night survives the report
 * rendering: conclusion header (headline, stats ledger, death stamps with
 * derived bylines), one picture row per action in night order (wolf team
 * row with vote diagram and verdict sentence, merged potion card, dimmed
 * idle rows, determination rows), the day tab + night/day blocks, the
 * sheriff group across the election state matrix, and the identity
 * roster. Number discipline is pinned throughout: a seat number appears
 * exactly once per figure (below its portrait, or inside its medal in
 * the roster, the vote diagram, and the death stamps), so no 「N号」
 * text exists anywhere in the report.
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
import type { ReactTestInstance } from 'react-test-renderer';

import {
  makeReviewPlayer,
  makeReviewState,
  type ReviewPlayers,
} from '@/test-utils/werewolfNightReview';
import { TESTIDS } from '@/testids';
import { colors, NIGHT_REPORT_COLORS } from '@/theme';

import {
  NIGHT_REPORT_DAY_BLOCK_TITLE,
  NIGHT_REPORT_DAY_EMPTY_TEXT,
  NIGHT_REPORT_DAY_TAB_LABEL,
  NIGHT_REPORT_FOOTER_TEXT,
  NIGHT_REPORT_KICKER,
  NIGHT_REPORT_NIGHT_BLOCK_TITLE,
} from '../../nightReviewLayout';
import { NightReviewModal } from '../NightReviewModal';

interface JsonNode {
  type: unknown;
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

/** One stats ledger cell as rendered: the count over its label in a single Text. */
function ledgerCell(label: string, count: number): string {
  return `${count}\n${label}`;
}

interface FlatColorStyle {
  color?: string;
  backgroundColor?: string;
}

/** StyleSheet.flatten with the color fields typed (the RN signature infers any from props). */
function flattenStyle(style: unknown): FlatColorStyle | undefined {
  return StyleSheet.flatten<FlatColorStyle>(style as StyleProp<FlatColorStyle>);
}

/** First backgroundColor found walking up from a rendered node (RNTL nests host nodes). */
function enclosingBackgroundColor(node: ReactTestInstance): string | undefined {
  let current: ReactTestInstance | null = node;
  while (current) {
    const backgroundColor = flattenStyle(current.props.style)?.backgroundColor;
    if (backgroundColor) return backgroundColor;
    current = current.parent;
  }
  return undefined;
}

/** Nearest ancestor whose type is the host View (RNTL wraps hosts in composites). */
function nearestViewAncestor(node: ReactTestInstance): ReactTestInstance | null {
  let current = node.parent;
  while (current && String(current.type) !== 'View') current = current.parent;
  return current;
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
 * tests, so these fixtures pin only the row rendering each §4 row
 * promises (verb, tags, notes, tag absence in multi-figure slots).
 */
function reviewData(
  actions: readonly NightReviewActionEntry[],
  identities: readonly NightReviewIdentityEntry[],
): WerewolfNightReview {
  return { actions: [...actions], identities: [...identities] };
}

/** Text sequence of the night block only (between the two block titles). */
function nightBlockSequence(sequence: string[]): string[] {
  return sequence.slice(
    sequence.indexOf(NIGHT_REPORT_NIGHT_BLOCK_TITLE) + 1,
    sequence.indexOf(NIGHT_REPORT_DAY_BLOCK_TITLE),
  );
}

/** Asserts tokens appear in order inside sequence (other tokens may sit between). */
function expectOrdered(sequence: string[], tokens: readonly string[]): void {
  let cursor = -1;
  for (const token of tokens) {
    const next = sequence.indexOf(token, cursor + 1);
    expect(next).toBeGreaterThan(cursor);
    cursor = next;
  }
}

interface FlatOpacityStyle {
  opacity?: number;
}

/** True when any ancestor view of node carries a dimmed (opacity < 1) style. */
function hasDimmedAncestor(node: ReactTestInstance): boolean {
  let current: ReactTestInstance | null = node;
  while (current) {
    const style = StyleSheet.flatten<FlatOpacityStyle>(
      current.props.style as StyleProp<FlatOpacityStyle>,
    );
    if (style && typeof style.opacity === 'number' && style.opacity < 1) return true;
    current = current.parent;
  }
  return false;
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
    expect(view.getByText(NIGHT_REPORT_DAY_TAB_LABEL)).toBeTruthy();
    expect(view.getByText(NIGHT_REPORT_NIGHT_BLOCK_TITLE)).toBeTruthy();
    expect(view.getByText(NIGHT_REPORT_DAY_BLOCK_TITLE)).toBeTruthy();
    expect(view.getByText(NIGHT_REPORT_DAY_EMPTY_TEXT)).toBeTruthy();
    expect(view.getByText('全员身份')).toBeTruthy();
    expect(view.getByText(NIGHT_REPORT_FOOTER_TEXT)).toBeTruthy();
    // Stats ledger tallies for the composed night.
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence).toContain(ledgerCell('狼杀', 1));
    expect(sequence).toContain(ledgerCell('毒杀', 0));
    expect(sequence).toContain(ledgerCell('救活', 0));
    expect(sequence).toContain(ledgerCell('查验', 1));
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
    // Wolf team picture row: team figure, attack verb, verdict sentence.
    expect(view.getByText('狼队')).toBeTruthy();
    expect(view.getByText('爪击')).toBeTruthy();
    expect(view.getByText('狼队共同目标')).toBeTruthy();
    // Guard picture row.
    expect(view.getByText('守护')).toBeTruthy();
    // Witch card: the save line plus the unused-poison ✗ line.
    expect(view.getByText('使用解药救了')).toBeTruthy();
    expect(view.getByText('毒药')).toBeTruthy();
    expect(view.getByText('未使用')).toBeTruthy();
    expect(view.getByText('✗')).toBeTruthy();
    // Seer picture row with its faction result tag.
    expect(view.getByText('查验')).toBeTruthy();
    expect(view.getAllByText('狼人').length).toBeGreaterThanOrEqual(2);
    // Number discipline: no 「N号」 text anywhere.
    expect(view.queryByText('5号 · 平民')).toBeNull();
    expect(view.queryByText('5号')).toBeNull();
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

    expect(view.getByText('底牌组成')).toBeTruthy();
    // 平民 appears on the bottom-card figure and on the identity wall.
    expect(view.getAllByText('平民')).toHaveLength(2);
    expect(view.getByText('存活')).toBeTruthy();
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
    expect(view.getByText('空座')).toBeTruthy();
    expect(view.getByText('未分配')).toBeTruthy();
    expect(view.queryByText('狼杀出局')).toBeNull();
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence).toContain(ledgerCell('狼杀', 0));
    expect(sequence).toContain(ledgerCell('查验', 0));
  });

  it('aggregates wolf votes by target with one filled target medal', () => {
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

    expect(view.getByText('狼队共同目标')).toBeTruthy();
    // Seat 5 (index 4) renders three times: the attack row's target
    // figure, the diagram's target medal, and the identity wall — and
    // exactly one of them is the filled emphasis (the diagram medal).
    const targetTexts = view.getAllByText('5');
    expect(targetTexts).toHaveLength(3);
    const filled = targetTexts.filter((node) => enclosingBackgroundColor(node) === colors.primary);
    expect(filled).toHaveLength(1);
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

    expect(view.getByText('狼队目标不一致 — 平票，目标未记录')).toBeTruthy();
    expect(view.queryByText('狼队目标不一致 — 平票，未击杀')).toBeNull();
    expect(view.queryByText('狼队共同目标')).toBeNull();
    // No resolved target: the attack row points at ✗, and the diagram
    // groups order by target seat ascending on equal counts.
    expect(view.getByText('✗')).toBeTruthy();
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence.indexOf('5')).toBeLessThan(sequence.indexOf('6'));
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

    expect(view.getByText('狼队目标不一致 — 平票抽中目标')).toBeTruthy();
    expect(view.queryByText('狼队目标不一致 — 平票，未击杀')).toBeNull();
    // The resolved target's number appears four times: the attack row's
    // figure, the diagram's filled medal, the death stamp, and the
    // identity wall — exactly one of them is the filled emphasis.
    const targetTexts = view.getAllByText('6');
    expect(targetTexts).toHaveLength(4);
    const filled = targetTexts.filter((node) => enclosingBackgroundColor(node) === colors.primary);
    expect(filled).toHaveLength(1);
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

    expect(view.getByText('狼队目标不一致 — 平票，未击杀')).toBeTruthy();
    expect(view.getByText('✗')).toBeTruthy();
  });

  it('merges the witch poison and unused antidote into one card', () => {
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

    expect(view.getByText('毒杀')).toBeTruthy();
    expect(view.getByText('目标出局')).toBeTruthy();
    // Death card byline names the poison owner.
    expect(view.getByText('女巫下毒')).toBeTruthy();
    expect(view.getAllByText('毒杀出局')).toHaveLength(2);
    // The unused antidote is an ✗ line with its note, and the derived
    // "wolf target not saved" note sits under the card — no strip appears.
    expect(view.getByText('解药')).toBeTruthy();
    expect(view.getByText('未使用')).toBeTruthy();
    expect(view.getByText('狼刀目标未救')).toBeTruthy();
    expect(view.queryByText('未行动')).toBeNull();
    expect(view.queryByText('女巫未使用解药')).toBeNull();
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

    // Conclusion header: both deaths, stats, derived bylines.
    expect(view.getByText('昨夜 2 人出局')).toBeTruthy();
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence).toContain(ledgerCell('狼杀', 1));
    expect(sequence).toContain(ledgerCell('毒杀', 1));
    expect(sequence).toContain(ledgerCell('救活', 0));
    expect(sequence).toContain(ledgerCell('查验', 1));
    expect(view.getByText('狼队 2 票锁定')).toBeTruthy();
    expect(view.getByText('女巫下毒')).toBeTruthy();
    // Wolf team row: split verdict, abstention group in the diagram.
    expect(view.getByText('狼队目标不一致 — 按多数票击杀')).toBeTruthy();
    expect(view.queryByText('狼队共同目标')).toBeNull();
    expect(view.getByText('空刀')).toBeTruthy();
    // The -1 abstention sentinel never surfaces as a seat: no bare 「0」
    // medal and no 「0号」 text in the whole sequence.
    expect(sequence).not.toContain('0');
    expect(sequence).not.toContain('0号');
    // Witch card: poison line with the out note and the merged notes.
    expect(view.getByText('目标出局')).toBeTruthy();
    expect(view.getByText('未使用')).toBeTruthy();
    expect(view.getByText('狼刀目标未救')).toBeTruthy();
    // Seer picture row: check with the 好人 result tag.
    expect(view.getByText('好人')).toBeTruthy();
    // Hunter determination row: the seat lives on the figure only — no
    // （3号） text — and the state reads 可以发动.
    expect(view.getAllByText('猎人').length).toBeGreaterThanOrEqual(2);
    expect(view.getByText('可以发动')).toBeTruthy();
    expect(view.queryByText('（3号）')).toBeNull();
    expect(view.queryByText('3号')).toBeNull();
    // Identity wall statuses.
    expect(view.getAllByText('存活')).toHaveLength(10);
    expect(view.getAllByText('狼杀出局')).toHaveLength(2);
    expect(view.getAllByText('毒杀出局')).toHaveLength(2);
    // No idle entries this night: no strip.
    expect(view.queryByText('未行动')).toBeNull();
  });

  it('renders an all-abstain wolf night with only the abstain group', () => {
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

    expect(view.getByText('狼队全员空刀')).toBeTruthy();
    expect(view.getAllByText('空刀').length).toBeGreaterThanOrEqual(1);
    expect(view.queryByText('狼队共同目标')).toBeNull();
    expect(view.queryByText('狼队目标不一致 — 按多数票击杀')).toBeNull();
    expect(view.getByText('✗')).toBeTruthy();
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence).not.toContain('0');
    expect(sequence).not.toContain('0号');
  });

  it('renders idle actors as dimmed status rows in night order', () => {
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
    // status row carrying its phrase and no tag, no ✗; the order on the
    // page is the engine's summary order (wolf, then guard, then seer),
    // with no faction regrouping.
    expect(view.getByText('未守护')).toBeTruthy();
    expect(view.getByText('未查验')).toBeTruthy();
    expect(view.queryByText('未行动')).toBeNull();
    expect(view.queryByText('守卫 2号 未守护')).toBeNull();
    expect(indexOf('第一天')).toBeLessThan(indexOf('狼队'));
    expect(indexOf('狼队')).toBeLessThan(indexOf('未守护'));
    expect(indexOf('未守护')).toBeLessThan(indexOf('未查验'));
    expect(indexOf('未查验')).toBeLessThan(indexOf('全员身份'));
  });

  it('renders idle confirmations and unused potions as status rows', () => {
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

    // Knowledge confirmations are positive status sentences, not
    // absences; the witch used no antidote and the poisoner did not
    // poison, so both dissolve into status rows. The wolf team recorded
    // no vote, so its row points at ✗ — the only ✗ on the page.
    expect(view.getByText('已确认狼同伴')).toBeTruthy();
    expect(view.getByText('已确认阵营')).toBeTruthy();
    expect(view.getByText('未使用解药')).toBeTruthy();
    expect(view.getByText('未使用毒药')).toBeTruthy();
    expect(view.getByText('未学习')).toBeTruthy();
    expect(view.getByText('未选择目标')).toBeTruthy();
    expect(view.getAllByText('✗')).toHaveLength(1);
    expect(view.queryByText('未行动')).toBeNull();
  });

  it('names an identity-family check result with the Chinese role name on the figure tag', () => {
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

    // The figure tag names the role in Chinese; the roster carries the
    // other two 平民. The tag sits on the check row, before the roster.
    expect(view.getAllByText('平民')).toHaveLength(3);
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence.indexOf('平民')).toBeLessThan(sequence.indexOf('全员身份'));
    expect(view.getByText('查验')).toBeTruthy();
    expect(view.queryByText('villager')).toBeNull();
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

    // The seer learned only a faction: the check row reads 预言家 →
    // 查验 → 狼人 → disc number, with no 女巫 anywhere on the row.
    // 女巫 appears twice in total: the witch's own idle-row figure and
    // the identity wall.
    expect(view.getAllByText('女巫')).toHaveLength(2);
    const sequence = collectTextSequence(view.toJSON());
    const nightAt = sequence.indexOf('第 1 夜');
    const actorAt = sequence.indexOf('预言家', nightAt);
    expect(actorAt).toBeGreaterThanOrEqual(0);
    expect(sequence.slice(actorAt, sequence.indexOf('第 1 天'))).toEqual([
      '预言家',
      '4',
      '→',
      '查验',
      '狼人',
      '1',
    ]);
    expect(view.queryByText('villager')).toBeNull();
  });

  it('moves the learned role into the figure tag', () => {
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

    // Learned role is the learn row's figure tag (the witch card's
    // figure and the roster carry the other two 女巫）, not a
    // parenthetical after the target.
    expect(view.getAllByText('女巫')).toHaveLength(3);
    expect(view.queryByText('（女巫）')).toBeNull();
    // The unused poison is an ✗ line with its note, not a sub-line.
    expect(view.getByText('毒药')).toBeTruthy();
    expect(view.getByText('未使用')).toBeTruthy();
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
    expect(canShoot.getByText('可以发动')).toBeTruthy();
    expect(canShoot.queryByText('不能发动')).toBeNull();

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
    expect(cannotShoot.getByText('不能发动')).toBeTruthy();
    expect(cannotShoot.queryByText('可以发动')).toBeNull();
  });

  it('draws the wolf vote diagram with one group per target', () => {
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

    // Every vote group: voters row above, down arrow, target medal
    // below. Two groups (two targets), each exactly three children.
    const arrows = view.getAllByText('↓');
    expect(arrows.length).toBe(2);
    for (const arrow of arrows) {
      const group = nearestViewAncestor(arrow);
      expect(group?.children.length).toBe(3);
    }
    // Grouping and order in document order: the two-voter group first
    // (most votes, target seat ascending on ties), then the one-voter
    // group, then the verdict sentence. The attack row's target figure
    // tag is the first 平民 after the night block header (the death
    // stamp's 平民 comes earlier, the roster's later).
    const sequence = collectTextSequence(view.toJSON());
    const nightAt = sequence.indexOf('第 1 夜');
    const targetTagAt = sequence.indexOf('平民', nightAt);
    expect(targetTagAt).toBeGreaterThanOrEqual(0);
    expect(sequence.slice(targetTagAt, sequence.indexOf('狼队目标不一致 — 按多数票击杀'))).toEqual([
      '平民',
      '6',
      '7',
      '8',
      '↓',
      '6',
      '9',
      '↓',
      '5',
    ]);
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

    expect(view.getByText('⚠ 同守同救，仍然死亡')).toBeTruthy();
    expect(view.getByText('免疫毒药')).toBeTruthy();
    expect(view.getByText('反伤')).toBeTruthy();
    // 查验 appears twice: the seer check row and the reflection row.
    expect(view.getAllByText('查验')).toHaveLength(2);
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
    expect(poisonerPresent.getByText('毒师在场')).toBeTruthy();
    expect(poisonerPresent.getByText('✗')).toBeTruthy();

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
    expect(nightmareBlocked.getByText('被噩梦之影封锁')).toBeTruthy();
    expect(nightmareBlocked.getByText('✗')).toBeTruthy();
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

    for (const phrase of [
      '未封锁',
      '未庇护',
      '未守护',
      '未禁言',
      '未禁票',
      '未诅咒',
      '未摄梦',
      '未交换',
      '未魅惑',
      '未催眠',
      '未使用感染',
      '未使用药水',
      '未查验',
      '未学习',
      '已确认狼同伴',
      '已确认阵营',
    ]) {
      expect(view.getByText(phrase)).toBeTruthy();
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
              { kind: 'peacefulNight' },
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
      const slice = nightBlockSequence(collectTextSequence(view.toJSON()));
      const rows: readonly (readonly string[])[] = [
        ['蚀时狼妃', '1', '→', '庇护', '平民', '10'],
        ['乌鸦', '2', '→', '诅咒', '守卫', '11'],
        ['摄梦人', '3', '→', '摄梦', '女巫', '12'],
        ['禁言长老', '4', '→', '禁言', '预言家', '13'],
        ['禁票长老', '5', '→', '禁票', '狼人', '14'],
        ['狼美人', '6', '→', '魅惑', '猎人', '15'],
        ['觉醒石像鬼', '7', '→', '转化', '机械狼人', '16'],
        ['狼女孩', '8', '→', '表白', '石像鬼', '17'],
        ['混血儿', '9', '→', '选择榜样', '纯白之女', '18'],
      ];
      for (const row of rows) expectOrdered(slice, row);
    });

    it('renders swap and cupidLink targets without role tags (B2, §4.1)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              { kind: 'peacefulNight' },
              { kind: 'swap', actorSeat: 0, seats: [1, 2] },
              { kind: 'cupidLink', actorSeat: 3, seats: [4, 5] },
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
      const slice = nightBlockSequence(collectTextSequence(view.toJSON()));
      expectOrdered(slice, ['魔术师', '1', '→', '交换', '2', '和', '3']);
      expectOrdered(slice, ['丘比特', '4', '→', '连线', '5', '和', '6']);
      expect(slice).not.toContain('平民');
      expect(slice).not.toContain('守卫');
      expect(slice).not.toContain('女巫');
      expect(slice).not.toContain('预言家');
    });

    it('renders hypnotize targets without role tags (B2, §4.1)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              { kind: 'peacefulNight' },
              { kind: 'hypnotize', actorSeat: 0, targetSeats: [1, 2, 3] },
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
      const slice = nightBlockSequence(collectTextSequence(view.toJSON()));
      expectOrdered(slice, ['吹笛者', '1', '→', '催眠', '2', '3', '4']);
      expect(slice).not.toContain('平民');
      expect(slice).not.toContain('守卫');
      expect(slice).not.toContain('女巫');
    });

    it('renders cardChoice as a role tag with no seat number (B2, §4)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              { kind: 'peacefulNight' },
              { kind: 'cardChoice', actorSeat: 0, actorRoleId: 'seer', chosenRoleId: 'wolf' },
            ],
            [reviewIdentity(0, 'seer')],
          )}
          onClose={jest.fn()}
        />,
      );
      const slice = nightBlockSequence(collectTextSequence(view.toJSON()));
      expect(slice).toEqual(['预言家', '1', '→', '选择了', '狼人']);
    });

    it('renders nightmareBlock and mimic notes (B2, §4)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              { kind: 'peacefulNight' },
              { kind: 'nightmareBlock', actorSeat: 0, targetSeat: 1, targetRoleId: 'witch' },
              { kind: 'mimic', actorSeat: 2, targetSeat: 3, isBound: true },
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
      const slice = nightBlockSequence(collectTextSequence(view.toJSON()));
      expectOrdered(slice, ['封锁', '（女巫，技能无效）']);
      expectOrdered(slice, ['模仿', '绑定']);
      expect(view.getByText('（女巫，技能无效）')).toBeTruthy();
      expect(view.getByText('绑定')).toBeTruthy();
    });

    it('renders seed wolf infection success and failure notes (B2, §4)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              { kind: 'peacefulNight' },
              { kind: 'infectConverted', actorSeat: 0, targetSeat: 1 },
              { kind: 'infectFailed', actorSeat: 2, targetSeat: 3 },
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
      const slice = nightBlockSequence(collectTextSequence(view.toJSON()));
      expect(view.getAllByText('感染')).toHaveLength(2);
      expectOrdered(slice, ['感染', '成功', '感染', '失败']);
    });

    it('renders a roleName check on a wolf with the info tag tone (B1 ruling B)', () => {
      const view = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              { kind: 'peacefulNight' },
              {
                kind: 'check',
                actorSeat: 0,
                actorRoleId: 'psychic',
                targetSeat: 1,
                result: 'wolf',
                resultFormat: 'roleName',
              },
            ],
            [reviewIdentity(0, 'psychic'), reviewIdentity(1, 'wolf')],
          )}
          onClose={jest.fn()}
        />,
      );
      const slice = nightBlockSequence(collectTextSequence(view.toJSON()));
      expectOrdered(slice, ['通灵师', '1', '→', '查验', '狼人', '2']);
      const backgrounds = view.getAllByText('狼人').map((node) => enclosingBackgroundColor(node));
      expect(backgrounds).toContain(NIGHT_REPORT_COLORS.godMedalBg);
      expect(backgrounds).not.toContain(NIGHT_REPORT_COLORS.deadMedalBg);
    });

    it('dims a dead faction-check target disc, and only when dead (N5)', () => {
      const deadView = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              {
                kind: 'deaths',
                deaths: [{ seat: 0, reason: 'wolfKill' }],
              },
              {
                kind: 'check',
                actorSeat: 1,
                actorRoleId: 'seer',
                targetSeat: 0,
                result: '狼人',
                resultFormat: 'factionCheck',
              },
            ],
            [reviewIdentity(0, 'wolf', false), reviewIdentity(1, 'seer')],
          )}
          onClose={jest.fn()}
        />,
      );
      expect(deadView.getAllByText('1').some((node) => hasDimmedAncestor(node))).toBe(true);
      const aliveView = render(
        <NightReviewModal
          visible
          data={reviewData(
            [
              { kind: 'peacefulNight' },
              {
                kind: 'check',
                actorSeat: 1,
                actorRoleId: 'seer',
                targetSeat: 0,
                result: '狼人',
                resultFormat: 'factionCheck',
              },
            ],
            [reviewIdentity(0, 'wolf'), reviewIdentity(1, 'seer')],
          )}
          onClose={jest.fn()}
        />,
      );
      expect(aliveView.getAllByText('1').some((node) => hasDimmedAncestor(node))).toBe(false);
    });
  });
});
