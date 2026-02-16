/**
 * UPDATE_TEMPLATE reducer tests - Player retention logic
 *
 * 验证更新模板时智能保留/扩缩容座位玩家
 */

import { gameReducer } from '@werewolf/game-engine/engine/reducer/gameReducer';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import type { RoleId } from '@werewolf/game-engine/models/roles';

interface PlayerInput {
  uid: string;
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

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p) {
      playersMap[i] = {
        uid: p.uid,
        seatNumber: i,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        role: p.role ?? null,
        hasViewedRole: false,
      };
    } else {
      playersMap[i] = null;
    }
  }

  // 判断是否全部入座
  const allSeated = players.every((p) => p !== null);

  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: allSeated ? 'seated' : 'unseated',
    templateRoles,
    players: playersMap,
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    ...overrides,
  };
}

describe('UPDATE_TEMPLATE player retention', () => {
  it('should retain all players when template size unchanged', () => {
    const state = createStateWithPlayers([
      { uid: 'u1', displayName: 'Player1' },
      { uid: 'u2', displayName: 'Player2' },
    ]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf', 'villager'] },
    });

    expect(newState.players[0]?.uid).toBe('u1');
    expect(newState.players[0]?.displayName).toBe('Player1');
    expect(newState.players[1]?.uid).toBe('u2');
    expect(newState.players[1]?.displayName).toBe('Player2');
    expect(newState.status).toBe('seated');
  });

  it('should add empty seats when template size increases', () => {
    const state = createStateWithPlayers([
      { uid: 'u1', displayName: 'Player1' },
      { uid: 'u2', displayName: 'Player2' },
    ]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf', 'villager', 'seer'] },
    });

    expect(newState.players[0]?.uid).toBe('u1');
    expect(newState.players[1]?.uid).toBe('u2');
    expect(newState.players[2]).toBeNull();
    expect(newState.status).toBe('unseated'); // 有空座位
  });

  it('should remove trailing players when template size decreases', () => {
    const state = createStateWithPlayers([
      { uid: 'u1', displayName: 'Player1' },
      { uid: 'u2', displayName: 'Player2' },
      { uid: 'u3', displayName: 'Player3' },
    ]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf', 'villager'] },
    });

    expect(Object.keys(newState.players).length).toBe(2);
    expect(newState.players[0]?.uid).toBe('u1');
    expect(newState.players[1]?.uid).toBe('u2');
    expect(newState.players[2]).toBeUndefined(); // 被移除
    expect(newState.status).toBe('seated');
  });

  it('should clear role if player somehow has one (safety fallback)', () => {
    const state = createStateWithPlayers([{ uid: 'u1', displayName: 'Player1', role: 'wolf' }]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['villager'] },
    });

    expect(newState.players[0]?.role).toBeNull();
    expect(newState.players[0]?.hasViewedRole).toBe(false);
  });

  it('should preserve avatarUrl when retaining players', () => {
    const state = createStateWithPlayers([
      { uid: 'u1', displayName: 'Player1', avatarUrl: 'https://example.com/avatar.png' },
    ]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf'] },
    });

    expect(newState.players[0]?.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('should handle partial seating correctly', () => {
    // 原始状态：3 座位，只有 0 和 2 号有人
    const state = createStateWithPlayers([
      { uid: 'u1', displayName: 'Player1' },
      null,
      { uid: 'u3', displayName: 'Player3' },
    ]);

    // 扩容到 4 座
    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf', 'villager', 'seer', 'witch'] },
    });

    expect(newState.players[0]?.uid).toBe('u1');
    expect(newState.players[1]).toBeNull();
    expect(newState.players[2]?.uid).toBe('u3');
    expect(newState.players[3]).toBeNull();
    expect(newState.status).toBe('unseated');
  });

  it('should update templateRoles correctly', () => {
    const state = createStateWithPlayers([
      { uid: 'u1', displayName: 'Player1' },
      { uid: 'u2', displayName: 'Player2' },
    ]);

    const newRoles: RoleId[] = ['wolf', 'seer'];
    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: newRoles },
    });

    expect(newState.templateRoles).toEqual(newRoles);
  });
});
