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
 * - Blocked abilities are unavailable with a visible reason; forged submissions are rejected.
 * - A blocked player may skip without an effect.
 * - If nightmare selects a wolf-faction player: wolfKillDisabled === true, kill invalidated
 *
 * Architecture: intents -> handlers -> reducer -> GameState
 */

import { getWerewolfViewModel, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { REASON_STEP_STALE } from '@game-judge/game-engine/platform/steps';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import { dispatchStep, executeStepsUntil, submitActionOrThrow } from './stepByStepRunner';

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
    it('nightmare 选中 wolf(4)，禁用狼队袭击', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Execute up to the nightmareBlock step
      ctx.assertStep('nightmareBlock');

      // nightmare blocks wolf(seat 4)
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 4 }, 'nightmare blocks wolf');

      const state = ctx.getGameState();
      expect(state.nightState?.facts.disabledAbilities).toContainEqual({ roleId: '*', seat: 4 });
      for (const seat of [4, 5, 6, 7]) {
        expect(state.nightState?.facts.disabledAbilities).toContainEqual({
          roleId: 'wolfKill',
          seat,
        });
      }
    });

    it('nightmare 选中自己时禁用狼队袭击', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks itself
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 7 }, 'nightmare blocks itself');

      const state = ctx.getGameState();
      expect(state.nightState?.facts.disabledAbilities).toContainEqual({
        roleId: 'wolfKill',
        seat: 7,
      });
    });
  });

  describe('Nightmare 阻断好人阵营 → 不禁止袭击', () => {
    it('nightmare 选中 villager(0)，不禁用狼队袭击', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks villager
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 0 }, 'nightmare blocks villager');

      const state = ctx.getGameState();
      expect(state.nightState?.facts.disabledAbilities).toEqual([{ roleId: '*', seat: 0 }]);
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
      const step = getWerewolfViewModel(ctx.getGameState(), { seat: 11, isHost: false }).step;
      expect(step?.actions.find((action) => action.key === 'guardProtect')?.availability).toEqual({
        kind: 'unavailable',
        reason: '被噩梦之影恐惧，本夜无法使用技能',
      });
      expect(dispatchStep(ctx, 11, { actionKey: 'guardProtect', seats: [0] })).toMatchObject({
        kind: 'rejected',
        reason: REASON_STEP_STALE,
      });
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
      const step = getWerewolfViewModel(ctx.getGameState(), { seat: 8, isHost: false }).step;
      expect(step?.actions.find((action) => action.key === 'seerCheck')?.availability).toEqual({
        kind: 'unavailable',
        reason: '被噩梦之影恐惧，本夜无法使用技能',
      });
      expect(dispatchStep(ctx, 8, { actionKey: 'seerCheck', seats: [4] })).toMatchObject({
        kind: 'rejected',
        reason: REASON_STEP_STALE,
      });
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
      const step = getWerewolfViewModel(ctx.getGameState(), { seat: 9, isHost: false }).step;
      expect(step?.actions.find((action) => action.key === 'antidote')?.availability).toEqual({
        kind: 'unavailable',
        reason: '被噩梦之影恐惧，本夜无法使用技能',
      });
      expect(dispatchStep(ctx, 9, { actionKey: 'antidote' })).toMatchObject({
        kind: 'rejected',
        reason: REASON_STEP_STALE,
      });
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

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.seerCheck?.bySeat[8]?.result).toBeNull();
    });
  });

  describe('Nightmare 不行动', () => {
    it('nightmare 空选，袭击正常生效', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare skip
      submitActionOrThrow(ctx, 7, { kind: 'skip' }, 'nightmare skips block');

      const state = ctx.getGameState();
      expect(state.nightState?.facts.disabledAbilities).toEqual([]);
    });
  });
});
