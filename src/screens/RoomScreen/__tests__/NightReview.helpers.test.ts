import { makeActionTarget } from '@werewolf/game-engine/models/actions/RoleAction';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';
import { NIGHT_STEPS } from '@werewolf/game-engine/models/roles/spec/nightSteps';

import type { LocalGameState, LocalPlayer } from '@/types/GameStateTypes';

import { buildActionLines, buildIdentityLines, buildNightReviewData } from '../NightReview.helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal LocalGameState-like object for testing */
function makeGameState(
  overrides: Partial<{
    currentNightResults: LocalGameState['currentNightResults'];
    lastNightDeaths: number[];
    players: Map<number, LocalPlayer | null>;
    actions: Map<RoleId, ReturnType<typeof makeActionTarget>>;
    seerReveal: { targetSeat: number; result: '好人' | '狼人' };
    wolfRobotReveal: { targetSeat: number; result: string; learnedRoleId: string };
  }> = {},
): LocalGameState {
  return {
    currentNightResults: overrides.currentNightResults ?? {},
    lastNightDeaths: overrides.lastNightDeaths ?? [],
    players: overrides.players ?? new Map(),
    actions: overrides.actions ?? new Map(),
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
      expect(lines).toContainEqual(expect.stringContaining('摄梦人守护了 3号'));
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

    it('shows slacker idol choice', () => {
      const actions = new Map([['slacker' as RoleId, makeActionTarget(3)]]);
      const lines = buildActionLines(makeGameState({ actions }));
      expect(lines).toContainEqual(expect.stringContaining('混子选择了 4号 为榜样'));
    });

    it('shows wildChild idol choice', () => {
      const actions = new Map([['wildChild' as RoleId, makeActionTarget(1)]]);
      const lines = buildActionLines(makeGameState({ actions }));
      expect(lines).toContainEqual(expect.stringContaining('野孩子选择了 2号 为榜样'));
    });

    it('shows wolfQueen charm', () => {
      const actions = new Map([['wolfQueen' as RoleId, makeActionTarget(4)]]);
      const lines = buildActionLines(makeGameState({ actions }));
      expect(lines).toContainEqual(expect.stringContaining('狼美人魅惑了 5号'));
    });

    it('shows hunter can shoot when not poisoned', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'wolf')],
      ]);
      const lines = buildActionLines(makeGameState({ players }));
      expect(lines).toContainEqual(expect.stringContaining('猎人可以发动技能'));
    });

    it('shows hunter cannot shoot when poisoned', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'wolf')],
      ]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { poisonedSeat: 0 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('猎人不能发动技能'));
    });

    it('shows darkWolfKing can shoot when not poisoned', () => {
      const players = new Map<number, LocalPlayer | null>([[2, makePlayer(2, 'darkWolfKing')]]);
      const lines = buildActionLines(makeGameState({ players }));
      expect(lines).toContainEqual(expect.stringContaining('黑狼王可以发动技能'));
    });

    it('shows darkWolfKing cannot shoot when poisoned', () => {
      const players = new Map<number, LocalPlayer | null>([[2, makePlayer(2, 'darkWolfKing')]]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { poisonedSeat: 2 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('黑狼王不能发动技能'));
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

  describe('contract: every NIGHT_STEPS role produces a line with its displayName', () => {
    it('buildActionLines covers all night-action roles', () => {
      // Build a maximal game state with ALL roles' night actions populated
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'nightmare')],
        [2, makePlayer(2, 'guard')],
        [3, makePlayer(3, 'witch')],
        [4, makePlayer(4, 'dreamcatcher')],
        [5, makePlayer(5, 'magician')],
        [6, makePlayer(6, 'hunter')],
        [7, makePlayer(7, 'darkWolfKing')],
        [8, makePlayer(8, 'seer')],
        [9, makePlayer(9, 'mirrorSeer')],
        [10, makePlayer(10, 'drunkSeer')],
        [11, makePlayer(11, 'psychic')],
        [12, makePlayer(12, 'gargoyle')],
        [13, makePlayer(13, 'pureWhite')],
        [14, makePlayer(14, 'wolfWitch')],
        [15, makePlayer(15, 'wolfRobot')],
        [16, makePlayer(16, 'wolfQueen')],
        [17, makePlayer(17, 'slacker')],
        [18, makePlayer(18, 'wildChild')],
      ]);

      const actions = new Map<RoleId, ReturnType<typeof makeActionTarget>>([
        ['slacker' as RoleId, makeActionTarget(0)],
        ['wildChild' as RoleId, makeActionTarget(1)],
        ['wolfQueen' as RoleId, makeActionTarget(2)],
      ]);

      const gs = {
        currentNightResults: {
          wolfVotesBySeat: { '0': 8 },
          blockedSeat: 3,
          guardedSeat: 4,
          savedSeat: 5,
          poisonedSeat: 99, // non-existent seat so hunter/darkWolfKing can shoot
          dreamingSeat: 6,
          swappedSeats: [7, 8],
        },
        lastNightDeaths: [8],
        players,
        actions,
        seerReveal: { targetSeat: 0, result: '好人' },
        mirrorSeerReveal: { targetSeat: 1, result: '狼人' },
        drunkSeerReveal: { targetSeat: 2, result: '好人' },
        psychicReveal: { targetSeat: 3, result: '女巫' },
        gargoyleReveal: { targetSeat: 4, result: '预言家' },
        pureWhiteReveal: { targetSeat: 5, result: '守卫' },
        wolfWitchReveal: { targetSeat: 6, result: '猎人' },
        wolfRobotReveal: { targetSeat: 7, result: '猎人', learnedRoleId: 'hunter' },
      } as unknown as LocalGameState;

      const lines = buildActionLines(gs);
      const joined = lines.join('\n');

      // Every NIGHT_STEPS role must appear in output by its canonical displayName
      for (const step of NIGHT_STEPS) {
        const displayName = getRoleDisplayName(step.roleId);
        expect(joined).toContain(displayName);
      }
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
