/**
 * UPDATE_TEMPLATE reducer tests - Player retention logic
 *
 * Verifies that seat players are intelligently retained / scaled up or down when the template is updated.
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import type { WerewolfHumanSeat } from '@game-judge/game-engine/games/werewolf/domain/protocol/types';
import { gameReducer } from '@game-judge/game-engine/games/werewolf/domain/reducer/gameReducer';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/state/version';
import type { RosterEntry } from '@game-judge/game-engine/platform/room/roster';

interface PlayerInput {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role?: RoleId | null;
}

function createStateWithPlayers(
  players: (PlayerInput | null)[],
  overrides?: Partial<GameState>,
): GameState {
  const templateRoles: RoleId[] = players.map(() => 'villager'); // placeholder
  const playersMap: GameState['players'] = {};
  const roster: Record<number, WerewolfHumanSeat> = {};
  const playerProfiles: Record<string, RosterEntry> = {};

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p) {
      playersMap[i] = {
        seat: i,
        role: p.role ?? null,
        hasViewedRole: false,
      };
      roster[i] = { seat: i, userId: p.userId };
      playerProfiles[p.userId] = {
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
      };
    } else {
      playersMap[i] = null;
    }
  }

  // Determine whether all seats are filled
  const allSeated = players.every((p) => p !== null);

  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: allSeated ? GameStatus.Seated : GameStatus.Unseated,
    templateRoles,
    players: playersMap,
    roster,
    playerProfiles,
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    ...overrides,
  };
}

describe('UPDATE_TEMPLATE player retention', () => {
  it('should retain all players when template size unchanged', () => {
    const state = createStateWithPlayers([
      { userId: 'u1', displayName: 'Player1' },
      { userId: 'u2', displayName: 'Player2' },
    ]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf', 'villager'] },
    });

    expect(newState.roster[0]).toEqual({ seat: 0, userId: 'u1' });
    expect(newState.playerProfiles['u1']?.displayName).toBe('Player1');
    expect(newState.roster[1]).toEqual({ seat: 1, userId: 'u2' });
    expect(newState.playerProfiles['u2']?.displayName).toBe('Player2');
    expect(newState.status).toBe(GameStatus.Seated);
  });

  it('should add empty seats when template size increases', () => {
    const state = createStateWithPlayers([
      { userId: 'u1', displayName: 'Player1' },
      { userId: 'u2', displayName: 'Player2' },
    ]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf', 'villager', 'seer'] },
    });

    expect(newState.roster[0]).toEqual({ seat: 0, userId: 'u1' });
    expect(newState.roster[1]).toEqual({ seat: 1, userId: 'u2' });
    expect(newState.players[2]).toBeNull();
    expect(newState.status).toBe(GameStatus.Unseated); // has empty seats
  });

  it('should remove trailing players when template size decreases', () => {
    const state = createStateWithPlayers([
      { userId: 'u1', displayName: 'Player1' },
      { userId: 'u2', displayName: 'Player2' },
      { userId: 'u3', displayName: 'Player3' },
    ]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf', 'villager'] },
    });

    expect(Object.keys(newState.players).length).toBe(2);
    expect(newState.roster[0]).toEqual({ seat: 0, userId: 'u1' });
    expect(newState.roster[1]).toEqual({ seat: 1, userId: 'u2' });
    expect(newState.players[2]).toBeUndefined(); // removed
    // Occupancy must be cut together with the players map, otherwise the
    // stranded occupant makes every later actor resolution throw.
    expect(newState.roster[2]).toBeUndefined();
    expect(newState.status).toBe(GameStatus.Seated);
  });

  it('should fail fast if an assigned player reaches template resizing', () => {
    const state = createStateWithPlayers([{ userId: 'u1', displayName: 'Player1', role: 'wolf' }]);

    expect(() =>
      gameReducer(state, {
        type: 'UPDATE_TEMPLATE',
        payload: { templateRoles: ['villager'] },
      }),
    ).toThrow('[FAIL-FAST] UPDATE_TEMPLATE cannot resize assigned player at seat 0');
  });

  it('should preserve avatarUrl when retaining players', () => {
    const state = createStateWithPlayers([
      { userId: 'u1', displayName: 'Player1', avatarUrl: 'https://example.com/avatar.png' },
    ]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf'] },
    });

    expect(newState.playerProfiles['u1']?.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('should handle partial seating correctly', () => {
    // Initial state: 3 seats, only seats 0 and 2 are occupied
    const state = createStateWithPlayers([
      { userId: 'u1', displayName: 'Player1' },
      null,
      { userId: 'u3', displayName: 'Player3' },
    ]);

    // Scale up to 4 seats
    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf', 'villager', 'seer', 'witch'] },
    });

    expect(newState.roster[0]).toEqual({ seat: 0, userId: 'u1' });
    expect(newState.players[1]).toBeNull();
    expect(newState.roster[2]).toEqual({ seat: 2, userId: 'u3' });
    expect(newState.players[3]).toBeNull();
    expect(newState.status).toBe(GameStatus.Unseated);
  });

  it('should update templateRoles correctly', () => {
    const state = createStateWithPlayers([
      { userId: 'u1', displayName: 'Player1' },
      { userId: 'u2', displayName: 'Player2' },
    ]);

    const newRoles: RoleId[] = ['wolf', 'seer'];
    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: newRoles },
    });

    expect(newState.templateRoles).toEqual(newRoles);
  });
});
