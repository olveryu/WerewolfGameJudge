import type { LocalGameState, LocalPlayer } from '@/types/GameStateTypes';

import { buildActionLines, buildIdentityLines, buildNightReviewData } from '../NightReview.helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal LocalGameState-like object for testing */
function makeGameState(
  overrides: Partial<{
    currentNightResults: LocalGameState['currentNightResults'];
    lastNightDeaths: number[];
    players: Map<number, LocalPlayer | null>;
    seerReveal: { targetSeat: number; result: '好人' | '狼人' };
    wolfRobotReveal: { targetSeat: number; result: string; learnedRoleId: string };
  }> = {},
): LocalGameState {
  return {
    currentNightResults: overrides.currentNightResults ?? {},
    lastNightDeaths: overrides.lastNightDeaths ?? [],
    players: overrides.players ?? new Map(),
    seerReveal: overrides.seerReveal,
    wolfRobotReveal: overrides.wolfRobotReveal,
  } as unknown as LocalGameState;
}

function makePlayer(seat: number, role: string | null): LocalPlayer {
  return {
    uid: `uid-${seat}`,
    seatNumber: seat,
    role: role as LocalPlayer['role'],
    hasViewedRole: true,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NightReview.helpers', () => {
  describe('buildActionLines', () => {
    it('returns peaceful night when no deaths and no actions', () => {
      const lines = buildActionLines(makeGameState());
      expect(lines).toEqual(['✅ 昨夜平安夜']);
    });

    it('shows wolf votes', () => {
      const lines = buildActionLines(
        makeGameState({
          currentNightResults: {
            wolfVotesBySeat: { '2': 4, '3': 4 },
          },
        }),
      );
      expect(lines[0]).toContain('狼人投票');
      expect(lines[0]).toContain('3号→5号');
      expect(lines[0]).toContain('4号→5号');
    });

    it('shows guard protection', () => {
      const lines = buildActionLines(makeGameState({ currentNightResults: { guardedSeat: 1 } }));
      expect(lines).toContainEqual(expect.stringContaining('守卫守护了 2号'));
    });

    it('shows witch save and poison', () => {
      const lines = buildActionLines(
        makeGameState({ currentNightResults: { savedSeat: 3, poisonedSeat: 5 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('女巫救了 4号'));
      expect(lines).toContainEqual(expect.stringContaining('女巫毒了 6号'));
    });

    it('shows nightmare block', () => {
      const lines = buildActionLines(makeGameState({ currentNightResults: { blockedSeat: 0 } }));
      expect(lines).toContainEqual(expect.stringContaining('梦魇封锁了 1号'));
    });

    it('shows dreamcatcher protection', () => {
      const lines = buildActionLines(makeGameState({ currentNightResults: { dreamingSeat: 2 } }));
      expect(lines).toContainEqual(expect.stringContaining('追梦人守护了 3号'));
    });

    it('shows magician swap', () => {
      const lines = buildActionLines(
        makeGameState({ currentNightResults: { swappedSeats: [1, 4] } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('魔术师交换了 2号 和 5号'));
    });

    it('shows seer reveal', () => {
      const lines = buildActionLines(
        makeGameState({ seerReveal: { targetSeat: 2, result: '狼人' } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('预言家查验 3号：狼人'));
    });

    it('shows wolf robot learn', () => {
      const lines = buildActionLines(
        makeGameState({
          wolfRobotReveal: { targetSeat: 5, result: '猎人', learnedRoleId: 'hunter' },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('机械狼学习了 6号'));
      expect(lines).toContainEqual(expect.stringContaining('猎人'));
    });

    it('shows death list', () => {
      const lines = buildActionLines(makeGameState({ lastNightDeaths: [0, 3] }));
      expect(lines).toContainEqual(expect.stringContaining('死亡：1号、4号'));
    });

    it('shows wolf kill disabled', () => {
      const lines = buildActionLines(
        makeGameState({ currentNightResults: { wolfKillDisabled: true } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('狼人刀空'));
    });
  });

  describe('buildIdentityLines', () => {
    it('returns empty for no players', () => {
      expect(buildIdentityLines(new Map())).toEqual([]);
    });

    it('builds identity list sorted by seat', () => {
      const players = new Map<number, LocalPlayer | null>([
        [2, makePlayer(2, 'seer')],
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'villager')],
      ]);
      const lines = buildIdentityLines(players);
      expect(lines[0]).toBe('1号: 狼人');
      expect(lines[1]).toBe('2号: 普通村民');
      expect(lines[2]).toBe('3号: 预言家');
    });

    it('shows empty seat', () => {
      const players = new Map<number, LocalPlayer | null>([[0, null]]);
      expect(buildIdentityLines(players)).toEqual(['1号: 空座']);
    });

    it('shows unassigned role', () => {
      const players = new Map([[0, makePlayer(0, null)]]);
      expect(buildIdentityLines(players)).toEqual(['1号: 未分配']);
    });
  });

  describe('buildNightReviewData', () => {
    it('returns both sections', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'werewolf')],
        [1, makePlayer(1, 'seer')],
      ]);
      const data = buildNightReviewData(
        makeGameState({
          players,
          currentNightResults: { guardedSeat: 1 },
          lastNightDeaths: [0],
        }),
      );
      expect(data.actionLines.length).toBeGreaterThan(0);
      expect(data.identityLines.length).toBe(2);
    });
  });
});
