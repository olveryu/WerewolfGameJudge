/**
 * NightReviewModal component tests — v5 presentation.
 *
 * Asserts the full fact set of a composed night survives the v5 rendering:
 * outcome hero (headline + death cards), action timeline (aggregated wolf
 * votes, merged potion rows), noise zone for idle entries, identity grid.
 */
import { render } from '@testing-library/react-native';
import type { StyleProp } from 'react-native';
import { StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';
import { TESTIDS } from '@/testids';
import { colors, withAlpha } from '@/theme';

import { buildNightReviewData } from '../../NightReview.helpers';
import { NIGHT_REVIEW_NOISE_TITLE } from '../../nightReviewLayout';
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

function makePlayer(seat: number, role: string | null): LocalPlayer {
  return {
    userId: `uid-${seat}`,
    seat,
    role: role as LocalPlayer['role'],
    hasViewedRole: true,
  };
}

function makeGameState(
  overrides: Partial<{
    currentNightResults: LocalGameState['currentNightResults'];
    lastNightDeaths: number[];
    deathReasons: LocalGameState['deathReasons'];
    players: Map<number, LocalPlayer | null>;
    seerReveal: { targetSeat: number; result: '好人' | '狼人' };
    bottomCards: LocalGameState['bottomCards'];
  }> = {},
): LocalGameState {
  return {
    currentNightResults: overrides.currentNightResults ?? {},
    lastNightDeaths: overrides.lastNightDeaths ?? [],
    deathReasons: overrides.deathReasons,
    bottomCards: overrides.bottomCards,
    players: overrides.players ?? new Map(),
    actions: new Map(),
    seerReveal: overrides.seerReveal,
  } as unknown as LocalGameState;
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

function composedNightState(): LocalGameState {
  const players = new Map<number, LocalPlayer | null>([
    [0, makePlayer(0, 'wolf')],
    [1, makePlayer(1, 'guard')],
    [2, makePlayer(2, 'witch')],
    [3, makePlayer(3, 'seer')],
    [4, makePlayer(4, 'villager')],
  ]);
  return makeGameState({
    players,
    currentNightResults: {
      wolfVotesBySeat: { '0': 4 },
      guardedSeat: 3,
      savedSeat: 4,
    },
    seerReveal: { targetSeat: 0, result: '狼人' },
    lastNightDeaths: [4],
    deathReasons: { 4: 'wolfKill' },
  });
}

describe('NightReviewModal', () => {
  it('renders the disclaimer line, section labels and modal shell', () => {
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(composedNightState())}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByTestId(TESTIDS.nightReviewModal)).toBeTruthy();
    expect(view.getByText('本局复盘')).toBeTruthy();
    expect(view.getByText('仅供裁判及观战者参考')).toBeTruthy();
    expect(view.getByText('第一夜 · 行动')).toBeTruthy();
    expect(view.getByText('全员身份')).toBeTruthy();
  });

  it('renders every action fact of the composed night', () => {
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(composedNightState())}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('狼人袭击')).toBeTruthy();
    expect(view.getByText('守卫守护')).toBeTruthy();
    expect(view.getByText('女巫使用解药救了')).toBeTruthy();
    // The unused poison merges into the witch row as a sub-line.
    expect(view.getByText('毒药未使用')).toBeTruthy();
    expect(view.getByText('预言家查验')).toBeTruthy();
    // Check result pill for the seer reveal (狼人 verdict on seat 0).
    expect(view.getAllByText('狼人').length).toBeGreaterThanOrEqual(2);
    // The outcome renders once, in the hero: headline + death card
    // (seat + identity + wolf-kill reason), not as a timeline row.
    expect(view.getByText('昨夜 1 人出局')).toBeTruthy();
    // 「5号 · 平民」 now appears on the death card AND on the action-row seat
    // identity chips (wolf-attack target, witch save target).
    expect(view.getAllByText('5号 · 平民').length).toBeGreaterThanOrEqual(2);
    expect(view.getByText('狼杀')).toBeTruthy();
    expect(view.queryByText('死亡')).toBeNull();
    // The wolf attack target died: the row carries an out pill.
    expect(view.getByText('出局')).toBeTruthy();
  });

  it('renders the full identity grid with exactly one out marker', () => {
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(composedNightState())}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('1号')).toBeTruthy();
    expect(view.getByText('2号')).toBeTruthy();
    expect(view.getByText('3号')).toBeTruthy();
    expect(view.getByText('4号')).toBeTruthy();
    expect(view.getByText('5号')).toBeTruthy();
    expect(view.getByText('守卫')).toBeTruthy();
    expect(view.getByText('女巫')).toBeTruthy();
    expect(view.getByText('预言家')).toBeTruthy();
    expect(view.getByText('平民')).toBeTruthy();
    // Only seat 5 (index 4) died last night.
    expect(view.getAllByText('已出局')).toHaveLength(1);
  });

  it('renders villager surfaces in neutral gray, never the villager green', () => {
    const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'villager')]]);
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(makeGameState({ players, bottomCards: ['villager'] }))}
        onClose={jest.fn()}
      />,
    );

    // Both villager surfaces fed by the shared faction mapping — the identity
    // card role text and the bottom-card role chip — render gray per the
    // approved review design （民灰）, not colors.villager green.
    const villagerTexts = view.getAllByText('平民');
    expect(villagerTexts).toHaveLength(2);
    const grayWashes = [
      withAlpha(colors.textSecondary, 0.1),
      withAlpha(colors.textSecondary, 0.12),
    ];
    for (const textNode of villagerTexts) {
      const textColor = flattenStyle(textNode.props.style)?.color;
      expect(textColor).toBe(colors.textSecondary);
      expect(textColor).not.toBe(colors.villager);
      expect(grayWashes).toContain(enclosingBackgroundColor(textNode));
    }
  });

  it('renders a peaceful night and placeholder identities', () => {
    const players = new Map<number, LocalPlayer | null>([
      [0, null],
      [1, makePlayer(1, null)],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(makeGameState({ players }))}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('昨夜平安夜')).toBeTruthy();
    expect(view.getByText('无人出局')).toBeTruthy();
    expect(view.getByText('空座')).toBeTruthy();
    expect(view.getByText('未分配')).toBeTruthy();
    expect(view.queryByText('已出局')).toBeNull();
  });

  it('aggregates wolf votes by target with one filled target dot', () => {
    const players = new Map<number, LocalPlayer | null>([
      [0, makePlayer(0, 'wolf')],
      [1, makePlayer(1, 'wolf')],
      [2, makePlayer(2, 'wolf')],
      [3, makePlayer(3, 'wolf')],
      [4, makePlayer(4, 'villager')],
      [5, makePlayer(5, 'seer')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(
          makeGameState({
            players,
            currentNightResults: {
              wolfVotesBySeat: { '0': 4, '1': 4, '2': 4, '3': 4 },
            },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('狼队共同目标')).toBeTruthy();
    // Four wolves voted seat 5 (index 4): the target dot renders once, not
    // once per vote, and it is the filled emphasis variant (primary fill).
    const targetTexts = view.getAllByText('5');
    expect(targetTexts).toHaveLength(1);
    expect(enclosingBackgroundColor(targetTexts[0]!)).toBe(colors.primary);
  });

  it('marks split wolf votes with per-target groups and the split sub-line', () => {
    const players = new Map<number, LocalPlayer | null>([
      [0, makePlayer(0, 'wolf')],
      [1, makePlayer(1, 'wolf')],
      [4, makePlayer(4, 'villager')],
      [5, makePlayer(5, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(
          makeGameState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': 5, '1': 4 } },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('狼队目标不一致')).toBeTruthy();
    expect(view.queryByText('狼队共同目标')).toBeNull();
    // One dot per target, even though two wolves voted.
    expect(view.getAllByText('5')).toHaveLength(1);
    expect(view.getAllByText('6')).toHaveLength(1);
    // Equal vote counts order groups by target seat ascending.
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence.indexOf('5')).toBeLessThan(sequence.indexOf('6'));
  });

  it('merges the witch poison and unused antidote into one row', () => {
    const players = new Map<number, LocalPlayer | null>([
      [0, makePlayer(0, 'wolf')],
      [1, makePlayer(1, 'villager')],
      [2, makePlayer(2, 'witch')],
      [3, makePlayer(3, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(
          makeGameState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': 1 }, poisonedSeat: 3 },
            lastNightDeaths: [3],
            deathReasons: { 3: 'poison' },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('女巫使用毒药毒杀')).toBeTruthy();
    expect(view.getByText('解药未使用')).toBeTruthy();
    expect(view.getByText('出局')).toBeTruthy();
    // The unused antidote is absorbed by the merged row: it must not repeat
    // as a noise-zone chip, and with no other idle entries the zone is absent.
    expect(view.queryByText('女巫未使用解药')).toBeNull();
    expect(view.queryByText(NIGHT_REVIEW_NOISE_TITLE)).toBeNull();
  });

  it('renders the screenshot night: split votes, one abstention, seat identities', () => {
    // The user-reported night (room 2219), seats 0-based: wolves on seats
    // 7/8/9/12号 vote 6号 + 5号, 12号 abstains; the witch poisons 12号 (a
    // wolf), the seer checks 5号, the hunter sits on 3号.
    const players = new Map<number, LocalPlayer | null>([
      [0, makePlayer(0, 'villager')],
      [1, makePlayer(1, 'villager')],
      [2, makePlayer(2, 'hunter')],
      [3, makePlayer(3, 'seer')],
      [4, makePlayer(4, 'villager')],
      [5, makePlayer(5, 'villager')],
      [6, makePlayer(6, 'wolf')],
      [7, makePlayer(7, 'wolf')],
      [8, makePlayer(8, 'wolf')],
      [9, makePlayer(9, 'witch')],
      [10, makePlayer(10, 'villager')],
      [11, makePlayer(11, 'wolf')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(
          makeGameState({
            players,
            currentNightResults: {
              wolfVotesBySeat: { '6': 5, '7': 5, '8': 4, '11': -1 },
              poisonedSeat: 11,
            },
            seerReveal: { targetSeat: 4, result: '好人' },
            lastNightDeaths: [5, 11],
            deathReasons: { 5: 'wolfKill', 11: 'poison' },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    // Hero: both deaths with identities and reasons.
    expect(view.getByText('昨夜 2 人出局')).toBeTruthy();
    expect(view.getAllByText('6号 · 平民').length).toBeGreaterThanOrEqual(1);
    expect(view.getAllByText('12号 · 狼人').length).toBeGreaterThanOrEqual(2);
    // The abstention renders as an 空刀 group — never as a seat "0" target.
    expect(view.getByText('空刀')).toBeTruthy();
    expect(view.queryByText('0')).toBeNull();
    expect(view.queryByText('0号')).toBeNull();
    // Real targets form exactly two groups (split wording below). The 6号
    // target chip repeats the death card's identity label — without the chip
    // the label would appear only once.
    expect(view.getAllByText('6号 · 平民').length).toBeGreaterThanOrEqual(2);
    expect(view.getByText('狼队目标不一致')).toBeTruthy();
    expect(view.queryByText('狼队共同目标')).toBeNull();
    // The poison row's target carries its identity (12号 is the wolf).
    expect(view.getByText('女巫使用毒药毒杀')).toBeTruthy();
    // The check row's target carries its identity too (5号 · 平民 appears on
    // the wolf-attack target chip and the seer-check chip).
    expect(view.getAllByText('5号 · 平民').length).toBeGreaterThanOrEqual(2);
    // The hunter row names its seat: 猎人（3号）. 「猎人」 itself appears on
    // both the identity grid and the shoot-status row title.
    expect(view.getAllByText('猎人').length).toBeGreaterThanOrEqual(2);
    expect(view.getByText('（3号）')).toBeTruthy();
    expect(view.getByText('可以发动技能')).toBeTruthy();
  });

  it('renders an all-abstain wolf night with only the abstain group', () => {
    const players = new Map<number, LocalPlayer | null>([
      [0, makePlayer(0, 'wolf')],
      [1, makePlayer(1, 'wolf')],
      [2, makePlayer(2, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(
          makeGameState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': -1, '1': -1 } },
          }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('狼人袭击')).toBeTruthy();
    expect(view.getByText('空刀')).toBeTruthy();
    // No real target: no shared/split wording and no filled target dot.
    expect(view.queryByText('狼队共同目标')).toBeNull();
    expect(view.queryByText('狼队目标不一致')).toBeNull();
    expect(view.queryByText('0')).toBeNull();
  });

  it('drops idle entries into the noise zone between timeline and identities', () => {
    const players = new Map<number, LocalPlayer | null>([
      [0, makePlayer(0, 'wolf')],
      [1, makePlayer(1, 'guard')],
      [3, makePlayer(3, 'seer')],
      [4, makePlayer(4, 'villager')],
    ]);
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(
          makeGameState({
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
    // The guard never guarded and the seer never checked: both land in the
    // noise zone, after the effective timeline and before the identity grid.
    expect(indexOf('狼人袭击')).toBeLessThan(indexOf(NIGHT_REVIEW_NOISE_TITLE));
    expect(indexOf(NIGHT_REVIEW_NOISE_TITLE)).toBeLessThan(indexOf('守卫未守护'));
    expect(indexOf('守卫未守护')).toBeLessThan(indexOf('预言家未查验'));
    expect(indexOf('预言家未查验')).toBeLessThan(indexOf('全员身份'));
  });
});
