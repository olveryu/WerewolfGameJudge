/**
 * Night-1-only Resolver Contract Tests
 *
 * This app is Night-1 only: resolvers must not enforce cross-night constraints.
 */

import type { ResolverContext } from '@werewolf/game-engine/resolvers/types';

import { dreamcatcherDreamResolver } from '@/services/night/resolvers/dreamcatcher';
import { guardProtectResolver } from '@/services/night/resolvers/guard';
import { nightmareBlockResolver } from '@/services/night/resolvers/nightmare';
import { slackerChooseIdolResolver } from '@/services/night/resolvers/slacker';
import { wolfKillResolver } from '@/services/night/resolvers/wolf';
import { wolfQueenCharmResolver } from '@/services/night/resolvers/wolfQueen';
import { wolfRobotLearnResolver } from '@/services/night/resolvers/wolfRobot';

function makeContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const players = new Map<number, any>([
    [0, 'wolf'],
    [1, 'villager'],
    [2, 'wolfQueen'],
    [3, 'seer'],
  ]);

  return {
    actorSeat: 0,
    actorRoleId: 'wolf',
    players,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  } as ResolverContext;
}

describe('Night-1-only resolvers contract', () => {
  it('nightmare: can target self (self-block disables wolf kill)', () => {
    const res = nightmareBlockResolver(
      makeContext({
        actorSeat: 0,
        actorRoleId: 'nightmare' as any,
      }),
      { schemaId: 'nightmareBlock' as any, target: 0 },
    );

    expect(res.valid).toBe(true);
  });

  it('nightmare: should accept a normal target (no cross-night constraint exists in Night-1-only)', () => {
    const res = nightmareBlockResolver(
      makeContext({
        actorSeat: 3,
        actorRoleId: 'nightmare' as any,
      }),
      { schemaId: 'nightmareBlock' as any, target: 1 },
    );

    expect(res.valid).toBe(true);
  });

  it('guard: should accept a normal target (no cross-night constraint exists in Night-1-only)', () => {
    const res = guardProtectResolver(
      makeContext({
        actorSeat: 3,
        actorRoleId: 'guard' as any,
      }),
      { schemaId: 'guardProtect' as any, target: 1 },
    );

    expect(res.valid).toBe(true);
  });

  it('dreamcatcher: should accept a normal target (no cross-night constraint exists in Night-1-only)', () => {
    const res = dreamcatcherDreamResolver(
      makeContext({
        actorSeat: 3,
        actorRoleId: 'dreamcatcher' as any,
      }),
      { schemaId: 'dreamcatcherDream' as any, target: 1 },
    );

    expect(res.valid).toBe(true);
  });

  it('dreamcatcher: cannot target self', () => {
    const res = dreamcatcherDreamResolver(
      makeContext({
        actorSeat: 1,
        actorRoleId: 'dreamcatcher' as any,
      }),
      { schemaId: 'dreamcatcherDream' as any, target: 1 },
    );

    expect(res.valid).toBe(false);
  });

  it('wolfQueen: cannot target self', () => {
    const res = wolfQueenCharmResolver(
      makeContext({
        actorSeat: 1,
        actorRoleId: 'wolfQueen' as any,
      }),
      { schemaId: 'wolfQueenCharm' as any, target: 1 },
    );

    expect(res.valid).toBe(false);
  });

  it('wolfRobot: cannot target self', () => {
    const res = wolfRobotLearnResolver(
      makeContext({
        actorSeat: 1,
        actorRoleId: 'wolfRobot' as any,
      }),
      { schemaId: 'wolfRobotLearn' as any, target: 1 },
    );

    expect(res.valid).toBe(false);
  });

  it('slacker: cannot target self', () => {
    const res = slackerChooseIdolResolver(
      makeContext({
        actorSeat: 1,
        actorRoleId: 'slacker' as any,
      }),
      { schemaId: 'slackerChooseIdol' as any, target: 1 },
    );

    expect(res.valid).toBe(false);
  });

  it('wolfKill: can kill anyone including self and wolf teammates (neutral judge)', () => {
    // kill self
    const selfRes = wolfKillResolver(makeContext({ actorSeat: 0, actorRoleId: 'wolf' as any }), {
      schemaId: 'wolfKill' as any,
      target: 0,
    });
    expect(selfRes.valid).toBe(true);

    // kill another wolf teammate (non-immune)
    // (Plan B: immuneToWolfKill targets are rejected by wolfKillResolver)
    const teammateRes = wolfKillResolver(
      makeContext({
        actorSeat: 0,
        actorRoleId: 'wolf' as any,
        players: new Map([
          [0, 'wolf' as any],
          [2, 'wolf' as any], // non-immune teammate
        ]),
      }),
      { schemaId: 'wolfKill' as any, target: 2 },
    );
    expect(teammateRes.valid).toBe(true);
  });
});
