/**
 * NightReviewModal component tests — 2026 report presentation.
 *
 * Asserts the full fact set of a composed night survives the report
 * rendering: conclusion header (headline, stats strip, death cards with
 * derived bylines), one card per actor (wolf team card with verdict,
 * merged potion card), the did-not-act strip, the sheriff card across the
 * election state matrix, and the identity wall. Number discipline is
 * pinned throughout: a seat number appears only on its medal, so no
 * 「N号」 text exists anywhere in the report.
 */
import type {
  SheriffElectionResult,
  SheriffElectionState,
} from '@game-judge/game-engine/games/werewolf/public';
import { render } from '@testing-library/react-native';
import type { StyleProp } from 'react-native';
import { StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import { buildNightReviewData } from '../../NightReview.helpers';
import { NIGHT_REPORT_FOOTER_TEXT, NIGHT_REPORT_KICKER } from '../../nightReviewLayout';
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
    sheriffElection: SheriffElectionState;
    sheriffElectionResult: SheriffElectionResult;
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
    sheriffElection: overrides.sheriffElection,
    sheriffElectionResult: overrides.sheriffElectionResult,
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
  it('renders the report sections and modal shell', () => {
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(composedNightState())}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByTestId(TESTIDS.nightReviewModal)).toBeTruthy();
    expect(view.getByText('本局复盘')).toBeTruthy();
    expect(view.getByText(NIGHT_REPORT_KICKER)).toBeTruthy();
    expect(view.getByText('关键行动')).toBeTruthy();
    expect(view.getByText('全员身份')).toBeTruthy();
    expect(view.getByText(NIGHT_REPORT_FOOTER_TEXT)).toBeTruthy();
    // Stats strip tallies for the composed night.
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence).toContain('● 狼杀 1');
    expect(sequence).toContain('● 毒杀 0');
    expect(sequence).toContain('● 救活 0');
    expect(sequence).toContain('● 查验 1');
  });

  it('renders every action fact of the composed night', () => {
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(composedNightState())}
        onClose={jest.fn()}
      />,
    );

    // Conclusion header: headline + death card with the derived byline.
    expect(view.getByText('昨夜 1 人出局')).toBeTruthy();
    expect(view.getAllByText('狼杀出局')).toHaveLength(2);
    expect(view.getByText('狼队 1 票锁定')).toBeTruthy();
    // Wolf team card: shared target, and the target died.
    expect(view.getByText('狼队')).toBeTruthy();
    expect(view.getByText('击杀成立')).toBeTruthy();
    expect(view.getByText('狼队共同目标')).toBeTruthy();
    // Guard card.
    expect(view.getByText('守护')).toBeTruthy();
    // Witch card: the save row plus the unused-poison sub-line.
    expect(view.getByText('使用解药救了')).toBeTruthy();
    expect(view.getByText('毒药未使用')).toBeTruthy();
    // Seer card with its result tag.
    expect(view.getByText('查验')).toBeTruthy();
    expect(view.getAllByText('狼人').length).toBeGreaterThanOrEqual(2);
    // Number discipline: no 「N号」 text anywhere — numbers live on medals.
    expect(view.queryByText('5号 · 平民')).toBeNull();
    expect(view.queryByText('5号')).toBeNull();
    expect(view.queryByText('死亡')).toBeNull();
  });

  it('renders the full identity wall with exactly one out seat', () => {
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(composedNightState())}
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
    const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'villager')]]);
    const view = render(
      <NightReviewModal
        visible
        data={buildNightReviewData(
          makeGameState({ players, bottomCards: ['villager', 'seer', 'guard'] }),
        )}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('底牌组成')).toBeTruthy();
    // 平民 appears on the bottom-card row and on the identity wall.
    expect(view.getAllByText('平民')).toHaveLength(2);
    expect(view.getByText('存活')).toBeTruthy();
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
    expect(view.getByText('空座')).toBeTruthy();
    expect(view.getByText('未分配')).toBeTruthy();
    expect(view.queryByText('狼杀出局')).toBeNull();
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence).toContain('● 狼杀 0');
    expect(sequence).toContain('● 查验 0');
  });

  it('aggregates wolf votes by target with one filled target medal', () => {
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
    // Seat 5 (index 4) renders as a medal twice — the wolf target and the
    // identity wall — and exactly one of them is the filled emphasis.
    const targetTexts = view.getAllByText('5');
    expect(targetTexts).toHaveLength(2);
    const filled = targetTexts.filter((node) => enclosingBackgroundColor(node) === colors.primary);
    expect(filled).toHaveLength(1);
  });

  it('marks tied split wolf votes with the tie verdict', () => {
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

    expect(view.getByText('狼队目标不一致 — 平票，未击杀')).toBeTruthy();
    expect(view.getByText('平票未击杀')).toBeTruthy();
    expect(view.queryByText('狼队共同目标')).toBeNull();
    // One target medal per group even though two wolves voted; equal counts
    // order groups by target seat ascending.
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence.indexOf('5')).toBeLessThan(sequence.indexOf('6'));
  });

  it('merges the witch poison and unused antidote into one card', () => {
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

    expect(view.getByText('毒杀')).toBeTruthy();
    expect(view.getByText('出局')).toBeTruthy();
    // Death card byline names the poison owner.
    expect(view.getByText('女巫下毒')).toBeTruthy();
    expect(view.getAllByText('毒杀出局')).toHaveLength(2);
    // The unused antidote merges into the witch card as a sub-line together
    // with the derived "wolf target not saved" note — no strip appears.
    expect(view.getByText('解药未使用 · 狼刀目标未救')).toBeTruthy();
    expect(view.queryByText('未行动')).toBeNull();
    expect(view.queryByText('女巫未使用解药')).toBeNull();
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

    // Conclusion header: both deaths, stats, derived bylines.
    expect(view.getByText('昨夜 2 人出局')).toBeTruthy();
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence).toContain('● 狼杀 1');
    expect(sequence).toContain('● 毒杀 1');
    expect(sequence).toContain('● 救活 0');
    expect(sequence).toContain('● 查验 1');
    expect(view.getByText('狼队 2 票锁定')).toBeTruthy();
    expect(view.getByText('女巫下毒')).toBeTruthy();
    // Wolf team card: split verdict, kill成立 tag, abstention group.
    expect(view.getByText('狼队目标不一致 — 按多数票击杀')).toBeTruthy();
    expect(view.getByText('击杀成立')).toBeTruthy();
    expect(view.queryByText('狼队共同目标')).toBeNull();
    expect(view.getByText('空刀')).toBeTruthy();
    // The -1 abstention sentinel never surfaces as a seat: no bare 「0」
    // medal and no 「0号」 text in the whole sequence.
    expect(sequence).not.toContain('0');
    expect(sequence).not.toContain('0号');
    // Witch card: poison row with the out tag and the merged sub-line.
    expect(view.getByText('解药未使用 · 狼刀目标未救')).toBeTruthy();
    // Seer card: check with the 好人 result tag.
    expect(view.getByText('好人')).toBeTruthy();
    // Hunter card: the seat lives on the medal only — no （3号） text.
    expect(view.getAllByText('猎人').length).toBeGreaterThanOrEqual(2);
    expect(view.getByText('可发动技能')).toBeTruthy();
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

    expect(view.getByText('狼队全员空刀')).toBeTruthy();
    expect(view.getAllByText('空刀').length).toBeGreaterThanOrEqual(1);
    expect(view.queryByText('狼队共同目标')).toBeNull();
    expect(view.queryByText('狼队目标不一致 — 按多数票击杀')).toBeNull();
    const sequence = collectTextSequence(view.toJSON());
    expect(sequence).not.toContain('0');
    expect(sequence).not.toContain('0号');
  });

  it('drops idle entries into the strip between the cards and the identity wall', () => {
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
    // strip as flowing text, after the action cards, before the wall.
    expect(indexOf('关键行动')).toBeLessThan(indexOf('未行动'));
    expect(indexOf('未行动')).toBeLessThan(indexOf('守卫 2号 未守护 · 预言家 4号 未查验'));
    expect(indexOf('守卫 2号 未守护 · 预言家 4号 未查验')).toBeLessThan(indexOf('全员身份'));
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
    const sevenVillagers = (): Map<number, LocalPlayer | null> =>
      new Map([0, 1, 2, 3, 4, 5, 6].map((seat) => [seat, makePlayer(seat, 'villager')] as const));

    it('renders the full public record for a completed election', () => {
      const view = render(
        <NightReviewModal
          visible
          data={buildNightReviewData(
            makeGameState({
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
          data={buildNightReviewData(
            makeGameState({
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
          data={buildNightReviewData(
            makeGameState({
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
  });
});
