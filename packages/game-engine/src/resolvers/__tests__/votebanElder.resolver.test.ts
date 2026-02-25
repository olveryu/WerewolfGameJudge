/**
 * VotebanElder Resolver Unit Tests
 *
 * Tests for votebanElderBanResolver validation and resolution logic.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';
import { votebanElderBanResolver } from '@werewolf/game-engine/resolvers/votebanElder';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'wolf'],
    [2, 'votebanElder'],
    [3, 'seer'],
    [4, 'guard'],
  ]);

  return {
    actorSeat: 2,
    actorRoleId: 'votebanElder',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | null | undefined): ActionInput {
  return {
    schemaId: 'votebanElderBan',
    target: target ?? undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('votebanElderBanResolver', () => {
  describe('skip action', () => {
    it('应该接受空行动（不禁票）- undefined', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = votebanElderBanResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该接受空行动（不禁票）- null', () => {
      const ctx = createContext();
      const input = createInput(null);

      const result = votebanElderBanResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });

  describe('voteban action', () => {
    it('应该接受禁票其他玩家', () => {
      const ctx = createContext();
      const input = createInput(0); // voteban villager at seat 0

      const result = votebanElderBanResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.votebanTarget).toBe(0);
      expect(result.updates?.votebannedSeat).toBe(0);
    });

    it('禁票长老可以禁票自己', () => {
      const ctx = createContext();
      const input = createInput(2); // voteban self

      const result = votebanElderBanResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.votebanTarget).toBe(2);
      expect(result.updates?.votebannedSeat).toBe(2);
    });

    it('可以禁票狼人', () => {
      const ctx = createContext();
      const input = createInput(1); // voteban wolf at seat 1

      const result = votebanElderBanResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.votebanTarget).toBe(1);
    });
  });

  describe('invalid target', () => {
    it('应该拒绝不存在的目标', () => {
      const ctx = createContext();
      const input = createInput(99); // non-existent seat

      const result = votebanElderBanResolver(ctx, input);

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

      const result = votebanElderBanResolver(ctx, input);

      expect(result.valid).toBe(true);
    });

    it('被梦魇封锁时可以跳过', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 2 },
      });
      const input = createInput(undefined);

      const result = votebanElderBanResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });

  describe('updates', () => {
    it('禁票时应该更新 votebannedSeat', () => {
      const ctx = createContext();
      const input = createInput(3);

      const result = votebanElderBanResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.votebannedSeat).toBe(3);
    });
  });
});
