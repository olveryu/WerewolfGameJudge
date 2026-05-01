/**
 * Night-1-only Resolver Contract Tests
 *
 * This app is Night-1 only: resolvers must not enforce cross-night constraints.
 */

import type { RoleId } from '../../models/roles';
import { RESOLVERS } from '../index';
import type { ResolverContext } from '../types';
import { wolfKillResolver } from '../wolf';

const dreamcatcherDreamResolver = RESOLVERS.dreamcatcherDream!;
const guardProtectResolver = RESOLVERS.guardProtect!;
const nightmareBlockResolver = RESOLVERS.nightmareBlock!;
const slackerChooseIdolResolver = RESOLVERS.slackerChooseIdol!;
const wolfQueenCharmResolver = RESOLVERS.wolfQueenCharm!;
const wolfRobotLearnResolver = RESOLVERS.wolfRobotLearn!;

function makeContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const players: ReadonlyMap<number, RoleId> = new Map<number, RoleId>([
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
        actorRoleId: 'nightmare',
      }),
      { schemaId: 'nightmareBlock', target: 0 },
    );

    expect(res.valid).toBe(true);
  });

  it('nightmare: should accept a normal target (no cross-night constraint exists in Night-1-only)', () => {
    const res = nightmareBlockResolver(
      makeContext({
        actorSeat: 3,
        actorRoleId: 'nightmare',
      }),
      { schemaId: 'nightmareBlock', target: 1 },
    );

    expect(res.valid).toBe(true);
  });

  it('guard: should accept a normal target (no cross-night constraint exists in Night-1-only)', () => {
    const res = guardProtectResolver(
      makeContext({
        actorSeat: 3,
        actorRoleId: 'guard',
      }),
      { schemaId: 'guardProtect', target: 1 },
    );

    expect(res.valid).toBe(true);
  });

  it('dreamcatcher: should accept a normal target (no cross-night constraint exists in Night-1-only)', () => {
    const res = dreamcatcherDreamResolver(
      makeContext({
        actorSeat: 3,
        actorRoleId: 'dreamcatcher',
      }),
      { schemaId: 'dreamcatcherDream', target: 1 },
    );

    expect(res.valid).toBe(true);
  });

  it('dreamcatcher: cannot target self', () => {
    const res = dreamcatcherDreamResolver(
      makeContext({
        actorSeat: 1,
        actorRoleId: 'dreamcatcher',
      }),
      { schemaId: 'dreamcatcherDream', target: 1 },
    );

    expect(res.valid).toBe(false);
  });

  it('wolfQueen: cannot target self', () => {
    const res = wolfQueenCharmResolver(
      makeContext({
        actorSeat: 1,
        actorRoleId: 'wolfQueen',
      }),
      { schemaId: 'wolfQueenCharm', target: 1 },
    );

    expect(res.valid).toBe(false);
  });

  it('wolfRobot: cannot target self', () => {
    const res = wolfRobotLearnResolver(
      makeContext({
        actorSeat: 1,
        actorRoleId: 'wolfRobot',
      }),
      { schemaId: 'wolfRobotLearn', target: 1 },
    );

    expect(res.valid).toBe(false);
  });

  it('slacker: cannot target self', () => {
    const res = slackerChooseIdolResolver(
      makeContext({
        actorSeat: 1,
        actorRoleId: 'slacker',
      }),
      { schemaId: 'slackerChooseIdol', target: 1 },
    );

    expect(res.valid).toBe(false);
  });

  it('wolfKill: can kill anyone including self and wolf teammates (neutral judge)', () => {
    // kill self
    const selfRes = wolfKillResolver(makeContext({ actorSeat: 0, actorRoleId: 'wolf' }), {
      schemaId: 'wolfKill',
      target: 0,
    });
    expect(selfRes.valid).toBe(true);

    // kill another wolf teammate (non-immune)
    // (Plan B: immuneToWolfKill targets are rejected by wolfKillResolver)
    const teammateRes = wolfKillResolver(
      makeContext({
        actorSeat: 0,
        actorRoleId: 'wolf',
        players: new Map([
          [0, 'wolf'],
          [2, 'wolf'], // non-immune teammate
        ]),
      }),
      { schemaId: 'wolfKill', target: 2 },
    );
    expect(teammateRes.valid).toBe(true);
  });
});
