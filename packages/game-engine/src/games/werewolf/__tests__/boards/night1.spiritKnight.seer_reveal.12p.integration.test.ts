/**
 * Night-1 Integration Test: Spirit Knight - Seer Reveal
 *
 * Board: Spirit Knight
 * Topic: Seer check result written to GameState.seerReveal
 *
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: spiritKnight
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * Architecture: intents → handlers → reducer → GameState
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '恶灵骑士';

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
  map.set(7, 'spiritKnight');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: 恶灵骑士 - Seer Reveal (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Seer 查验结果写入 seerReveal', () => {
    it('seer 查验 villager(0)，seerReveal.result 为 "好人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 0, // 查验 villager
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.seerCheck?.bySeat[8]?.result).toMatchObject({
        kind: 'factionCheck',
        chosenSeat: 0,
        landingSeat: 0,
        faction: 'good',
      });

      expect(result.deaths).toEqual([1]);
    });

    it('seer 查验 spiritKnight(7，狼阵营)，seerReveal.result 为 "狼人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 7, // 查验 spiritKnight
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.seerCheck?.bySeat[8]?.result).toMatchObject({
        kind: 'factionCheck',
        chosenSeat: 7,
        landingSeat: 7,
        faction: 'wolf',
      });
    });
  });

  describe('Seer 空选', () => {
    it('seer 不查验时，seerReveal 不包含结果', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: null, // 不查验
      });

      expect(result.completed).toBe(true);

      expect(ctx.getGameState().nightState?.slice.records.seerCheck?.bySeat[8]?.result).toBeNull();
    });
  });

  describe('Guard + Seer 协作', () => {
    it('guard 守护 seer，seer 查验 wolf，seerReveal 和 guardedSeat 都写入', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: 8, // 守护 seer
        wolf: 8, // 袭击 seer
        witch: { save: null, poison: null },
        seer: 4, // 查验 wolf
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.seerCheck?.bySeat[8]?.result).toMatchObject({
        kind: 'factionCheck',
        chosenSeat: 4,
        landingSeat: 4,
        faction: 'wolf',
      });
      expect(state.nightState?.facts.selections).toContainEqual({
        roleId: 'guard',
        actorSeat: 11,
        chosenSeat: 8,
        landingSeat: 8,
      });

      // Guard blocked the wolf attack on seer, no one dies
      expect(result.deaths).toEqual([]);
    });
  });
});
