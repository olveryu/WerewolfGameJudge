/**
 * 狼王魔术师12人 - Host Runtime Integration Test
 *
 * 使用 架构：
 * - intents → handlers → reducer → BroadcastGameState
 * - wire protocol（无 encoded target）
 */

import {
  createHostGame,
  cleanupHostGame,
  HostGameContext,
} from './hostGameFactory';
import { RoleId } from '../../../models/roles';

const TEMPLATE_NAME = '狼王魔术师12人';

function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'villager');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'darkWolfKing');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'magician');
  return map;
}

describe(`${TEMPLATE_NAME} - Host Runtime Integration`, () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Happy Path: 标准夜晚', () => {
    it('应该完整走完夜晚，狼人杀村民', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: 0,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
    });

    it('女巫救人：狼刀目标不死', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: 0,
        witch: { stepResults: { save: 0, poison: null } },
        seer: 7,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
    });
  });

  describe('Magician 特性（wire protocol）', () => {
    it('魔术师不交换：流程正常完成', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: { targets: [] },
        darkWolfKing: { confirmed: false },
        wolf: 1,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([1]);
    });

    it('魔术师交换身份：wire { targets: [a, b] }', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: { targets: [0, 1] },
        darkWolfKing: { confirmed: false },
        wolf: 0,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([1]);
    });
  });

  describe('Witch wire protocol', () => {
    it('女巫毒人：使用 stepResults', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: null,
        witch: { stepResults: { save: null, poison: 2 } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([2]);
    });
  });

  describe('Edge Cases', () => {
    it('狼空刀：平安夜', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: null,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
    });

    it('狼人刀黑狼王：黑狼王死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: 7,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([7]);
    });
  });

  describe('Confirm 角色（hunter/darkWolfKing）', () => {
    it('hunter confirmed=true：流程正常完成', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: true },
        wolf: 0,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4,
        hunter: { confirmed: true },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
    });

    it('darkWolfKing confirmed=true：流程正常完成', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: true },
        wolf: 1,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4,
        hunter: { confirmed: true },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([1]);
    });
  });
});
