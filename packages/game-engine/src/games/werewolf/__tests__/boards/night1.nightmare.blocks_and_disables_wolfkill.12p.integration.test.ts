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
 * - **Blocked player submits { kind: 'skip' } -> valid but has no effect**
 * - If nightmare selects a wolf-faction player: wolfKillDisabled === true, kill invalidated
 *
 * Architecture: intents -> handlers -> reducer -> GameState
 */

import { BLOCKED_UI_DEFAULTS, type RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import { executeStepsUntil, submitActionOrThrow } from './stepByStepRunner';

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
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 4 }, 'nightmare blocks wolf');

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
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 7 }, 'nightmare blocks itself');

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
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 0 }, 'nightmare blocks villager');

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
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 11 }, 'nightmare blocks guard');

      // Advance to the guard step
      expect(executeStepsUntil(ctx, 'guardProtect')).toBe(true);
      ctx.assertStep('guardProtect');

      // guard attempts to protect seat 0 (should be rejected)
      const guardResult = ctx.dispatchAsSeat(11, {
        type: 'werewolf.action.submit',
        input: { kind: 'target', target: 0 },
      });

      // Core assertion: non-skip action after being blocked is rejected
      expect(guardResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'domainRejected', reason: BLOCKED_UI_DEFAULTS.message },
      });

      // Verify ACTION_REJECTED is applied to GameState (full intent->handler->reducer->state pipeline)
      const state = ctx.getGameState();
      expect(state.actionRejected).toBeDefined();
      expect(state.actionRejected?.reason).toBe(BLOCKED_UI_DEFAULTS.message);
    });

    it('seer 被阻断后尝试查验 → reject', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks seer(8)
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 8 }, 'nightmare blocks seer');

      // Advance to the seer step
      expect(
        executeStepsUntil(ctx, 'seerCheck', {
          guard: null,
          wolf: 0,
          witch: { save: null, poison: null },
          hunter: { confirmed: true },
        }),
      ).toBe(true);
      ctx.assertStep('seerCheck');

      // seer attempts to check seat 4 (should be rejected)
      const seerResult = ctx.dispatchAsSeat(8, {
        type: 'werewolf.action.submit',
        input: { kind: 'target', target: 4 },
      });

      // Core assertion: non-skip action after being blocked is rejected
      expect(seerResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'domainRejected', reason: BLOCKED_UI_DEFAULTS.message },
      });

      // Verify ACTION_REJECTED is applied to GameState (full intent->handler->reducer->state pipeline)
      const state = ctx.getGameState();
      expect(state.actionRejected).toBeDefined();
      expect(state.actionRejected?.reason).toBe(BLOCKED_UI_DEFAULTS.message);
    });

    it('witch 被阻断后尝试救人 → reject', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks witch(9)
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 9 }, 'nightmare blocks witch');

      // Advance to the witch step
      expect(
        executeStepsUntil(ctx, 'witchAction', {
          guard: null,
          wolf: 0, // kill seat 0
        }),
      ).toBe(true);
      ctx.assertStep('witchAction');

      // witch attempts to save seat 0 (should be rejected)
      const witchResult = ctx.dispatchAsSeat(9, {
        type: 'werewolf.action.submit',
        input: { kind: 'witch', saveTarget: 0, poisonTarget: null },
      });

      // Core assertion: non-skip action after being blocked is rejected
      expect(witchResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'domainRejected', reason: BLOCKED_UI_DEFAULTS.message },
      });

      // Verify ACTION_REJECTED is applied to GameState (full intent->handler->reducer->state pipeline)
      const state = ctx.getGameState();
      expect(state.actionRejected).toBeDefined();
      expect(state.actionRejected?.reason).toBe(BLOCKED_UI_DEFAULTS.message);
    });
  });

  describe('被阻断者提交 skip → 有效但无效果', () => {
    it('seer 被阻断后 skip，流程继续但 seerReveal 为空', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks seer(8)
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 8 }, 'nightmare blocks seer');

      // Advance to the seer step
      expect(
        executeStepsUntil(ctx, 'seerCheck', {
          guard: null,
          wolf: 0,
          witch: { save: null, poison: null },
          hunter: { confirmed: true },
        }),
      ).toBe(true);
      ctx.assertStep('seerCheck');

      // seer skip (only skip is allowed after being blocked)
      submitActionOrThrow(ctx, 8, { kind: 'skip' }, 'blocked seer skips');

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
      submitActionOrThrow(ctx, 7, { kind: 'skip' }, 'nightmare skips block');

      const state = ctx.getGameState();
      expect(state.currentNightResults?.blockedSeat).toBeUndefined();
      expect(state.currentNightResults?.wolfKillOverride).toBeUndefined();
    });
  });
});
