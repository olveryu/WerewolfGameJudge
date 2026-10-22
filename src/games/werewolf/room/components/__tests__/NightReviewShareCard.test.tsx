/**
 * NightReviewShareCard component tests — the share card renders the one shared
 * presentation body (NightReviewReportBody), so its fact set matches the
 * in-room NightReviewModal exactly; only the shell (card frame + share title)
 * is its own.
 */
import { render } from '@testing-library/react-native';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';

import { buildNightReviewData } from '../../NightReview.helpers';
import { NightReviewShareCard } from '../NightReviewShareCard';

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

describe('NightReviewShareCard', () => {
  it('renders the share title and the shared presentation sections', () => {
    const view = render(
      <NightReviewShareCard data={buildNightReviewData(composedNightState())} roomCode="1234" />,
    );

    expect(view.getByText('房间 1234 战报')).toBeTruthy();
    expect(view.getByText('仅供裁判及观战者参考')).toBeTruthy();
    expect(view.getByText('第一夜 · 行动')).toBeTruthy();
    expect(view.getByText('全员身份')).toBeTruthy();
  });

  it('renders the same action facts as the modal presentation', () => {
    const view = render(
      <NightReviewShareCard data={buildNightReviewData(composedNightState())} roomCode="1234" />,
    );

    expect(view.getByText('狼人袭击')).toBeTruthy();
    expect(view.getByText('守卫守护')).toBeTruthy();
    expect(view.getByText('女巫使用解药救了')).toBeTruthy();
    expect(view.getByText('女巫未使用毒药')).toBeTruthy();
    expect(view.getByText('预言家查验')).toBeTruthy();
    expect(view.getAllByText('狼人').length).toBeGreaterThanOrEqual(2);
    expect(view.getByText('死亡')).toBeTruthy();
    expect(view.getByText('狼杀')).toBeTruthy();
    expect(view.getByText('出局')).toBeTruthy();
  });

  it('renders the identity grid with exactly one out marker', () => {
    const view = render(
      <NightReviewShareCard data={buildNightReviewData(composedNightState())} roomCode="1234" />,
    );

    expect(view.getByText('1号')).toBeTruthy();
    expect(view.getByText('5号')).toBeTruthy();
    expect(view.getByText('守卫')).toBeTruthy();
    expect(view.getByText('女巫')).toBeTruthy();
    expect(view.getByText('预言家')).toBeTruthy();
    expect(view.getByText('平民')).toBeTruthy();
    expect(view.getAllByText('已出局')).toHaveLength(1);
  });

  it('does not render the legacy plain-text summary lines', () => {
    const view = render(
      <NightReviewShareCard data={buildNightReviewData(composedNightState())} roomCode="1234" />,
    );

    // The pre-extraction card printed formatNightReview* lines verbatim
    // (e.g. "🐺 狼人袭击：1号→5号"); the shared body renders structure instead.
    expect(view.queryByText(/狼人袭击：/)).toBeNull();
    expect(view.queryByText(/5号: 平民/)).toBeNull();
  });
});
