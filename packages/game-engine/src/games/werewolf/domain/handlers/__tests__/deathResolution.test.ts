import { createGame } from '../../../__tests__/boards/gameFactory';
import type { RoleId } from '../../models/roles';
import { validateTemplateRoles } from '../../models/Template';
import { calculateNightDeaths } from '../deathResolution';

describe('death resolution with duplicate passive roles', () => {
  it.each([0, 1])('preserves wolf-kill immunity for cursed fox at seat %i', (targetSeat) => {
    const roles: RoleId[] = ['cursedFox', 'cursedFox', 'wolf', 'seer'];
    expect(validateTemplateRoles(roles)).toBeNull();
    const state = createGame(roles).getGameState();
    expect(calculateNightDeaths(state, targetSeat).deaths).toEqual([]);
  });

  it.each([0, 1])('preserves check vulnerability for cursed fox at seat %i', (targetSeat) => {
    const state = createGame(['cursedFox', 'cursedFox', 'wolf', 'seer']).getGameState();
    expect(
      calculateNightDeaths(
        {
          ...state,
          actions: [{ schemaId: 'seerCheck', actorSeat: 3, targetSeat, timestamp: 0 }],
        },
        null,
      ).deathReasons,
    ).toEqual({ [targetSeat]: 'checkDeath' });
  });

  it.each(['masquerade', 'spiritKnight'] as const)(
    'preserves poison immunity for both copies of %s',
    (role) => {
      const roles: RoleId[] = [role, role, 'wolf', 'witch'];
      expect(validateTemplateRoles(roles)).toBeNull();
      const state = createGame(roles).getGameState();
      for (const targetSeat of [0, 1]) {
        const result = calculateNightDeaths(
          {
            ...state,
            currentNightResults: { poisonedSeat: targetSeat },
          },
          null,
        );
        expect(result.deaths).not.toContain(targetSeat);
        expect(result.deaths).toEqual(role === 'spiritKnight' ? [3] : []);
      }
    },
  );

  it.each([0, 1])('preserves reflection for spirit knight at seat %i', (targetSeat) => {
    const state = createGame(['spiritKnight', 'spiritKnight', 'wolf', 'seer']).getGameState();
    expect(
      calculateNightDeaths(
        {
          ...state,
          actions: [{ schemaId: 'seerCheck', actorSeat: 3, targetSeat, timestamp: 0 }],
        },
        null,
      ).deathReasons,
    ).toEqual({ 3: 'reflection' });
  });

  it('moves one copy through magician swap without losing the other copy', () => {
    const state = createGame([
      'cursedFox',
      'cursedFox',
      'villager',
      'wolf',
      'magician',
    ]).getGameState();
    const swapped = { ...state, currentNightResults: { swappedSeats: [0, 2] as const } };
    expect(calculateNightDeaths(swapped, 0).deaths).toEqual([2]);
    expect(calculateNightDeaths(swapped, 1).deaths).toEqual([]);
    expect(calculateNightDeaths(swapped, 2).deaths).toEqual([]);
  });
});
