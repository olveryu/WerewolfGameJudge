/**
 * playerContext.test - Unit tests for buildPlayerContext
 *
 * Verifies the pure function that maps GameState + seat → GameContext.
 * Ensures only player-visible info is included (no cheating data).
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameState, Player } from '@werewolf/game-engine/protocol/types';

import { buildPlayerContext } from '../playerContext';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'ABCD',
    status: GameStatus.Ongoing,
    phase: 'night',
    currentStep: null,
    players: {},
    templateRoles: [],
    wolfVotes: {},
    lastNightDeaths: [],
    ...overrides,
  } as GameState;
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    seat: 1,
    displayName: 'Player1',
    isAlive: true,
    role: null,
    ...overrides,
  } as Player;
}

describe('buildPlayerContext', () => {
  it('returns inRoom: false when state is null', () => {
    const ctx = buildPlayerContext(null, null);
    expect(ctx).toEqual({ inRoom: false });
  });

  it('returns inRoom: true with basic fields from state', () => {
    const state = makeState({ roomCode: 'XYZ1' });
    const ctx = buildPlayerContext(state, null);

    expect(ctx.inRoom).toBe(true);
    expect(ctx.roomCode).toBe('XYZ1');
    expect(ctx.status).toBe(GameStatus.Ongoing);
    expect(ctx.totalPlayers).toBe(0);
  });

  it('counts non-null players correctly', () => {
    const state = makeState({
      players: {
        0: makePlayer({ seat: 0 }),
        1: makePlayer({ seat: 1 }),
        2: null as unknown as Player,
        3: makePlayer({ seat: 3 }),
      },
    });
    const ctx = buildPlayerContext(state, null);
    expect(ctx.totalPlayers).toBe(3);
  });

  it('includes boardRoleDetails when templateRoles are present', () => {
    const state = makeState({
      templateRoles: ['seer', 'wolf', 'villager'] as RoleId[],
    });
    const ctx = buildPlayerContext(state, null);

    expect(ctx.boardRoleDetails).toBeDefined();
    expect(ctx.boardRoleDetails).toHaveLength(3);
    // seer should resolve to a known displayName
    expect(ctx.boardRoleDetails![0]!.name).toBeTruthy();
    expect(ctx.boardRoleDetails![0]!.description).toBeTruthy();
  });

  it('does not include boardRoleDetails when templateRoles is empty', () => {
    const state = makeState({ templateRoles: [] });
    const ctx = buildPlayerContext(state, null);
    expect(ctx.boardRoleDetails).toBeUndefined();
  });

  it('includes mySeat and myRole when seat is provided and player has a role', () => {
    const state = makeState({
      players: {
        2: makePlayer({ seat: 2, role: 'witch' }),
      },
    });
    const ctx = buildPlayerContext(state, 2);

    expect(ctx.mySeat).toBe(2);
    expect(ctx.myRole).toBe('witch');
    expect(ctx.myRoleName).toBeTruthy();
  });

  it('includes mySeat but not myRole when player has no role assigned', () => {
    const state = makeState({
      players: {
        1: makePlayer({ seat: 1, role: null }),
      },
    });
    const ctx = buildPlayerContext(state, 1);

    expect(ctx.mySeat).toBe(1);
    expect(ctx.myRole).toBeUndefined();
    expect(ctx.myRoleName).toBeUndefined();
  });

  it('handles mySeat=0 correctly (falsy but valid)', () => {
    const state = makeState({
      players: {
        0: makePlayer({ seat: 0, role: 'guard' }),
      },
    });
    const ctx = buildPlayerContext(state, 0);

    expect(ctx.mySeat).toBe(0);
    expect(ctx.myRole).toBe('guard');
  });

  it('does not leak other players roles', () => {
    const state = makeState({
      players: {
        0: makePlayer({ seat: 0, role: 'seer' }),
        1: makePlayer({ seat: 1, role: 'wolf' }),
      },
    });
    // Player at seat 0 — should only see own role
    const ctx = buildPlayerContext(state, 0);
    const serialized = JSON.stringify(ctx);

    expect(ctx.myRole).toBe('seer');
    // The context should not contain seat 1's role 'wolf' anywhere
    // (it's OK if 'wolf' appears in boardRoleDetails via templateRoles, but not as another player's assigned role)
    expect(serialized).not.toContain('"role":"wolf"');
  });
});
