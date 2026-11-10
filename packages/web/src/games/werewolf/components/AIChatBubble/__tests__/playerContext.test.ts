/**
 * playerContext.test - Unit tests for buildPlayerContext
 *
 * Verifies the pure function that maps GameState + the viewer's view model → GameContext.
 * Ensures only player-visible info is included (no cheating data).
 */

import type { GameState, Player } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus, getWerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';

import { buildWerewolfTestState } from '@/test-utils/werewolfState';

import { buildPlayerContext } from '../playerContext';

/**
 * buildPlayerContext reads the viewer's seat/role from the view model. The partial fixture
 * states complete the roster/profiles the projection requires and project for real.
 */
function viewModelFor(state: GameState, viewerSeat: number | null) {
  const roster: Record<number, { seat: number; userId: string; profile: { displayName: string } }> =
    {};
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (!player) continue;
    const seat = Number(seatKey);
    roster[seat] = { seat, userId: `user-${seat}`, profile: { displayName: '玩家' } };
  }
  return getWerewolfViewModel({ ...state, roster }, { seat: viewerSeat, isHost: false });
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return buildWerewolfTestState({ status: GameStatus.Ongoing, ...overrides });
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return { seat: 1, role: null, ...overrides };
}

describe('buildPlayerContext', () => {
  it('returns inRoom: false when state is null', () => {
    expect(buildPlayerContext(null, null)).toEqual({ inRoom: false });
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
        2: null,
        3: makePlayer({ seat: 3 }),
      },
    });
    expect(buildPlayerContext(state, null).totalPlayers).toBe(3);
  });

  it('includes boardRoleDetails when templateRoles are present', () => {
    const state = makeState({ templateRoles: ['seer', 'wolf', 'villager'] });
    const ctx = buildPlayerContext(state, null);

    expect(ctx.boardRoleDetails).toHaveLength(3);
    expect(ctx.boardRoleDetails![0]!.name).toBeTruthy();
    expect(ctx.boardRoleDetails![0]!.description).toBeTruthy();
  });

  it('does not include boardRoleDetails when templateRoles is empty', () => {
    const ctx = buildPlayerContext(makeState({ templateRoles: [] }), null);
    expect(ctx.boardRoleDetails).toBeUndefined();
  });

  it('includes mySeat and myRole when seat is provided and player has a role', () => {
    const state = makeState({ players: { 2: makePlayer({ seat: 2, role: 'witch' }) } });
    const ctx = buildPlayerContext(state, viewModelFor(state, 2));

    expect(ctx.mySeat).toBe(2);
    expect(ctx.myRole).toBe('witch');
    expect(ctx.myRoleName).toBeTruthy();
  });

  it('includes mySeat but not myRole when player has no role assigned', () => {
    const state = makeState({ players: { 1: makePlayer({ seat: 1, role: null }) } });
    const ctx = buildPlayerContext(state, viewModelFor(state, 1));

    expect(ctx.mySeat).toBe(1);
    expect(ctx.myRole).toBeUndefined();
    expect(ctx.myRoleName).toBeUndefined();
  });

  it('handles mySeat=0 correctly (falsy but valid)', () => {
    const state = makeState({ players: { 0: makePlayer({ seat: 0, role: 'guard' }) } });
    const ctx = buildPlayerContext(state, viewModelFor(state, 0));

    expect(ctx.mySeat).toBe(0);
    expect(ctx.myRole).toBe('guard');
  });

  it('mySeat without a seated player yields no role', () => {
    const state = makeState({ players: {} });
    const ctx = buildPlayerContext(state, viewModelFor(state, 5));

    expect(ctx.mySeat).toBe(5);
    expect(ctx.myRole).toBeUndefined();
    expect(ctx.myRoleName).toBeUndefined();
  });

  it('does not leak other players roles', () => {
    const state = makeState({
      players: {
        0: makePlayer({ seat: 0, role: 'seer' }),
        1: makePlayer({ seat: 1, role: 'wolf' }),
      },
    });
    const ctx = buildPlayerContext(state, viewModelFor(state, 0));

    expect(ctx.myRole).toBe('seer');
    // 'wolf' may appear in boardRoleDetails via templateRoles, never as another seat's role.
    expect(JSON.stringify(ctx)).not.toContain('"role":"wolf"');
  });
});
