/**
 * Witch Resolver Unit Tests
 * 
 * Tests for witchActionResolver validation and resolution logic.
 */

import { witchActionResolver } from '../witch';
import type { ResolverContext, ActionInput } from '../types';
import type { RoleId } from '../../../../models/roles/spec/specs';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'villager'],
    [2, 'wolf'],
    [3, 'wolf'],
    [4, 'seer'],
    [5, 'witch'],
  ]);

  return {
    actorSeat: 5,
    actorRoleId: 'witch',
    players: defaultPlayers,
    currentNightResults: { wolfKillTarget: 0 },
    gameState: {
      isNight1: true,
      witchHasAntidote: true,
      witchHasPoison: true,
    },
    ...overrides,
  };
}

function createInput(stepResults: Record<string, number | null> | undefined): ActionInput {
  return {
    schemaId: 'witchAction',
    stepResults,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('witchActionResolver', () => {
  describe('validate', () => {
    it('应该拒绝缺少行动数据', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('行动数据');
    });

    it('应该接受空行动（不使用技能）', () => {
      const ctx = createContext();
      const input = createInput({ save: null, poison: null });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(true);
    });
  });

  describe('save action', () => {
    it('应该拒绝女巫自救 (notSelf constraint)', () => {
      const ctx = createContext({
        currentNightResults: { wolfKillTarget: 5 }, // witch is killed
      });
      const input = createInput({ save: 5, poison: null });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('自救');
    });

    it('应该拒绝解药已用完', () => {
      const ctx = createContext({
        gameState: { witchHasAntidote: false, witchHasPoison: true },
      });
      const input = createInput({ save: 0, poison: null });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('解药');
    });

    it('应该拒绝救非狼刀目标', () => {
      const ctx = createContext({
        currentNightResults: { wolfKillTarget: 0 },
      });
      const input = createInput({ save: 1, poison: null }); // seat 1 is not wolf target

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('被狼人袭击');
    });

    it('应该接受救被狼刀目标', () => {
      const ctx = createContext({
        currentNightResults: { wolfKillTarget: 0 },
      });
      const input = createInput({ save: 0, poison: null });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.savedTarget).toBe(0);
    });
  });

  describe('poison action', () => {
    it('应该拒绝毒药已用完', () => {
      const ctx = createContext({
        gameState: { witchHasAntidote: true, witchHasPoison: false },
      });
      const input = createInput({ save: null, poison: 1 });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('毒药');
    });

    it('应该拒绝同时救和毒', () => {
      const ctx = createContext({
        currentNightResults: { wolfKillTarget: 0 },
      });
      const input = createInput({ save: 0, poison: 1 });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('同时');
    });

    it('应该接受单独使用毒药', () => {
      const ctx = createContext();
      const input = createInput({ save: null, poison: 2 });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.poisonedTarget).toBe(2);
    });

    it('女巫可以毒自己（neutral judge）', () => {
      const ctx = createContext();
      const input = createInput({ save: null, poison: 5 }); // witch poisons self

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.poisonedTarget).toBe(5);
    });
  });

  describe('updates', () => {
    it('救人时应该更新 savedSeat', () => {
      const ctx = createContext({
        currentNightResults: { wolfKillTarget: 0 },
      });
      const input = createInput({ save: 0, poison: null });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.savedSeat).toBe(0);
    });

    it('毒人时应该更新 poisonedSeat', () => {
      const ctx = createContext();
      const input = createInput({ save: null, poison: 2 });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.poisonedSeat).toBe(2);
    });
  });

  describe('nightmare block', () => {
    it('被梦魇封锁时应该返回空结果', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 5 }, // witch is blocked
      });
      const input = createInput({ save: 0, poison: null });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.savedTarget).toBeUndefined();
      expect(result.result?.poisonedTarget).toBeUndefined();
    });
  });
});
