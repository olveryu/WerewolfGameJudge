/**
 * SilenceElder Resolver Unit Tests
 *
 * Tests for silenceElderSilenceResolver validation and resolution logic.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { silenceElderSilenceResolver } from '@werewolf/game-engine/resolvers/silenceElder';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'wolf'],
    [2, 'silenceElder'],
    [3, 'seer'],
    [4, 'guard'],
  ]);

  return {
    actorSeat: 2,
    actorRoleId: 'silenceElder',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | null | undefined): ActionInput {
  return {
    schemaId: 'silenceElderSilence',
    target: target ?? undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('silenceElderSilenceResolver', () => {
  describe('skip action', () => {
    it('应该接受空行动（不禁言）- undefined', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = silenceElderSilenceResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该接受空行动（不禁言）- null', () => {
      const ctx = createContext();
      const input = createInput(null);

      const result = silenceElderSilenceResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });

  describe('silence action', () => {
    it('应该接受禁言其他玩家', () => {
      const ctx = createContext();
      const input = createInput(0); // silence villager at seat 0

      const result = silenceElderSilenceResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.silenceTarget).toBe(0);
      expect(result.updates?.silencedSeat).toBe(0);
    });

    it('禁言长老可以禁言自己', () => {
      const ctx = createContext();
      const input = createInput(2); // silence self

      const result = silenceElderSilenceResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.silenceTarget).toBe(2);
      expect(result.updates?.silencedSeat).toBe(2);
    });

    it('可以禁言狼人', () => {
      const ctx = createContext();
      const input = createInput(1); // silence wolf at seat 1

      const result = silenceElderSilenceResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.silenceTarget).toBe(1);
    });
  });

  describe('invalid target', () => {
    it('应该拒绝不存在的目标', () => {
      const ctx = createContext();
      const input = createInput(99); // non-existent seat

      const result = silenceElderSilenceResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBe('目标玩家不存在');
    });
  });

  describe('nightmare block', () => {
    it('被梦魇封锁时 resolver 不再拒绝（由 handler 层统一处理）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 2 },
      });
      const input = createInput(0);

      const result = silenceElderSilenceResolver(ctx, input);

      expect(result.valid).toBe(true);
    });

    it('被梦魇封锁时可以跳过', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 2 },
      });
      const input = createInput(undefined);

      const result = silenceElderSilenceResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });

  describe('updates', () => {
    it('禁言时应该更新 silencedSeat', () => {
      const ctx = createContext();
      const input = createInput(3);

      const result = silenceElderSilenceResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.silencedSeat).toBe(3);
    });
  });
});
