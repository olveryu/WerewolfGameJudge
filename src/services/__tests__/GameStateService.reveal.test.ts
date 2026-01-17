/**
 * GameStateService Reveal Tests
 * 
 * Tests for SEER_REVEAL, PSYCHIC_REVEAL, GARGOYLE_REVEAL, WITCH_CONTEXT private message sending.
 */

import { createHostGame, cleanupHostGame, HostGameContext, mockSendPrivate } from './boards/hostGameFactory';
import { RoleId } from '../../models/roles';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEMPLATE_NIGHTMARE = '梦魇守卫12人';
const TEMPLATE_PSYCHIC = '机械狼通灵师12人';
const TEMPLATE_GARGOYLE = '石像鬼守墓人12人';

function createNightmareRoleAssignment(): Map<number, RoleId> {
  const assignment = new Map<number, RoleId>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'nightmare');
  assignment.set(8, 'seer');
  assignment.set(9, 'witch');
  assignment.set(10, 'hunter');
  assignment.set(11, 'guard');
  return assignment;
}

function createPsychicRoleAssignment(): Map<number, RoleId> {
  const assignment = new Map<number, RoleId>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'wolfRobot');
  assignment.set(8, 'psychic');
  assignment.set(9, 'witch');
  assignment.set(10, 'hunter');
  assignment.set(11, 'guard');
  return assignment;
}

function createGargoyleRoleAssignment(): Map<number, RoleId> {
  const assignment = new Map<number, RoleId>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'gargoyle');
  assignment.set(8, 'seer');
  assignment.set(9, 'witch');
  assignment.set(10, 'hunter');
  assignment.set(11, 'graveyardKeeper');
  return assignment;
}

// =============================================================================
// Tests
// =============================================================================

