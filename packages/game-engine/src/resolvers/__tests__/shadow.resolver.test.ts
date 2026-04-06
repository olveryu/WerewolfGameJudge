/**
 * Shadow Resolver Unit Tests
 *
 * Tests for shadowChooseMimicResolver validation and resolution logic.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { Team } from '@werewolf/game-engine/models/roles/spec/types';
import { shadowChooseMimicResolver } from '@werewolf/game-engine/resolvers/shadow';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'wolf'],
    [2, 'seer'],
    [3, 'avenger'],
    [4, 'shadow'],
  ]);

  return {
    actorSeat: 4,
    actorRoleId: 'shadow',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | undefined): ActionInput {
  return {
    schemaId: 'shadowChooseMimic',
    target,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('shadowChooseMimicResolver', () => {
  describe('validation', () => {
    it('应该拒绝缺少目标', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('必须选择');
    });

    it('应该拒绝不存在的目标玩家', () => {
      const ctx = createContext();
      const input = createInput(99);

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });
  });

  describe('choose mimic target', () => {
    it('应该接受选择村民为模仿目标', () => {
      const ctx = createContext();
      const input = createInput(0); // villager

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.idolTarget).toBe(0);
      expect(result.updates?.shadowMimicTarget).toBe(0);
    });

    it('应该接受选择狼人为模仿目标', () => {
      const ctx = createContext();
      const input = createInput(1); // wolf

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.idolTarget).toBe(1);
      expect(result.updates?.shadowMimicTarget).toBe(1);
    });

    it('应该接受选择神职为模仿目标', () => {
      const ctx = createContext();
      const input = createInput(2); // seer

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.idolTarget).toBe(2);
      expect(result.updates?.shadowMimicTarget).toBe(2);
    });

    it('选非复仇者目标时 avengerFaction 应为目标队伍反转', () => {
      const ctx = createContext();
      const input = createInput(0); // villager (Team.Good)

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(true);
      // Villager is Good → shadow joins Good → avenger is Wolf
      expect(result.updates?.avengerFaction).toBe(Team.Wolf);
    });

    it('选狼人目标时 avengerFaction 应为 Team.Good', () => {
      const ctx = createContext();
      const input = createInput(1); // wolf (Team.Wolf)

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(true);
      // Wolf is Wolf → shadow joins Wolf → avenger is Good
      expect(result.updates?.avengerFaction).toBe(Team.Good);
    });
  });

  describe('mimic avenger (bonded)', () => {
    it('选择复仇者时应设置 avengerFaction 为 Team.Third', () => {
      const ctx = createContext();
      const input = createInput(3); // avenger

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.idolTarget).toBe(3);
      expect(result.updates?.avengerFaction).toBe(Team.Third);
      expect(result.updates?.shadowMimicTarget).toBe(3);
    });
  });

  describe('constraint: notSelf', () => {
    it('不能选自己为模仿目标 (notSelf constraint)', () => {
      const ctx = createContext();
      const input = createInput(4); // self

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });
  });

  describe('nightmare block', () => {
    it('被噩梦之影封锁时 resolver 不拒绝非跳过行动（由 handler 层统一处理）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 },
      });
      const input = createInput(0);

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(true);
    });

    it('被噩梦之影封锁时可以跳过（虽然 canSkip=false，但被 block 时允许 skip）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 },
      });
      const input = createInput(undefined);

      const result = shadowChooseMimicResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });
});
