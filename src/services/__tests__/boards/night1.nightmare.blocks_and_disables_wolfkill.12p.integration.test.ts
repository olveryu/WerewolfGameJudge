/**
 * Night-1 Integration Test: Nightmare Blocks Actions and Disables Wolf Kill
 *
 * Theme: Nightmare blocks role skills + selecting a wolf disables wolf kill.
 *
 * Template: Nightmare Guard
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: nightmare
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * Core rules (nightmare block semantics):
 * - **Blocked player submits non-skip action -> server rejects** (actionHandler layer checkNightmareBlockGuard)
 * - **Blocked player submits skip (target: null) -> valid but has no effect**
 * - If nightmare selects a wolf-faction player: wolfKillDisabled === true, kill invalidated
 *
 * Architecture: intents -> handlers -> reducer -> WerewolfState
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeStepsUntil } from './stepByStepRunner';

const TEMPLATE_NAME = '噩梦之影守卫';

/**
 * Fixed seat-role assignment
 */
function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'villager');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'nightmare');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: Nightmare Blocks Actions and Disables Wolf Kill (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Nightmare 阻断狼阵营 → 禁止袭击', () => {
    it('nightmare 选中 wolf(4)，wolfKillOverride set', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Execute up to the nightmareBlock step
      ctx.assertStep('nightmareBlock');

      // nightmare blocks wolf(seat 4)
      const blockResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 4,
      });
      expect(blockResult.success).toBe(true);
      ctx.advanceNight();

      // Core assertion: wolfKillOverride set
      const state = ctx.getGameState();
      expect(state.currentNightResults?.wolfKillOverride).toBeDefined();
      expect(state.currentNightResults?.wolfKillOverride?.source).toBe('nightmare');
      expect(state.currentNightResults?.blockedSeat).toBe(4);
    });

    it('nightmare 选中 nightmare 自己(7，狼阵营)，wolfKillOverride set', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks itself
      const blockResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 7,
      });
      expect(blockResult.success).toBe(true);
      ctx.advanceNight();

      // nightmare is wolf faction; selecting itself also triggers the kill disable
      const state = ctx.getGameState();
      expect(state.currentNightResults?.wolfKillOverride).toBeDefined();
    });
  });

  describe('Nightmare 阻断好人阵营 → 不禁止袭击', () => {
    it('nightmare 选中 villager(0)，wolfKillOverride 不设置', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks villager
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 0,
      });
      ctx.advanceNight();

      // Core assertion: wolfKillOverride not set (undefined)
      const state = ctx.getGameState();
      expect(state.currentNightResults?.wolfKillOverride).toBeUndefined();
      expect(state.currentNightResults?.blockedSeat).toBe(0);
    });
  });

  describe('被阻断者提交非 skip action → reject', () => {
    it('guard 被阻断后尝试守护 → reject', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks guard(11)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 11,
      });
      ctx.advanceNight();

      // Advance to the guard step
      executeStepsUntil(ctx, 'guardProtect', {});
      ctx.assertStep('guardProtect');

      // guard attempts to protect seat 0 (should be rejected)
      const guardResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 11,
        role: 'guard',
        target: 0,
      });

      // Core assertion: non-skip action after being blocked is rejected
      expect(guardResult.success).toBe(false);
      expect(guardResult.reason).toContain('噩梦之影封锁');

      // Verify ACTION_REJECTED is applied to WerewolfState (full intent->handler->reducer->state pipeline)
      const state = ctx.getGameState();
      expect(state.actionRejected).toBeDefined();
      expect(state.actionRejected!.reason).toContain('噩梦之影封锁');
    });

    it('seer 被阻断后尝试查验 → reject', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks seer(8)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 8,
      });
      ctx.advanceNight();

      // Advance to the seer step
      executeStepsUntil(ctx, 'seerCheck', {
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      ctx.assertStep('seerCheck');

      // seer attempts to check seat 4 (should be rejected)
      const seerResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 8,
        role: 'seer',
        target: 4,
      });

      // Core assertion: non-skip action after being blocked is rejected
      expect(seerResult.success).toBe(false);
      expect(seerResult.reason).toContain('噩梦之影封锁');

      // Verify ACTION_REJECTED is applied to WerewolfState (full intent->handler->reducer->state pipeline)
      const state = ctx.getGameState();
      expect(state.actionRejected).toBeDefined();
      expect(state.actionRejected!.reason).toContain('噩梦之影封锁');
    });

    it('witch 被阻断后尝试救人 → reject', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks witch(9)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 9,
      });
      ctx.advanceNight();

      // Advance to the witch step
      executeStepsUntil(ctx, 'witchAction', {
        guard: null,
        wolf: 0, // kill seat 0
      });
      ctx.assertStep('witchAction');

      // witch attempts to save seat 0 (should be rejected)
      // Correct witch message format: use stepResults
      const witchResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 9,
        role: 'witch',
        target: null,
        extra: { stepResults: { save: 0, poison: null } },
      });

      // Core assertion: non-skip action after being blocked is rejected
      expect(witchResult.success).toBe(false);
      expect(witchResult.reason).toContain('噩梦之影封锁');

      // Verify ACTION_REJECTED is applied to WerewolfState (full intent->handler->reducer->state pipeline)
      const state = ctx.getGameState();
      expect(state.actionRejected).toBeDefined();
      expect(state.actionRejected!.reason).toContain('噩梦之影封锁');
    });
  });

  describe('被阻断者提交 skip → 有效但无效果', () => {
    it('seer 被阻断后 skip，流程继续但 seerReveal 为空', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks seer(8)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 8,
      });
      ctx.advanceNight();

      // Advance to the seer step
      executeStepsUntil(ctx, 'seerCheck', {
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      ctx.assertStep('seerCheck');

      // seer skip (only skip is allowed after being blocked)
      const seerResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 8,
        role: 'seer',
        target: null, // skip
      });

      // Core assertion: skip is valid
      expect(seerResult.success).toBe(true);

      // seerReveal is empty (because of skip)
      const state = ctx.getGameState();
      expect(state.seerReveal?.result).toBeUndefined();
    });
  });

  describe('Nightmare 不行动', () => {
    it('nightmare 空选，袭击正常生效', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare skip
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: null,
      });
      ctx.advanceNight();

      const state = ctx.getGameState();
      expect(state.currentNightResults?.blockedSeat).toBeUndefined();
      expect(state.currentNightResults?.wolfKillOverride).toBeUndefined();
    });
  });
});
