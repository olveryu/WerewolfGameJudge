import {
  describeWerewolfStepConfirmation,
  getWerewolfDaytimeAnnouncements,
  getWerewolfNightReview,
  getWerewolfViewModel,
  parseWerewolfState,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';

import { createGame } from './gameFactory';
import { driveNight, executeStepsUntil, presentation } from './nightDriver';

const ROLES: RoleId[] = [
  'wolf',
  'wolf',
  'scarletWolfKing',
  'seer',
  'witch',
  'guard',
  'beeHunter',
  'villager',
  'villager',
  'villager',
  'villager',
  'villager',
];

describe('scarlet wolf king through production commands', () => {
  it('keeps the wolf king outside the pack and gives the bee hunter no night step', () => {
    const game = createGame(ROLES);
    expect(executeStepsUntil(game, 'wolfKill', {})).toBe(true);
    const state = game.getGameState();
    expect(getWerewolfViewModel(state, { seat: 0, isHost: false }).wolfPackSeats).toEqual([0, 1]);
    expect(getWerewolfViewModel(state, { seat: 2, isHost: false }).wolfPackSeats).toBeNull();
    expect(presentation(state, 2)?.isActor).toBe(false);
    expect(state.nightState?.slice.order).not.toContain('beeHunter');
    expect(state.nightState?.slice.order).toEqual([
      'guardProtect',
      'wolfKill',
      'scarletWolfKingMark',
      'witchAction',
      'seerCheck',
    ]);
  });

  it('does not trigger the new mark when the target is guarded and checked', () => {
    const game = createGame(ROLES);
    driveNight(game, {
      guardProtect: { actionKey: 'guardProtect', seats: [7] },
      wolfKill: { actionKey: 'wolfKill', seats: [8] },
      scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [7] },
      seerCheck: { actionKey: 'seerCheck', seats: [7] },
    });
    const state = game.getGameState();
    expect(state.lastNightDeaths).toEqual([8]);
    expect(state.nightState?.slice.records.seerCheck?.bySeat[3]?.result).toMatchObject({
      faction: 'good',
    });
    expect(getWerewolfDaytimeAnnouncements(state)).toEqual([
      expect.objectContaining({ timing: 'beforeSheriff', message: '猩红之子：8号' }),
    ]);
    expect(parseWerewolfState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('kills the marked target with its king and records a distinct cause', () => {
    const game = createGame(ROLES);
    driveNight(game, {
      guardProtect: { actionKey: 'guardProtect', seats: [7] },
      wolfKill: { actionKey: 'wolfKill', seats: [2] },
      scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [7] },
    });
    const state = game.getGameState();
    expect(state.lastNightDeaths).toEqual([2, 7]);
    expect(state.deathReasons?.[7]).toBe('scarletLink');
    expect(getWerewolfNightReview(state).deaths).toContainEqual(
      expect.objectContaining({ seat: 7, reason: 'scarletLink' }),
    );
    expect(getWerewolfDaytimeAnnouncements(state)[0]?.message).toBe('猩红之子：8号');
  });

  it('does not trigger a link when the wolf king is saved', () => {
    const game = createGame(ROLES);
    driveNight(game, {
      wolfKill: { actionKey: 'wolfKill', seats: [2] },
      scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [7] },
      witchAction: { actionKey: 'antidote' },
    });
    expect(game.getGameState().lastNightDeaths).toEqual([]);
  });

  it('allows marking itself without recording a second death', () => {
    const game = createGame(ROLES);
    driveNight(game, {
      wolfKill: { actionKey: 'wolfKill', seats: [2] },
      scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [2] },
    });
    const state = game.getGameState();
    expect(state.lastNightDeaths).toEqual([2]);
    expect(state.deathReasons?.[2]).toBe('wolfKill');
    expect(getWerewolfDaytimeAnnouncements(state)[0]?.message).toBe('猩红之子：3号');
  });

  it('announces the swapped landing and explains it in the review', () => {
    const roles = [...ROLES];
    roles[5] = 'magician';
    const game = createGame(roles);
    driveNight(game, {
      magicianSwap: { actionKey: 'magicianSwap', seats: [7, 8] },
      scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [7] },
    });
    const state = game.getGameState();
    expect(getWerewolfDaytimeAnnouncements(state)[0]?.message).toBe('猩红之子：9号');
    expect(
      getWerewolfNightReview(state).lines.some(
        (line) =>
          line.kind === 'action' &&
          line.roleId === 'scarletWolfKing' &&
          line.phrase.includes('实际为9号'),
      ),
    ).toBe(true);
  });

  it('only names the selected seat in the night confirmation after a swap', () => {
    const roles = [...ROLES];
    roles[5] = 'magician';
    const game = createGame(roles);
    expect(
      executeStepsUntil(game, 'scarletWolfKingMark', {
        magicianSwap: { actionKey: 'magicianSwap', seats: [7, 8] },
      }),
    ).toBe(true);
    const confirmation = describeWerewolfStepConfirmation(game.getGameState(), 2, {
      actionKey: 'scarletWolfKingMark',
      seats: [7],
    });
    expect(JSON.stringify(confirmation)).toContain('8号');
    expect(JSON.stringify(confirmation)).not.toContain('9号');
  });

  it('allows the king to mark on a board without a wolf attack', () => {
    const game = createGame(['scarletWolfKing', 'beeHunter', 'seer', 'villager']);
    driveNight(game, { scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [3] } });
    expect(game.getGameState().nightState?.slice.order).not.toContain('wolfKill');
    expect(getWerewolfDaytimeAnnouncements(game.getGameState())[0]?.message).toBe('猩红之子：4号');
  });

  it('lets the host control a scarlet king bot through the normal command path', () => {
    const game = createGame(ROLES, undefined, { botSeats: [2] });
    driveNight(game, {
      scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [6] },
    });
    expect(getWerewolfDaytimeAnnouncements(game.getGameState())[0]?.message).toBe('猩红之子：7号');
  });

  it('links the mark when the king is the last wolf', () => {
    const game = createGame(['scarletWolfKing', 'witch', 'beeHunter', 'villager']);
    driveNight(game, {
      scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [3] },
      witchAction: { actionKey: 'poison', seats: [0] },
    });
    expect(game.getGameState().lastNightDeaths).toEqual([0, 3]);
    expect(game.getGameState().deathReasons?.[3]).toBe('scarletLink');
  });

  it('publishes the mark even when the marked player dies independently', () => {
    const game = createGame(ROLES);
    driveNight(game, {
      scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [7] },
      witchAction: { actionKey: 'poison', seats: [7] },
    });
    const state = game.getGameState();
    expect(state.lastNightDeaths).toContain(7);
    expect(getWerewolfDaytimeAnnouncements(state)[0]?.message).toBe('猩红之子：8号');
  });

  it('does not publish a mark or link when the king is feared', () => {
    const roles = [...ROLES];
    roles[1] = 'nightmare';
    const game = createGame(roles);
    driveNight(game, {
      nightmareBlock: { actionKey: 'nightmareBlock', seats: [2] },
      witchAction: { actionKey: 'poison', seats: [2] },
    });
    const state = game.getGameState();
    expect(state.lastNightDeaths).toEqual([2]);
    expect(getWerewolfDaytimeAnnouncements(state)).toEqual([]);
    expect(state.nightState?.facts.deathEffects).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ cause: 'scarletLink' })]),
    );
  });
});
