/**
 * NightReviewModal component tests — v4 structured presentation.
 *
 * Asserts the full fact set of a composed night survives the structured
 * rendering: action events, identity grid, out markers, disclaimer chip.
 */
import { render } from '@testing-library/react-native';
import type { StyleProp } from 'react-native';
import { StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';
import { TESTIDS } from '@/testids';
import { colors, withAlpha } from '@/theme';

import { buildNightReviewData } from '../../NightReview.helpers';
import { NightReviewModal } from '../NightReviewModal';

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
  it('renders the disclaimer chip, section labels and modal shell', () => {
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
    expect(view.getByText('女巫未使用毒药')).toBeTruthy();
    expect(view.getByText('预言家查验')).toBeTruthy();
    // Check result pill for the seer reveal (狼人 verdict on seat 0).
    expect(view.getAllByText('狼人').length).toBeGreaterThanOrEqual(2);
    // Deaths event with the wolf-kill reason label.
    expect(view.getByText('死亡')).toBeTruthy();
    expect(view.getByText('狼杀')).toBeTruthy();
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
    expect(view.getByText('空座')).toBeTruthy();
    expect(view.getByText('未分配')).toBeTruthy();
    expect(view.queryByText('已出局')).toBeNull();
  });
});