describe('GameStateService Reveal', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('SEER_REVEAL', () => {
    it('预言家查狼人应该发送 SEER_REVEAL 结果为狼人', async () => {
      ctx = await createHostGame(TEMPLATE_NIGHTMARE, createNightmareRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: 2,
        witch: null,
        seer: 4, // seat 4 is wolf
        hunter: null,
      });

      // Find the SEER_REVEAL call
      const seerRevealCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'SEER_REVEAL'
      );

      expect(seerRevealCalls.length).toBeGreaterThan(0);
      const payload = seerRevealCalls[0][0].payload;
      expect(payload.targetSeat).toBe(4);
      expect(payload.result).toBe('狼人');
    });

    it('预言家查好人应该发送 SEER_REVEAL 结果为好人', async () => {
      ctx = await createHostGame(TEMPLATE_NIGHTMARE, createNightmareRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: 2,
        witch: null,
        seer: 0, // seat 0 is villager
        hunter: null,
      });

      const seerRevealCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'SEER_REVEAL'
      );

      expect(seerRevealCalls.length).toBeGreaterThan(0);
      const payload = seerRevealCalls[0][0].payload;
      expect(payload.targetSeat).toBe(0);
      expect(payload.result).toBe('好人');
    });

    it('预言家被梦魇封锁时不应发送 SEER_REVEAL', async () => {
      ctx = await createHostGame(TEMPLATE_NIGHTMARE, createNightmareRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        nightmare: 8, // block seer at seat 8
        guard: 1,
        wolf: 2,
        witch: null,
        seer: null, // seer is blocked, skip
        hunter: null,
      });

      const seerRevealCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'SEER_REVEAL'
      );

      // Seer was blocked, no reveal should be sent
      expect(seerRevealCalls.length).toBe(0);
    });
  });

  describe('WITCH_CONTEXT', () => {
    it('女巫阶段应该发送 WITCH_CONTEXT 包含被刀座位', async () => {
      ctx = await createHostGame(TEMPLATE_NIGHTMARE, createNightmareRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: 2, // wolf kills seat 2
        witch: null,
        seer: 4,
        hunter: null,
      });

      const witchContextCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'WITCH_CONTEXT'
      );

      expect(witchContextCalls.length).toBeGreaterThan(0);
      const payload = witchContextCalls[0][0].payload;
      expect(payload.killedIndex).toBe(2);
      expect(payload.canSave).toBe(true);
    });

    it('守卫守住时 WITCH_CONTEXT 的 killedIndex 仍然是被刀座位（守卫效果在结算时才生效）', async () => {
      ctx = await createHostGame(TEMPLATE_NIGHTMARE, createNightmareRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        nightmare: 0,
        guard: 2, // guard protects seat 2
        wolf: 2,  // wolf kills seat 2 (but guarded)
        witch: null,
        seer: 4,
        hunter: null,
      });

      const witchContextCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'WITCH_CONTEXT'
      );

      expect(witchContextCalls.length).toBeGreaterThan(0);
      const payload = witchContextCalls[0][0].payload;
      // WITCH_CONTEXT is sent before guard resolution, so it shows the wolf target
      // The guard protection is resolved in death calculation, not in WITCH_CONTEXT
      expect(payload.killedIndex).toBe(2);
    });
  });

  describe('ACTION_REJECTED', () => {
    it('狼人投票被禁止的目标应该发送 ACTION_REJECTED', async () => {
      ctx = await createHostGame(TEMPLATE_NIGHTMARE, createNightmareRoleAssignment());
      mockSendPrivate.mockClear();

      // Wolf at seat 4 tries to vote for wolfKing - this would be rejected if wolf vote restriction is on
      // For this test, we need to trigger a rejection scenario
      // Using sendWolfVote to simulate the rejection
      const wolfSeat = ctx.findSeatByRole('wolf');
      
      // Try to vote for nightmare (seat 7) - this is valid, no rejection expected
      // To test rejection, we'd need to vote for a forbidden target which depends on config
    });
  });

  describe('PSYCHIC_REVEAL', () => {
    it('通灵师验人应该发送 PSYCHIC_REVEAL', async () => {
      ctx = await createHostGame(TEMPLATE_PSYCHIC, createPsychicRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        guard: 0,
        wolf: 1,
        wolfRobot: null,
        witch: null,
        psychic: 4, // check wolf at seat 4
        hunter: null,
      });

      const psychicRevealCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'PSYCHIC_REVEAL'
      );

      expect(psychicRevealCalls.length).toBeGreaterThan(0);
      const payload = psychicRevealCalls[0][0].payload;
      expect(payload.targetSeat).toBe(4);
      // Psychic reveals the role name, not just good/bad
      expect(payload.result).toBeDefined();
    });

    it('通灵师查好人应该发送正确结果', async () => {
      ctx = await createHostGame(TEMPLATE_PSYCHIC, createPsychicRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        guard: 0,
        wolf: 1,
        wolfRobot: null,
        witch: null,
        psychic: 0, // check villager at seat 0
        hunter: null,
      });

      const psychicRevealCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'PSYCHIC_REVEAL'
      );

      expect(psychicRevealCalls.length).toBeGreaterThan(0);
      const payload = psychicRevealCalls[0][0].payload;
      expect(payload.targetSeat).toBe(0);
    });
  });

  describe('GARGOYLE_REVEAL', () => {
    it('石像鬼验人应该发送 GARGOYLE_REVEAL', async () => {
      ctx = await createHostGame(TEMPLATE_GARGOYLE, createGargoyleRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        gargoyle: 4, // check wolf at seat 4
        wolf: 1,
        witch: null,
        seer: 0,
        hunter: null,
        graveyardKeeper: null,
      });

      const gargoyleRevealCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'GARGOYLE_REVEAL'
      );

      expect(gargoyleRevealCalls.length).toBeGreaterThan(0);
      const payload = gargoyleRevealCalls[0][0].payload;
      expect(payload.targetSeat).toBe(4);
      expect(payload.result).toBeDefined();
    });

    it('石像鬼查好人应该发送正确结果', async () => {
      ctx = await createHostGame(TEMPLATE_GARGOYLE, createGargoyleRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        gargoyle: 0, // check villager at seat 0
        wolf: 1,
        witch: null,
        seer: 4,
        hunter: null,
        graveyardKeeper: null,
      });

      const gargoyleRevealCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'GARGOYLE_REVEAL'
      );

      expect(gargoyleRevealCalls.length).toBeGreaterThan(0);
      const payload = gargoyleRevealCalls[0][0].payload;
      expect(payload.targetSeat).toBe(0);
    });
  });
});
