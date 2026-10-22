/**
 * NightReviewShareCard component tests — the share card renders the one shared
 * presentation body (NightReviewReportBody), so its fact set matches the
 * in-room NightReviewModal exactly; only the shell (card frame + share title)
 * is its own.
 */
import { render } from '@testing-library/react-native';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';

import { buildNightReviewData } from '../../NightReview.helpers';
import { NIGHT_REVIEW_NOISE_TITLE } from '../../nightReviewLayout';
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
    expect(view.getByText('毒药未使用')).toBeTruthy();
    expect(view.getByText('预言家查验')).toBeTruthy();
    expect(view.getAllByText('狼人').length).toBeGreaterThanOrEqual(2);
    // Same outcome hero as the modal: headline + death card, no deaths row.
    expect(view.getByText('昨夜 1 人出局')).toBeTruthy();
    // 「5号 · 平民」 now appears twice: the death card and the wolf target's
    // SeatIdentityChip in the action zone carry the same seat+identity label.
    expect(view.getAllByText('5号 · 平民').length).toBeGreaterThanOrEqual(2);
    expect(view.getByText('狼杀')).toBeTruthy();
    expect(view.queryByText('死亡')).toBeNull();
    expect(view.getByText('出局')).toBeTruthy();
  });

  it('renders the same outcome hero and noise zone as the modal', () => {
    const players = new Map<number, LocalPlayer | null>([
      [0, makePlayer(0, 'wolf')],
      [1, makePlayer(1, 'guard')],
      [4, makePlayer(4, 'villager')],
    ]);
    const view = render(
      <NightReviewShareCard
        data={buildNightReviewData(
          makeGameState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': 4 } },
          }),
        )}
        roomCode="1234"
      />,
    );

    // Peaceful night: hero headline + sub-line, and the guard's idle entry
    // lands in the noise zone exactly like the modal presentation.
    expect(view.getByText('昨夜平安夜')).toBeTruthy();
    expect(view.getByText('无人出局')).toBeTruthy();
    expect(view.getByText(NIGHT_REVIEW_NOISE_TITLE)).toBeTruthy();
    expect(view.getByText('守卫未守护')).toBeTruthy();
  });

  it('renders wolf abstentions as an empty-attack group, never as seat 0', () => {
    const players = new Map<number, LocalPlayer | null>([
      [0, makePlayer(0, 'wolf')],
      [1, makePlayer(1, 'wolf')],
      [4, makePlayer(4, 'villager')],
    ]);
    const view = render(
      <NightReviewShareCard
        data={buildNightReviewData(
          makeGameState({
            players,
            currentNightResults: { wolfVotesBySeat: { '0': 4, '1': -1 } },
          }),
        )}
        roomCode="1234"
      />,
    );

    // Same presentation as the modal: one real target group (shared-target
    // wording judges real targets only) plus the abstention group; the -1
    // sentinel never surfaces as a 「0」 seat anywhere on the card.
    expect(view.getByText('昨夜平安夜')).toBeTruthy();
    expect(view.getByText('狼人袭击')).toBeTruthy();
    expect(view.getByText('空刀')).toBeTruthy();
    expect(view.getByText('狼队共同目标')).toBeTruthy();
    expect(view.getAllByText('5号 · 平民').length).toBeGreaterThanOrEqual(1);
    expect(view.getAllByText('2号 · 狼人').length).toBeGreaterThanOrEqual(1);
    expect(view.queryByText('0')).toBeNull();
    expect(view.queryByText('0号')).toBeNull();
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
