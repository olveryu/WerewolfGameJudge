/**
 * Night-1 Integration Test: WolfRobot Disguise - Psychic Reveal
 *
 * Theme: Wolf Robot disguises identity after learning, Psychic check shows disguised role
 *
 * Template: Wolf Robot Psychic
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: wolfRobot
 *   seat 8: psychic
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * Core rules (wolfRobot disguise contract - psychic perspective):
 * - After wolfRobot learns a role, psychic check on wolfRobot shows disguisedRole
 * - When not learned, psychic check returns wolfRobot itself
 *
 * Architecture: intents -> handlers -> resolver(resolveRoleForChecks) -> GameState
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '机械狼人通灵师';

/**
 * Fixed seat-role assignment (by template order)
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
  map.set(7, 'wolfRobot');
  map.set(8, 'psychic');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: WolfRobot Disguise - Psychic Reveal (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('wolfRobot 学习 villager，psychic 查验 wolfRobot 显示 villager', () => {
    ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolfRobot: 0, // learn villager
      guard: null,
      wolf: 1,
      witch: { save: null, poison: null },
      psychic: 7, // check wolfRobot
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();
    expect(state.nightState?.slice.records.wolfRobotLearn?.bySeat[7]?.result).toMatchObject({
      kind: 'identityCheck',
      chosenSeat: 0,
      landingSeat: 0,
      roleId: 'villager',
    });
    expect(state.nightState?.slice.records.psychicCheck?.bySeat[8]?.result).toMatchObject({
      kind: 'identityCheck',
      chosenSeat: 7,
      landingSeat: 7,
      roleId: 'villager',
    });
  });

  it('wolfRobot 学习 wolf，psychic 查验 wolfRobot 显示 wolf', () => {
    ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolfRobot: 4, // learn wolf
      guard: null,
      wolf: 1,
      witch: { save: null, poison: null },
      psychic: 7, // check wolfRobot
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();
    expect(state.nightState?.slice.records.wolfRobotLearn?.bySeat[7]?.result).toMatchObject({
      kind: 'identityCheck',
      chosenSeat: 4,
      roleId: 'wolf',
    });
    expect(state.nightState?.slice.records.psychicCheck?.bySeat[8]?.result).toMatchObject({
      kind: 'identityCheck',
      chosenSeat: 7,
      roleId: 'wolf',
    });
  });

  it('wolfRobot 空选，psychic 查验 wolfRobot 显示 wolfRobot（本体）', () => {
    ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolfRobot: null, // do not learn
      guard: null,
      wolf: 1,
      witch: { save: null, poison: null },
      psychic: 7, // check wolfRobot
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();
    expect(state.nightState?.slice.records.wolfRobotLearn?.bySeat[7]?.result).toBeNull();
    expect(state.nightState?.slice.records.psychicCheck?.bySeat[8]?.result).toMatchObject({
      kind: 'identityCheck',
      chosenSeat: 7,
      roleId: 'wolfRobot',
    });
  });
});
