/** Seed Wolf resolver tests for authoritative infection intent recording. */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import { seedWolfInfectResolver } from '@game-judge/game-engine/games/werewolf/domain/resolvers/seedWolf';
import type { ResolverContext } from '@game-judge/game-engine/games/werewolf/domain/resolvers/types';

function createContext(
  infectionContext: ResolverContext['gameState']['seedWolfInfectionContext'],
): ResolverContext {
  return {
    rng: () => 0.5,
    actorSeat: 1,
    actorRoleId: 'seedWolf',
    players: new Map<number, RoleId>([
      [0, 'wolf'],
      [1, 'seedWolf'],
      [2, 'villager'],
    ]),
    currentNightResults: {},
    gameState: {
      isNight1: true,
      isWolfVoteUnanimityRequired: false,
      seedWolfInfectionContext: infectionContext,
    },
  };
}

describe('seedWolfInfectResolver', () => {
  it('records the authoritative target when infection is confirmed', () => {
    const result = seedWolfInfectResolver(
      createContext({ availability: 'available', targetSeat: 2 }),
      { schemaId: 'seedWolfInfect', confirmed: true },
    );

    expect(result).toEqual({ valid: true, updates: { seedWolfInfectionTarget: 2 } });
  });

  it('accepts canonical skip without recording an infection target', () => {
    const result = seedWolfInfectResolver(
      createContext({ availability: 'available', targetSeat: 2 }),
      { schemaId: 'seedWolfInfect' },
    );

    expect(result).toEqual({ valid: true });
  });

  it('rejects confirmation when the target is unavailable', () => {
    const result = seedWolfInfectResolver(createContext({ availability: 'unavailable' }), {
      schemaId: 'seedWolfInfect',
      confirmed: true,
    });

    expect(result).toEqual({
      valid: false,
      rejectReason: '本夜没有可感染的狼人袭击目标',
    });
  });
});
