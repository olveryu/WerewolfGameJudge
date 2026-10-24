import type { DeathReason } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleSpec } from '@game-judge/game-engine/games/werewolf/public';
import type {
  SheriffElectionResult,
  SheriffElectionRoundResult,
  SheriffElectionState,
} from '@game-judge/game-engine/games/werewolf/public';
import { makeActionTarget } from '@game-judge/game-engine/games/werewolf/public';
import { getRoleDisplayName, ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { NIGHT_STEPS } from '@game-judge/game-engine/games/werewolf/public';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';

import {
  buildActionEntries,
  buildIdentityEntries,
  buildNightReviewData,
  deriveDeathNotes,
  deriveNightReportStats,
  deriveSheriffSection,
  deriveWolfTargetSaveNote,
  deriveWolfVerdict,
  getNightReviewOutcome,
  type NightReviewActionEntry,
  nightReviewActorRoleId,
  type NightReviewData,
} from '../NightReview.helpers';
import {
  formatNightReviewActionLine,
  formatNightReviewIdentityLine,
} from '../shareNightReviewLines';

// ─── Legacy line adapters (equivalence harness) ────────────────────────────
// Every legacy assertion below runs against lines formatted FROM the
// structured entries, proving the entry stream carries the same facts in the
// same order as the retired string builders.
function buildActionLines(state: LocalGameState): string[] {
  return buildActionEntries(state).map(formatNightReviewActionLine);
}

function buildIdentityLines(players: Map<number, LocalPlayer | null>): string[] {
  return buildIdentityEntries(players, new Set()).map(formatNightReviewIdentityLine);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal LocalGameState-like object for testing */
function makeGameState(
  overrides: Partial<{
    currentNightResults: LocalGameState['currentNightResults'];
    lastNightDeaths: number[];
    deathReasons: Record<number, DeathReason>;
    players: Map<number, LocalPlayer | null>;
    actions: Map<RoleId, ReturnType<typeof makeActionTarget>>;
    seerReveal: { targetSeat: number; result: '好人' | '狼人' };
    wolfRobotReveal: { targetSeat: number; result: string; learnedRoleId: string };
    bottomCards: readonly RoleId[];
    treasureMasterChosenCard: RoleId;
    thiefChosenCard: RoleId;
    witchContext: { killedSeat: number; canSave: boolean; canPoison: boolean };
    loverSeats: readonly [number, number];
    seedWolfInfectionResult: LocalGameState['seedWolfInfectionResult'];
    sheriffElection: SheriffElectionState;
    sheriffElectionResult: SheriffElectionResult;
  }> = {},
): LocalGameState {
  return {
    currentNightResults: {
      ...(overrides.currentNightResults ?? {}),
      ...(overrides.treasureMasterChosenCard
        ? { treasureMasterChosenCard: overrides.treasureMasterChosenCard }
        : {}),
      ...(overrides.thiefChosenCard ? { thiefChosenCard: overrides.thiefChosenCard } : {}),
    },
    lastNightDeaths: overrides.lastNightDeaths ?? [],
    deathReasons: overrides.deathReasons,
    players: overrides.players ?? new Map(),
    actions: overrides.actions ?? new Map(),
    seerReveal: overrides.seerReveal,
    wolfRobotReveal: overrides.wolfRobotReveal,
    bottomCards: overrides.bottomCards,
    witchContext: overrides.witchContext,
    loverSeats: overrides.loverSeats,
    seedWolfInfectionResult: overrides.seedWolfInfectionResult,
    sheriffElection: overrides.sheriffElection,
    sheriffElectionResult: overrides.sheriffElectionResult,
  } as unknown as LocalGameState;
}

function makePlayer(seat: number, role: string | null): LocalPlayer {
  return {
    userId: `uid-${seat}`,
    seat: seat,
    role: role as LocalPlayer['role'],
    hasViewedRole: true,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NightReview.helpers', () => {
  describe('buildActionLines', () => {
    it('returns peaceful night when no deaths and no actions', () => {
      const lines = buildActionLines(makeGameState());
      expect(lines).toEqual(['🌙 昨夜平安夜']);
    });

    it('shows wolf votes', () => {
      const lines = buildActionLines(
        makeGameState({
          currentNightResults: {
            wolfVotesBySeat: { '2': 4, '3': 4 },
          },
        }),
      );
      expect(lines[0]).toContain('狼人袭击');
      expect(lines[0]).toContain('3号→5号');
      expect(lines[0]).toContain('4号→5号');
    });

    it('shows guard protection', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'guard')]]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { guardedSeat: 1 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('守卫（1号）守护了 2号'));
    });

    it('shows witch save and poison', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'witch')]]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { savedSeat: 3, poisonedSeat: 5 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('女巫（1号）使用解药救了 4号'));
      expect(lines).toContainEqual(expect.stringContaining('女巫（1号）使用毒药毒杀了 6号'));
    });

    it('shows nightmare block', () => {
      const players = new Map<number, LocalPlayer | null>([[1, makePlayer(1, 'nightmare')]]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { blockedSeat: 0 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('噩梦之影（2号）封锁了 1号'));
    });

    it('shows dreamcatcher protection', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'dreamcatcher')]]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { dreamingSeat: 2 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('摄梦人（1号）摄梦了 3号'));
    });

    it('shows magician swap', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'magician')]]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { swappedSeats: [1, 4] } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('魔术师（1号）交换了 2号 和 5号'));
    });

    it('shows seer reveal', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'seer')]]);
      const lines = buildActionLines(
        makeGameState({ players, seerReveal: { targetSeat: 2, result: '狼人' } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('预言家（1号）查验 3号：狼人'));
    });

    it('shows wolf robot learn', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'wolfRobot')]]);
      const lines = buildActionLines(
        makeGameState({
          players,
          wolfRobotReveal: { targetSeat: 5, result: '猎人', learnedRoleId: 'hunter' },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('机械狼人（1号）学习了 6号'));
      expect(lines).toContainEqual(expect.stringContaining('猎人'));
    });

    it('shows death list', () => {
      const lines = buildActionLines(makeGameState({ lastNightDeaths: [0, 3] }));
      expect(lines).toContainEqual(expect.stringContaining('死亡：1号、4号'));
    });

    it('shows death list with reason labels when deathReasons present', () => {
      const lines = buildActionLines(
        makeGameState({
          lastNightDeaths: [0, 3],
          deathReasons: { 0: 'wolfKill', 3: 'poison' },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('死亡：1号（狼杀）、4号（毒杀）'));
    });

    it('shows death list without labels when deathReasons is undefined', () => {
      const lines = buildActionLines(makeGameState({ lastNightDeaths: [0, 3] }));
      expect(lines).toContainEqual(expect.stringContaining('死亡：1号、4号'));
      expect(lines.join()).not.toContain('（');
    });

    it('shows all death reason types correctly', () => {
      const lines = buildActionLines(
        makeGameState({
          lastNightDeaths: [0, 1, 2],
          deathReasons: { 0: 'wolfKill', 1: 'coupleLink', 2: 'magicianSwap' },
        }),
      );
      expect(lines).toContainEqual(
        expect.stringContaining('1号（狼杀）、2号（殉情）、3号（魔术师交换）'),
      );
    });

    it('shows wolf kill disabled', () => {
      const lines = buildActionLines(
        makeGameState({
          currentNightResults: {
            wolfKillOverride: {
              source: 'nightmare',
              ui: { promptTitle: 't', promptMessage: 'm', emptyVoteText: 'e', rejectMessage: 'r' },
            },
          },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('狼人放弃袭击'));
    });

    it('shows bottom cards composition', () => {
      const lines = buildActionLines(
        makeGameState({
          bottomCards: ['seer', 'guard', 'villager'],
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('底牌组成'));
      expect(lines).toContainEqual(expect.stringContaining('预言家'));
      expect(lines).toContainEqual(expect.stringContaining('守卫'));
      expect(lines).toContainEqual(expect.stringContaining('平民'));
    });

    it('shows treasureMaster chosen card', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'treasureMaster')]]);
      const lines = buildActionLines(makeGameState({ players, treasureMasterChosenCard: 'seer' }));
      expect(lines).toContainEqual(expect.stringContaining('盗宝大师（1号）选择了 预言家'));
    });

    it('shows slacker idol choice', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'slacker')]]);
      const actions: Map<RoleId, ReturnType<typeof makeActionTarget>> = new Map([
        ['slacker', makeActionTarget(3)],
      ]);
      const lines = buildActionLines(makeGameState({ players, actions }));
      expect(lines).toContainEqual(expect.stringContaining('混血儿（1号）选择了 4号 为榜样'));
    });

    it('shows wildChild idol choice', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'wildChild')]]);
      const actions: Map<RoleId, ReturnType<typeof makeActionTarget>> = new Map([
        ['wildChild', makeActionTarget(1)],
      ]);
      const lines = buildActionLines(makeGameState({ players, actions }));
      expect(lines).toContainEqual(expect.stringContaining('野孩子（1号）选择了 2号 为榜样'));
    });

    it('shows wolfQueen charm', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'wolfQueen')]]);
      const actions: Map<RoleId, ReturnType<typeof makeActionTarget>> = new Map([
        ['wolfQueen', makeActionTarget(4)],
      ]);
      const lines = buildActionLines(makeGameState({ players, actions }));
      expect(lines).toContainEqual(expect.stringContaining('狼美人（1号）魅惑了 5号'));
    });

    it('shows successful Seed Wolf infection', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'seedWolf')]]);
      const lines = buildActionLines(
        makeGameState({
          players,
          seedWolfInfectionResult: { outcome: 'converted', targetSeat: 3 },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('种狼（1号）成功感染了 4号'));
    });

    it('shows failed Seed Wolf infection', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'seedWolf')]]);
      const lines = buildActionLines(
        makeGameState({
          players,
          seedWolfInfectionResult: { outcome: 'failed', targetSeat: 3 },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('种狼（1号）感染 4号失败'));
    });

    it('shows unused Seed Wolf infection', () => {
      const players = new Map<number, LocalPlayer | null>([[0, makePlayer(0, 'seedWolf')]]);
      const lines = buildActionLines(
        makeGameState({ players, seedWolfInfectionResult: { outcome: 'notUsed' } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('种狼（1号）未使用感染'));
    });

    it('shows hunter can shoot when not poisoned', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'wolf')],
      ]);
      const lines = buildActionLines(makeGameState({ players }));
      expect(lines).toContainEqual(expect.stringContaining('猎人（1号）可以发动技能'));
    });

    it('shows hunter cannot shoot when poisoned', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'wolf')],
        [2, makePlayer(2, 'witch')],
      ]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { poisonedSeat: 0 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('猎人（1号）不能发动技能'));
    });

    it('shows darkWolfKing can shoot when not poisoned', () => {
      const players = new Map<number, LocalPlayer | null>([[2, makePlayer(2, 'darkWolfKing')]]);
      const lines = buildActionLines(makeGameState({ players }));
      expect(lines).toContainEqual(expect.stringContaining('狼王（3号）可以发动技能'));
    });

    it('shows darkWolfKing cannot shoot when poisoned', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'witch')],
        [2, makePlayer(2, 'darkWolfKing')],
      ]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { poisonedSeat: 2 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('狼王（3号）不能发动技能'));
    });

    it('shows hunter cannot shoot when dream-linked death (dreamcatcher killed)', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'dreamcatcher')],
        [2, makePlayer(2, 'witch')],
      ]);
      const lines = buildActionLines(
        makeGameState({
          players,
          currentNightResults: { dreamingSeat: 0, poisonedSeat: 1 },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('猎人（1号）不能发动技能'));
    });

    it('shows hunter can shoot when dream target but dreamcatcher alive', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'dreamcatcher')],
      ]);
      const lines = buildActionLines(
        makeGameState({
          players,
          currentNightResults: { dreamingSeat: 0 },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('猎人（1号）可以发动技能'));
    });

    it('shows hunter cannot shoot when wolfQueen charm victim (wolfQueen killed)', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'wolfQueen')],
        [2, makePlayer(2, 'witch')],
      ]);
      const lines = buildActionLines(
        makeGameState({
          players,
          currentNightResults: { charmedSeat: 0, poisonedSeat: 1 },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('猎人（1号）不能发动技能'));
    });

    it('shows hunter cannot shoot when couple death (partner wolf-killed)', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'villager')],
        [2, makePlayer(2, 'cupid')],
      ]);
      const lines = buildActionLines(
        makeGameState({
          players,
          loverSeats: [0, 1],
          witchContext: { killedSeat: 1, canSave: true, canPoison: true },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('猎人（1号）不能发动技能'));
    });

    // ── P3: Wolf empty kill (empty knife) ──

    it('shows wolf empty kill when wolves present but no votes and no override', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'villager')],
      ]);
      const lines = buildActionLines(makeGameState({ players }));
      expect(lines).toContainEqual(expect.stringContaining('狼人空刀'));
    });

    it('does not show wolf empty kill when wolfKillOverride is present', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'villager')],
      ]);
      const lines = buildActionLines(
        makeGameState({
          players,
          currentNightResults: {
            wolfKillOverride: {
              source: 'nightmare',
              ui: { promptTitle: 't', promptMessage: 'm', emptyVoteText: 'e', rejectMessage: 'r' },
            },
          },
        }),
      );
      const joined = lines.join('\n');
      expect(joined).not.toContain('空刀');
      expect(joined).toContain('放弃袭击');
    });

    it('does not show wolf empty kill when no wolves in game', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'villager')],
        [1, makePlayer(1, 'seer')],
      ]);
      const lines = buildActionLines(makeGameState({ players }));
      const joined = lines.join('\n');
      expect(joined).not.toContain('空刀');
    });

    // ── P2: Nightmare block role name ──

    it('shows nightmare block with role name', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'guard')],
        [1, makePlayer(1, 'nightmare')],
      ]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { blockedSeat: 0 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('噩梦之影（2号）封锁了 1号'));
      expect(lines).toContainEqual(expect.stringContaining('守卫'));
      expect(lines).toContainEqual(expect.stringContaining('技能无效'));
    });

    // ── P1: Guard "did nothing" ──

    it('shows guard did nothing when guard present but not guarding', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'guard')],
        [1, makePlayer(1, 'villager')],
      ]);
      const lines = buildActionLines(makeGameState({ players }));
      expect(lines).toContainEqual(expect.stringContaining('守卫（1号）未守护'));
    });

    it('does not show guard did nothing when guard is blocked by nightmare', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'guard')],
        [1, makePlayer(1, 'nightmare')],
      ]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { blockedSeat: 0 } }),
      );
      const joined = lines.join('\n');
      expect(joined).not.toContain('守卫（1号）未守护');
    });

    // ── P1: Witch "did nothing" ──

    it('shows witch did nothing when witch present and used neither potion', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'villager')],
      ]);
      const lines = buildActionLines(makeGameState({ players }));
      expect(lines).toContainEqual(expect.stringContaining('女巫（1号）未使用药水'));
    });

    it('shows witch did not use save when witch saved nothing but poisoned', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'villager')],
      ]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { poisonedSeat: 1 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('女巫（1号）未使用解药'));
      const joined = lines.join('\n');
      expect(joined).not.toContain('未使用药水');
    });

    it('shows witch did not use poison when witch saved but did not poison', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'villager')],
      ]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { savedSeat: 1 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('女巫（1号）未使用毒药'));
      const joined = lines.join('\n');
      expect(joined).not.toContain('未使用解药');
    });

    it('does not show witch did nothing when witch is blocked by nightmare', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'nightmare')],
      ]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { blockedSeat: 0 } }),
      );
      const joined = lines.join('\n');
      expect(joined).not.toContain('女巫未使用');
    });

    it('shows poisoner did nothing when poisoner present but did not poison', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'poisoner')],
        [1, makePlayer(1, 'villager')],
      ]);
      const lines = buildActionLines(makeGameState({ players }));
      expect(lines).toContainEqual(expect.stringContaining('毒师（1号）未使用毒药'));
    });

    it('witch does not show poison unused when poisoner owns the poison', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'poisoner')],
      ]);
      const lines = buildActionLines(makeGameState({ players }));
      // Witch shows "未使用解药", NOT "未使用药水" (poisoner owns poison)
      expect(lines).toContainEqual(expect.stringContaining('女巫（1号）未使用解药'));
      expect(lines).toContainEqual(expect.stringContaining('毒师（2号）未使用毒药'));
      const joined = lines.join('\n');
      expect(joined).not.toContain('女巫（1号）未使用毒药');
      expect(joined).not.toContain('女巫（1号）未使用药水');
    });

    // ── P2: double-save warning ──

    it('shows 同守同救 warning when guard and witch both save wolf target', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'guard')],
        [2, makePlayer(2, 'witch')],
        [3, makePlayer(3, 'villager')],
      ]);
      const lines = buildActionLines(
        makeGameState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '0': 3 },
            guardedSeat: 3,
            savedSeat: 3,
          },
          lastNightDeaths: [3],
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('同守同救'));
      expect(lines).toContainEqual(expect.stringContaining('4号'));
    });

    // ── P3: Poison immunity warning ──

    it('shows poison immunity warning when poisoned target is immune', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'witcher')],
      ]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { poisonedSeat: 1 } }),
      );
      expect(lines).toContainEqual(expect.stringContaining('免疫毒药'));
      expect(lines).toContainEqual(expect.stringContaining('猎魔人'));
    });

    it('does not show poison immunity for non-immune target', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'villager')],
      ]);
      const lines = buildActionLines(
        makeGameState({ players, currentNightResults: { poisonedSeat: 1 } }),
      );
      const joined = lines.join('\n');
      expect(joined).not.toContain('免疫毒药');
    });

    // ── P3: Damage reflection warning ──

    it('shows reflection warning when seer checks a reflectsDamage target', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'seer')],
        [1, makePlayer(1, 'spiritKnight')],
      ]);
      const lines = buildActionLines(
        makeGameState({
          players,
          seerReveal: { targetSeat: 1, result: '狼人' },
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('反伤'));
      expect(lines).toContainEqual(expect.stringContaining('灵骑士'));
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
      expect(lines[1]).toBe('2号: 平民');
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
        [19, makePlayer(19, 'silenceElder')],
        [20, makePlayer(20, 'votebanElder')],
        [21, makePlayer(21, 'piper')],
        [22, makePlayer(22, 'awakenedGargoyle')],
        [23, makePlayer(23, 'shadow')],
        [24, makePlayer(24, 'avenger')],
        [25, makePlayer(25, 'crow')],
        [26, makePlayer(26, 'poisoner')],
        [27, makePlayer(27, 'treasureMaster')],
        [28, makePlayer(28, 'thief')],
        [29, makePlayer(29, 'cupid')],
        [30, makePlayer(30, 'eclipseWolfQueen')],
        [31, makePlayer(31, 'hiddenWolf')],
        [32, makePlayer(32, 'seedWolf')],
      ]);

      const actions = new Map<RoleId, ReturnType<typeof makeActionTarget>>([
        ['slacker', makeActionTarget(0)],
        ['wildChild', makeActionTarget(1)],
        ['wolfQueen', makeActionTarget(2)],
      ]);

      const gs = {
        currentNightResults: {
          wolfVotesBySeat: { '0': 8 },
          blockedSeat: 3,
          guardedSeat: 4,
          silencedSeat: 19,
          votebannedSeat: 20,
          savedSeat: 5,
          poisonedSeat: 99, // non-existent seat so hunter/darkWolfKing can shoot
          dreamingSeat: 6,
          swappedSeats: [7, 8],
          hypnotizedSeats: [2, 10],
          convertedSeat: 11,
          shadowMimicTarget: 3,
          cursedSeat: 12,
          shelteredSeat: 13,
          treasureMasterChosenCard: 'seer',
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
        loverSeats: [28, 29],
      } as unknown as LocalGameState;

      const thiefState = {
        ...gs,
        currentNightResults: {
          ...gs.currentNightResults,
          treasureMasterChosenCard: undefined,
          thiefChosenCard: 'villager',
        },
      } as unknown as LocalGameState;
      const lines = [...buildActionLines(gs), ...buildActionLines(thiefState)];
      const joined = lines.join('\n');

      // Every NIGHT_STEPS role must appear in output by its canonical displayName
      for (const step of NIGHT_STEPS) {
        const displayName = getRoleDisplayName(step.roleId);
        expect(joined).toContain(displayName);
      }
    });
  });

  describe('contract: skipped actions — every canSkip role still produces a line', () => {
    /**
     * Derive all roles that have canSkip: true from ROLE_SPECS.
     * When a role skips its action, its displayName must still appear in the review.
     */
    it('buildActionLines covers all canSkip roles when they skip', () => {
      // Collect all roles with canSkip: true
      const canSkipRoleIds: RoleId[] = [];
      for (const [roleId, spec] of Object.entries(ROLE_SPECS)) {
        const abilities = (spec as RoleSpec).abilities;
        if (abilities?.some((a) => a.type === 'active' && a.canSkip)) {
          canSkipRoleIds.push(roleId as RoleId);
        }
      }
      // Sanity: we expect a meaningful number of canSkip roles
      expect(canSkipRoleIds.length).toBeGreaterThanOrEqual(15);

      // Build players map with all canSkip roles, each on a separate seat
      const players = new Map<number, LocalPlayer | null>();
      canSkipRoleIds.forEach((roleId, idx) => {
        players.set(idx, makePlayer(idx, roleId));
      });

      // Empty night results + empty actions = all roles skipped
      const gs = makeGameState({
        players,
        currentNightResults: {},
      });

      const lines = buildActionLines(gs);
      const joined = lines.join('\n');

      for (const roleId of canSkipRoleIds) {
        const displayName = getRoleDisplayName(roleId);
        expect(joined).toContain(displayName);
      }
    });
  });

  describe('buildNightReviewData', () => {
    it('returns both sections', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'seer')],
      ]);
      const data = buildNightReviewData(
        makeGameState({
          players,
          seerReveal: { targetSeat: 0, result: '狼人' },
          lastNightDeaths: [0],
        }),
      );
      expect(data.actions.length).toBeGreaterThan(0);
      expect(data.identities.length).toBe(2);
      // Seat 0 died last night (lastNightDeaths: [0]); seat 1 is alive.
      expect(data.identities[0]).toEqual({
        seat: 0,
        roleId: 'wolf',
        isEmptySeat: false,
        isAlive: false,
      });
      expect(data.identities[1]).toEqual({
        seat: 1,
        roleId: 'seer',
        isEmptySeat: false,
        isAlive: true,
      });
    });
  });

  describe('structured entries', () => {
    it('emits exactly one peacefulNight entry for an empty night', () => {
      expect(buildActionEntries(makeGameState())).toEqual([{ kind: 'peacefulNight' }]);
    });

    it('carries wolf votes as structured voter/target pairs', () => {
      const entries = buildActionEntries(
        makeGameState({ currentNightResults: { wolfVotesBySeat: { '2': 4, '3': 4 } } }),
      );
      expect(entries[0]).toEqual({
        kind: 'wolfAttack',
        votes: [
          { voterSeat: 2, targetSeat: 4 },
          { voterSeat: 3, targetSeat: 4 },
        ],
        abstainSeats: [],
      });
    });

    it('splits abstain votes (engine sentinel -1) out of the wolfAttack votes', () => {
      const entries = buildActionEntries(
        makeGameState({
          currentNightResults: { wolfVotesBySeat: { '6': 5, '7': 5, '11': -1, '8': 4 } },
        }),
      );
      expect(entries[0]).toEqual({
        kind: 'wolfAttack',
        votes: [
          { voterSeat: 6, targetSeat: 5 },
          { voterSeat: 7, targetSeat: 5 },
          { voterSeat: 8, targetSeat: 4 },
        ],
        abstainSeats: [11],
      });
    });

    it('keeps an all-abstain night as a wolfAttack entry with empty votes', () => {
      const entries = buildActionEntries(
        makeGameState({ currentNightResults: { wolfVotesBySeat: { '0': -1, '1': -1 } } }),
      );
      expect(entries[0]).toEqual({ kind: 'wolfAttack', votes: [], abstainSeats: [0, 1] });
    });

    it('fails fast on an invalid negative wolf vote target', () => {
      expect(() =>
        buildActionEntries(
          makeGameState({ currentNightResults: { wolfVotesBySeat: { '0': -3 } } }),
        ),
      ).toThrow(/Invalid wolf vote target/);
    });

    it('formats abstentions as 空刀 in the text channel, never as seat 0', () => {
      const lines = buildActionLines(
        makeGameState({
          currentNightResults: { wolfVotesBySeat: { '6': 5, '11': -1 } },
        }),
      );
      expect(lines[0]).toContain('狼人袭击：7号→6号，12号空刀');
      expect(lines[0]).not.toContain('0号');
    });

    it('does not let an abstention manufacture a tie for the guard-save conflict', () => {
      // One real vote on seat 4 (index 3) plus one abstention: the engine
      // tally ignores the abstention, so the wolf target still resolves and
      // the 同守同救 annotation (guard + save on that target) stays reachable.
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'wolf')],
        [2, makePlayer(2, 'guard')],
        [3, makePlayer(3, 'villager')],
        [4, makePlayer(4, 'witch')],
      ]);
      const lines = buildActionLines(
        makeGameState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '0': 3, '1': -1 },
            guardedSeat: 3,
            savedSeat: 3,
          },
          lastNightDeaths: [3],
        }),
      );
      expect(lines).toContainEqual(expect.stringContaining('同守同救'));
    });

    it('carries deaths with their reasons in order', () => {
      const entries = buildActionEntries(
        makeGameState({
          lastNightDeaths: [0, 3],
          deathReasons: { 0: 'wolfKill', 3: 'poison' },
        }),
      );
      expect(entries[entries.length - 1]).toEqual({
        kind: 'deaths',
        deaths: [
          { seat: 0, reason: 'wolfKill' },
          { seat: 3, reason: 'poison' },
        ],
      });
    });

    it('keeps the fact order of a composed night as an entry kind sequence', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'guard')],
        [2, makePlayer(2, 'witch')],
        [3, makePlayer(3, 'seer')],
        [4, makePlayer(4, 'villager')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '0': 4 },
            guardedSeat: 4,
            savedSeat: 4,
          },
          seerReveal: { targetSeat: 0, result: '狼人' },
          lastNightDeaths: [4],
          deathReasons: { 4: 'wolfKill' },
        }),
      );
      const kinds: NightReviewActionEntry['kind'][] = entries.map((entry) => entry.kind);
      expect(kinds).toEqual([
        'wolfAttack',
        'guard',
        'save',
        'witchNoPoison',
        'check',
        'guardSaveConflict',
        'deaths',
      ]);
    });

    it('formats every entry of a composed night to a non-empty legacy line', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'guard')],
        [1, makePlayer(1, 'witch')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          currentNightResults: { guardedSeat: 1, savedSeat: 3, poisonedSeat: 5 },
          lastNightDeaths: [5],
        }),
      );
      const lines = entries.map(formatNightReviewActionLine);
      expect(lines.length).toBe(entries.length);
      for (const line of lines) expect(line.length).toBeGreaterThan(0);
    });

    it('builds identity entries for empty and unassigned seats', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, null],
        [1, makePlayer(1, null)],
        [2, makePlayer(2, 'wolf')],
      ]);
      const entries = buildIdentityEntries(players, new Set([2]));
      expect(entries).toEqual([
        { seat: 0, roleId: null, isEmptySeat: true, isAlive: true },
        { seat: 1, roleId: null, isEmptySeat: false, isAlive: true },
        { seat: 2, roleId: 'wolf', isEmptySeat: false, isAlive: false },
      ]);
    });
  });

  describe('getNightReviewOutcome', () => {
    it('derives the deaths outcome with seats and reasons from built data', () => {
      const data = buildNightReviewData(
        makeGameState({
          lastNightDeaths: [5, 2],
          deathReasons: { 5: 'poison', 2: 'wolfKill' },
        }),
      );
      expect(getNightReviewOutcome(data)).toEqual({
        type: 'deaths',
        deaths: [
          { seat: 5, reason: 'poison' },
          { seat: 2, reason: 'wolfKill' },
        ],
      });
    });

    it('derives the peaceful outcome when nobody died', () => {
      const data = buildNightReviewData(makeGameState({}));
      expect(getNightReviewOutcome(data)).toEqual({ type: 'peaceful' });
    });

    it('fails fast when the data carries no outcome entry', () => {
      const data: NightReviewData = { actions: [{ kind: 'wolfNoTarget' }], identities: [] };
      expect(() => getNightReviewOutcome(data)).toThrow(/no outcome entry/);
    });

    it('fails fast when the data carries more than one outcome entry', () => {
      const data: NightReviewData = {
        actions: [{ kind: 'peacefulNight' }, { kind: 'deaths', deaths: [] }],
        identities: [],
      };
      expect(() => getNightReviewOutcome(data)).toThrow(/more than one outcome entry/);
    });
  });

  // ── 2026 report fact layer: actorSeat on every action entry ────────────
  describe('actorSeat', () => {
    const roster = (
      ...pairs: readonly (readonly [number, string])[]
    ): Map<number, LocalPlayer | null> =>
      new Map(pairs.map(([seat, role]) => [seat, makePlayer(seat, role)]));

    const cases: readonly {
      readonly name: string;
      readonly state: LocalGameState;
      readonly kind: NightReviewActionEntry['kind'];
      readonly actorSeat: number;
      readonly actorRoleId: string;
    }[] = [
      {
        name: 'nightmareBlock',
        state: makeGameState({
          players: roster([0, 'villager'], [3, 'nightmare']),
          currentNightResults: { blockedSeat: 0 },
        }),
        kind: 'nightmareBlock',
        actorSeat: 3,
        actorRoleId: 'nightmare',
      },
      {
        name: 'nightmareIdle',
        state: makeGameState({ players: roster([3, 'nightmare']) }),
        kind: 'nightmareIdle',
        actorSeat: 3,
        actorRoleId: 'nightmare',
      },
      {
        name: 'shelter',
        state: makeGameState({
          players: roster([2, 'eclipseWolfQueen']),
          currentNightResults: { shelteredSeat: 5 },
        }),
        kind: 'shelter',
        actorSeat: 2,
        actorRoleId: 'eclipseWolfQueen',
      },
      {
        name: 'shelterIdle',
        state: makeGameState({ players: roster([2, 'eclipseWolfQueen']) }),
        kind: 'shelterIdle',
        actorSeat: 2,
        actorRoleId: 'eclipseWolfQueen',
      },
      {
        name: 'hiddenWolfConfirmed',
        state: makeGameState({ players: roster([4, 'hiddenWolf']) }),
        kind: 'hiddenWolfConfirmed',
        actorSeat: 4,
        actorRoleId: 'hiddenWolf',
      },
      {
        name: 'guard',
        state: makeGameState({
          players: roster([1, 'guard']),
          currentNightResults: { guardedSeat: 6 },
        }),
        kind: 'guard',
        actorSeat: 1,
        actorRoleId: 'guard',
      },
      {
        name: 'guardIdle',
        state: makeGameState({ players: roster([1, 'guard']) }),
        kind: 'guardIdle',
        actorSeat: 1,
        actorRoleId: 'guard',
      },
      {
        name: 'silence',
        state: makeGameState({
          players: roster([2, 'silenceElder']),
          currentNightResults: { silencedSeat: 6 },
        }),
        kind: 'silence',
        actorSeat: 2,
        actorRoleId: 'silenceElder',
      },
      {
        name: 'silenceIdle',
        state: makeGameState({ players: roster([2, 'silenceElder']) }),
        kind: 'silenceIdle',
        actorSeat: 2,
        actorRoleId: 'silenceElder',
      },
      {
        name: 'voteban',
        state: makeGameState({
          players: roster([2, 'votebanElder']),
          currentNightResults: { votebannedSeat: 6 },
        }),
        kind: 'voteban',
        actorSeat: 2,
        actorRoleId: 'votebanElder',
      },
      {
        name: 'votebanIdle',
        state: makeGameState({ players: roster([2, 'votebanElder']) }),
        kind: 'votebanIdle',
        actorSeat: 2,
        actorRoleId: 'votebanElder',
      },
      {
        name: 'save',
        state: makeGameState({
          players: roster([9, 'witch']),
          currentNightResults: { savedSeat: 3 },
        }),
        kind: 'save',
        actorSeat: 9,
        actorRoleId: 'witch',
      },
      {
        name: 'poison by witch',
        state: makeGameState({
          players: roster([9, 'witch']),
          currentNightResults: { poisonedSeat: 11 },
        }),
        kind: 'poison',
        actorSeat: 9,
        actorRoleId: 'witch',
      },
      {
        name: 'poison by poisoner',
        state: makeGameState({
          players: roster([9, 'witch'], [6, 'poisoner']),
          currentNightResults: { poisonedSeat: 11 },
        }),
        kind: 'poison',
        actorSeat: 6,
        actorRoleId: 'poisoner',
      },
      {
        name: 'witchIdleAll',
        state: makeGameState({ players: roster([9, 'witch']) }),
        kind: 'witchIdleAll',
        actorSeat: 9,
        actorRoleId: 'witch',
      },
      {
        name: 'witchNoSave',
        state: makeGameState({
          players: roster([9, 'witch'], [6, 'poisoner']),
          currentNightResults: { poisonedSeat: 11 },
        }),
        kind: 'witchNoSave',
        actorSeat: 9,
        actorRoleId: 'witch',
      },
      {
        name: 'witchNoPoison',
        state: makeGameState({
          players: roster([9, 'witch']),
          currentNightResults: { savedSeat: 3 },
        }),
        kind: 'witchNoPoison',
        actorSeat: 9,
        actorRoleId: 'witch',
      },
      {
        name: 'poisonerNoPoison',
        state: makeGameState({ players: roster([6, 'poisoner']) }),
        kind: 'poisonerNoPoison',
        actorSeat: 6,
        actorRoleId: 'poisoner',
      },
      {
        name: 'curse',
        state: makeGameState({
          players: roster([7, 'crow']),
          currentNightResults: { cursedSeat: 2 },
        }),
        kind: 'curse',
        actorSeat: 7,
        actorRoleId: 'crow',
      },
      {
        name: 'curseIdle',
        state: makeGameState({ players: roster([7, 'crow']) }),
        kind: 'curseIdle',
        actorSeat: 7,
        actorRoleId: 'crow',
      },
      {
        name: 'dream',
        state: makeGameState({
          players: roster([4, 'dreamcatcher']),
          currentNightResults: { dreamingSeat: 2 },
        }),
        kind: 'dream',
        actorSeat: 4,
        actorRoleId: 'dreamcatcher',
      },
      {
        name: 'dreamIdle',
        state: makeGameState({ players: roster([4, 'dreamcatcher']) }),
        kind: 'dreamIdle',
        actorSeat: 4,
        actorRoleId: 'dreamcatcher',
      },
      {
        name: 'swap',
        state: makeGameState({
          players: roster([5, 'magician']),
          currentNightResults: { swappedSeats: [1, 2] },
        }),
        kind: 'swap',
        actorSeat: 5,
        actorRoleId: 'magician',
      },
      {
        name: 'swapIdle',
        state: makeGameState({ players: roster([5, 'magician']) }),
        kind: 'swapIdle',
        actorSeat: 5,
        actorRoleId: 'magician',
      },
      {
        name: 'cupidLink',
        state: makeGameState({ players: roster([8, 'cupid']), loverSeats: [1, 2] }),
        kind: 'cupidLink',
        actorSeat: 8,
        actorRoleId: 'cupid',
      },
      {
        name: 'cardChoice treasureMaster',
        state: makeGameState({
          players: roster([0, 'treasureMaster']),
          treasureMasterChosenCard: 'seer',
        }),
        kind: 'cardChoice',
        actorSeat: 0,
        actorRoleId: 'treasureMaster',
      },
      {
        name: 'cardChoice thief',
        state: makeGameState({ players: roster([0, 'thief']), thiefChosenCard: 'guard' }),
        kind: 'cardChoice',
        actorSeat: 0,
        actorRoleId: 'thief',
      },
      {
        name: 'idolChoice slacker',
        state: makeGameState({
          players: roster([3, 'slacker']),
          actions: new Map([['slacker', makeActionTarget(5)]]),
        }),
        kind: 'idolChoice',
        actorSeat: 3,
        actorRoleId: 'slacker',
      },
      {
        name: 'idolChoice wildChild',
        state: makeGameState({
          players: roster([3, 'wildChild']),
          actions: new Map([['wildChild', makeActionTarget(5)]]),
        }),
        kind: 'idolChoice',
        actorSeat: 3,
        actorRoleId: 'wildChild',
      },
      {
        name: 'mimic',
        state: makeGameState({
          players: roster([6, 'shadow']),
          currentNightResults: { shadowMimicTarget: 2 },
        }),
        kind: 'mimic',
        actorSeat: 6,
        actorRoleId: 'shadow',
      },
      {
        name: 'avengerConfirmed',
        state: makeGameState({ players: roster([6, 'avenger']) }),
        kind: 'avengerConfirmed',
        actorSeat: 6,
        actorRoleId: 'avenger',
      },
      {
        name: 'charm',
        state: makeGameState({
          players: roster([6, 'wolfQueen']),
          actions: new Map([['wolfQueen', makeActionTarget(2)]]),
        }),
        kind: 'charm',
        actorSeat: 6,
        actorRoleId: 'wolfQueen',
      },
      {
        name: 'charmIdle',
        state: makeGameState({ players: roster([6, 'wolfQueen']) }),
        kind: 'charmIdle',
        actorSeat: 6,
        actorRoleId: 'wolfQueen',
      },
      {
        name: 'convert',
        state: makeGameState({
          players: roster([6, 'awakenedGargoyle']),
          currentNightResults: { convertedSeat: 2 },
        }),
        kind: 'convert',
        actorSeat: 6,
        actorRoleId: 'awakenedGargoyle',
      },
      {
        name: 'hypnotize',
        state: makeGameState({
          players: roster([6, 'piper']),
          currentNightResults: { hypnotizedSeats: [1, 2] },
        }),
        kind: 'hypnotize',
        actorSeat: 6,
        actorRoleId: 'piper',
      },
      {
        name: 'hypnotizeIdle',
        state: makeGameState({ players: roster([6, 'piper']) }),
        kind: 'hypnotizeIdle',
        actorSeat: 6,
        actorRoleId: 'piper',
      },
      {
        name: 'check',
        state: makeGameState({
          players: roster([3, 'seer']),
          seerReveal: { targetSeat: 0, result: '狼人' },
        }),
        kind: 'check',
        actorSeat: 3,
        actorRoleId: 'seer',
      },
      {
        name: 'checkIdle',
        state: makeGameState({ players: roster([3, 'seer']) }),
        kind: 'checkIdle',
        actorSeat: 3,
        actorRoleId: 'seer',
      },
      {
        name: 'learn',
        state: makeGameState({
          players: roster([6, 'wolfRobot']),
          wolfRobotReveal: { targetSeat: 1, result: '猎人', learnedRoleId: 'hunter' },
        }),
        kind: 'learn',
        actorSeat: 6,
        actorRoleId: 'wolfRobot',
      },
      {
        name: 'learnIdle',
        state: makeGameState({ players: roster([6, 'wolfRobot']) }),
        kind: 'learnIdle',
        actorSeat: 6,
        actorRoleId: 'wolfRobot',
      },
      {
        name: 'shootStatus hunter',
        state: makeGameState({ players: roster([2, 'hunter']) }),
        kind: 'shootStatus',
        actorSeat: 2,
        actorRoleId: 'hunter',
      },
      {
        name: 'shootStatus darkWolfKing',
        state: makeGameState({ players: roster([2, 'darkWolfKing']) }),
        kind: 'shootStatus',
        actorSeat: 2,
        actorRoleId: 'darkWolfKing',
      },
      {
        name: 'infectConverted',
        state: makeGameState({
          players: roster([1, 'seedWolf']),
          seedWolfInfectionResult: { outcome: 'converted', targetSeat: 4 },
        }),
        kind: 'infectConverted',
        actorSeat: 1,
        actorRoleId: 'seedWolf',
      },
      {
        name: 'infectFailed',
        state: makeGameState({
          players: roster([1, 'seedWolf']),
          seedWolfInfectionResult: { outcome: 'failed', targetSeat: 4 },
        }),
        kind: 'infectFailed',
        actorSeat: 1,
        actorRoleId: 'seedWolf',
      },
      {
        name: 'infectIdle',
        state: makeGameState({ players: roster([1, 'seedWolf']) }),
        kind: 'infectIdle',
        actorSeat: 1,
        actorRoleId: 'seedWolf',
      },
    ];

    for (const testCase of cases) {
      it(`resolves the actor for ${testCase.name}`, () => {
        const entry = buildActionEntries(testCase.state).find(
          (candidate) => candidate.kind === testCase.kind,
        );
        if (entry === undefined) {
          throw new Error(`expected a ${testCase.kind} entry to be built`);
        }
        if (!('actorSeat' in entry)) {
          throw new Error(`expected ${testCase.kind} to carry an actorSeat`);
        }
        expect(entry.actorSeat).toBe(testCase.actorSeat);
        expect(nightReviewActorRoleId(entry)).toBe(testCase.actorRoleId);
      });
    }

    it('fails fast when a poison fact has no witch or poisoner to own it', () => {
      expect(() =>
        buildActionEntries(makeGameState({ currentNightResults: { poisonedSeat: 3 } })),
      ).toThrow(/cannot resolve an actor seat for role witch/);
    });

    it('fails fast when a guard fact has no guard to own it', () => {
      expect(() =>
        buildActionEntries(makeGameState({ currentNightResults: { guardedSeat: 1 } })),
      ).toThrow(/cannot resolve an actor seat for role guard/);
    });

    it('fails fast when a card choice has no treasure master to own it', () => {
      expect(() => buildActionEntries(makeGameState({ treasureMasterChosenCard: 'seer' }))).toThrow(
        /cannot resolve an actor seat for role treasureMaster/,
      );
    });

    it('team, setup and outcome entries carry no single actor', () => {
      expect(nightReviewActorRoleId({ kind: 'wolfNoTarget' })).toBeNull();
      expect(nightReviewActorRoleId({ kind: 'peacefulNight' })).toBeNull();
      expect(nightReviewActorRoleId({ kind: 'bottomCards', roleIds: ['seer'] })).toBeNull();
    });
  });

  // ── 2026 report fact layer: sheriff section state matrix ───────────────
  describe('sheriff section', () => {
    const FIRST_ROUND: SheriffElectionRoundResult = {
      round: 'first',
      candidateSeats: [2, 5],
      eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
      ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2, 6: 5 },
      voteCounts: { 2: 4, 5: 2 },
      abstainingSeats: [4],
    };
    const FIRST_ROUND_DERIVED = {
      round: 'first',
      perCandidate: [
        { seat: 2, votes: 4, voterSeats: [0, 1, 3, 5] },
        { seat: 5, votes: 2, voterSeats: [2, 6] },
      ],
      abstainingSeats: [4],
    };
    const RUNOFF_TIE_ROUND: SheriffElectionRoundResult = {
      round: 'runoff',
      candidateSeats: [2, 5],
      eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
      ballots: { 0: 2, 1: 5, 2: 2, 3: 5, 4: 2, 5: 5, 6: null },
      voteCounts: { 2: 3, 5: 3 },
      abstainingSeats: [6],
    };

    it('is absent when the game held no election', () => {
      expect(buildNightReviewData(makeGameState()).sheriff).toBeUndefined();
      expect(deriveSheriffSection(makeGameState())).toBeUndefined();
    });

    it('registration exposes status only — no seats, no counts (secrecy)', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'registration',
            registeredSeats: [1, 2],
            withdrawnSeats: [],
            completedRounds: [],
          },
        }),
      );
      expect(section).toEqual({ kind: 'registration' });
    });

    it('candidate speech exposes active candidates and withdrawals, no tallies', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'candidateSpeech',
            registeredSeats: [2, 5, 7],
            withdrawnSeats: [7],
            completedRounds: [],
            speakingStartSeat: 2,
            speakingDirection: 'clockwise',
          },
        }),
      );
      expect(section).toEqual({
        kind: 'inProgress',
        phase: 'candidateSpeech',
        registeredSeats: [2, 5, 7],
        candidateSeats: [2, 5],
        withdrawnSeats: [7],
        closedRounds: [],
        activeRound: null,
        voteProgress: null,
      });
    });

    it('first vote in progress lists candidates and submission counts only — ballot targets are never exposed', () => {
      const section = deriveSheriffSection(
        makeGameState({
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
      expect(section).toEqual({
        kind: 'inProgress',
        phase: 'firstVote',
        registeredSeats: [2, 5],
        candidateSeats: [2, 5],
        withdrawnSeats: [],
        closedRounds: [],
        activeRound: { round: 'first', candidateSeats: [2, 5] },
        voteProgress: { submittedCount: 2, eligibleCount: 7 },
      });
      expect(JSON.stringify(section)).not.toContain('ballot');
      expect(JSON.stringify(section)).not.toContain('votes');
    });

    it('runoff speech shows the closed first round and the runoff candidates', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'runoffSpeech',
            registeredSeats: [2, 5, 9],
            withdrawnSeats: [9, 5],
            completedRounds: [FIRST_ROUND],
            candidateSeats: [2, 5],
            speakingStartSeat: 2,
            speakingDirection: 'clockwise',
          },
        }),
      );
      expect(section).toEqual({
        kind: 'inProgress',
        phase: 'runoffSpeech',
        registeredSeats: [2, 5, 9],
        candidateSeats: [2],
        withdrawnSeats: [9, 5],
        closedRounds: [FIRST_ROUND_DERIVED],
        activeRound: null,
        voteProgress: null,
      });
    });

    it('runoff vote in progress keeps the closed round and hides the active ballots', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'runoffVote',
            registeredSeats: [2, 5],
            withdrawnSeats: [],
            completedRounds: [FIRST_ROUND],
            candidateSeats: [2, 5],
            eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
            ballots: { 0: 2 },
          },
        }),
      );
      expect(section).toEqual({
        kind: 'inProgress',
        phase: 'runoffVote',
        registeredSeats: [2, 5],
        candidateSeats: [2, 5],
        withdrawnSeats: [],
        closedRounds: [FIRST_ROUND_DERIVED],
        activeRound: { round: 'runoff', candidateSeats: [2, 5] },
        voteProgress: { submittedCount: 1, eligibleCount: 7 },
      });
    });

    it('completed election derives every tally from the ballots', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [2, 5],
            withdrawnSeats: [],
            completedRounds: [FIRST_ROUND],
          },
          sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
        }),
      );
      expect(section).toEqual({
        kind: 'completed',
        registeredSeats: [2, 5],
        withdrawnSeats: [],
        activeCandidateSeats: [2, 5],
        rounds: [FIRST_ROUND_DERIVED],
        result: { kind: 'elected', sheriffSeat: 2 },
      });
    });

    it('completed no-sheriff keeps the closed rounds and the reason', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [2, 5],
            withdrawnSeats: [],
            completedRounds: [FIRST_ROUND, RUNOFF_TIE_ROUND],
          },
          sheriffElectionResult: { kind: 'noSheriff', reason: 'runoffTie' },
        }),
      );
      expect(section).toMatchObject({
        kind: 'completed',
        result: { kind: 'noSheriff', reason: 'runoffTie' },
      });
      if (section?.kind !== 'completed') throw new Error('expected a completed section');
      expect(section.rounds).toHaveLength(2);
      expect(section.rounds[1]).toEqual({
        round: 'runoff',
        perCandidate: [
          { seat: 2, votes: 3, voterSeats: [0, 2, 4] },
          { seat: 5, votes: 3, voterSeats: [1, 3, 5] },
        ],
        abstainingSeats: [6],
      });
    });

    it('completed with no candidates carries no rounds', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [],
            withdrawnSeats: [],
            completedRounds: [],
          },
          sheriffElectionResult: { kind: 'noSheriff', reason: 'noCandidates' },
        }),
      );
      expect(section).toEqual({
        kind: 'completed',
        registeredSeats: [],
        withdrawnSeats: [],
        activeCandidateSeats: [],
        rounds: [],
        result: { kind: 'noSheriff', reason: 'noCandidates' },
      });
    });

    it('fails fast when stored vote counts disagree with the ballots', () => {
      expect(() =>
        deriveSheriffSection(
          makeGameState({
            sheriffElection: {
              phase: 'completed',
              registeredSeats: [2, 5],
              withdrawnSeats: [],
              completedRounds: [{ ...FIRST_ROUND, voteCounts: { 2: 3, 5: 2 } }],
            },
            sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
          }),
        ),
      ).toThrow(/disagrees with its ballots/);
    });

    it('fails fast when stored abstentions disagree with the ballots', () => {
      expect(() =>
        deriveSheriffSection(
          makeGameState({
            sheriffElection: {
              phase: 'completed',
              registeredSeats: [2, 5],
              withdrawnSeats: [],
              completedRounds: [{ ...FIRST_ROUND, abstainingSeats: [] }],
            },
            sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
          }),
        ),
      ).toThrow(/abstaining seats disagree/);
    });

    it('fails fast on a result without an election state', () => {
      expect(() =>
        deriveSheriffSection(
          makeGameState({ sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 } }),
        ),
      ).toThrow(/without an election state/);
    });

    it('fails fast on a completed election without a result', () => {
      expect(() =>
        deriveSheriffSection(
          makeGameState({
            sheriffElection: {
              phase: 'completed',
              registeredSeats: [],
              withdrawnSeats: [],
              completedRounds: [],
            },
          }),
        ),
      ).toThrow(/without a result/);
    });
  });

  // ── 2026 report fact layer: stats, wolf verdict, death annotations ────
  describe('report derivations', () => {
    it('derives all four wolf verdict states', () => {
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 5 },
          ],
          abstainSeats: [],
        }),
      ).toEqual({ type: 'sharedTarget', targetSeat: 5 });
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 5 },
            { voterSeat: 2, targetSeat: 6 },
          ],
          abstainSeats: [],
        }),
      ).toEqual({ type: 'splitKilled', targetSeat: 5 });
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 6 },
          ],
          abstainSeats: [],
        }),
      ).toEqual({ type: 'splitTied' });
      expect(deriveWolfVerdict({ kind: 'wolfAttack', votes: [], abstainSeats: [0, 1] })).toEqual({
        type: 'allAbstain',
      });
    });

    it('derives stats from the entries and cross-checks them against the deaths', () => {
      const players = new Map<number, LocalPlayer | null>([
        [3, makePlayer(3, 'seer')],
        [9, makePlayer(9, 'witch')],
      ]);
      const data = buildNightReviewData(
        makeGameState({
          players,
          currentNightResults: { savedSeat: 4, poisonedSeat: 11 },
          seerReveal: { targetSeat: 4, result: '好人' },
          lastNightDeaths: [11],
          deathReasons: { 11: 'poison' },
        }),
      );
      expect(deriveNightReportStats(data)).toEqual({
        wolfKills: 0,
        poisonKills: 1,
        saves: 1,
        checks: 1,
      });
    });

    it('does not count a save whose target died anyway', () => {
      const players = new Map<number, LocalPlayer | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'guard')],
        [2, makePlayer(2, 'witch')],
        [3, makePlayer(3, 'seer')],
        [4, makePlayer(4, 'villager')],
      ]);
      const data = buildNightReviewData(
        makeGameState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '0': 4 },
            guardedSeat: 4,
            savedSeat: 4,
          },
          seerReveal: { targetSeat: 0, result: '狼人' },
          lastNightDeaths: [4],
          deathReasons: { 4: 'wolfKill' },
        }),
      );
      expect(deriveNightReportStats(data)).toEqual({
        wolfKills: 1,
        poisonKills: 0,
        saves: 0,
        checks: 1,
      });
    });

    it('fails fast when the outcome lists a seat twice', () => {
      const data: NightReviewData = {
        actions: [
          {
            kind: 'deaths',
            deaths: [
              { seat: 1, reason: 'wolfKill' },
              { seat: 1, reason: 'poison' },
            ],
          },
        ],
        identities: [],
      };
      expect(() => deriveNightReportStats(data)).toThrow(/more than once/);
    });

    it('annotates deaths with the locking wolf votes and the poison owner', () => {
      const players = new Map<number, LocalPlayer | null>([
        [6, makePlayer(6, 'wolf')],
        [7, makePlayer(7, 'wolf')],
        [8, makePlayer(8, 'wolf')],
        [9, makePlayer(9, 'witch')],
        [11, makePlayer(11, 'wolf')],
      ]);
      const data = buildNightReviewData(
        makeGameState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '6': 5, '7': 5, '8': 4, '11': -1 },
            poisonedSeat: 11,
          },
          lastNightDeaths: [5, 11],
          deathReasons: { 5: 'wolfKill', 11: 'poison' },
        }),
      );
      const notes = deriveDeathNotes(data);
      expect(notes.get(5)).toEqual({ kind: 'wolfVotes', votes: 2 });
      expect(notes.get(11)).toEqual({ kind: 'poisonedBy', actorRoleId: 'witch' });
      expect(deriveWolfTargetSaveNote(data)).toEqual({ wolfTargetSeat: 5 });
    });

    it('drops the save note once the witch saved the wolf target', () => {
      const players = new Map<number, LocalPlayer | null>([
        [6, makePlayer(6, 'wolf')],
        [9, makePlayer(9, 'witch')],
      ]);
      const data = buildNightReviewData(
        makeGameState({
          players,
          currentNightResults: { wolfVotesBySeat: { '6': 5 }, savedSeat: 5 },
        }),
      );
      expect(deriveWolfTargetSaveNote(data)).toBeNull();
    });
  });
});
