/**
 * Witch Resolver Unit Tests
 *
 * Tests for witchActionResolver validation and resolution logic.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

import { witchActionResolver } from '@/services/night/resolvers/witch';

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
    currentNightResults: { wolfVotesBySeat: { '2': 0 } },
    witchState: { canSave: true, canPoison: true },
    gameState: { isNight1: true },
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
    it('应该接受 stepResults 为 undefined（不使用技能/跳过）', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(true);
      // 跳过时没有 save/poison，updates 应该是空的
      expect(result.updates?.savedSeat).toBeUndefined();
      expect(result.updates?.poisonedSeat).toBeUndefined();
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
        currentNightResults: { wolfVotesBySeat: { '1': 5 } }, // witch is killed
      });
      const input = createInput({ save: 5, poison: null });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('自救');
    });

    it('应该拒绝解药已用完', () => {
      const ctx = createContext({
        witchState: { canSave: false, canPoison: true },
      });
      const input = createInput({ save: 0, poison: null });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('解药');
    });

    it('应该拒绝救非狼刀目标', () => {
      const ctx = createContext({
        currentNightResults: { wolfVotesBySeat: { '1': 0 } },
      });
      const input = createInput({ save: 1, poison: null }); // seat 1 is not wolf target

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('被狼人袭击');
    });

    it('应该接受救被狼刀目标', () => {
      const ctx = createContext({
        currentNightResults: { wolfVotesBySeat: { '1': 0 } },
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
        witchState: { canSave: true, canPoison: false },
      });
      const input = createInput({ save: null, poison: 1 });

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('毒药');
    });

    it('应该拒绝同时救和毒', () => {
      const ctx = createContext({
        currentNightResults: { wolfVotesBySeat: { '1': 0 } },
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
        currentNightResults: { wolfVotesBySeat: { '1': 0 } },
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
    // NOTE: Nightmare block guard is now at actionHandler layer.
    // The resolver itself does NOT reject blocked actions.
    // These tests verify resolver behavior when invoked directly (skip returns empty result)

    it('被梦魇封锁时跳过返回空结果', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 5 }, // witch is blocked
      });
      const input = createInput(undefined);

      const result = witchActionResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });
});
