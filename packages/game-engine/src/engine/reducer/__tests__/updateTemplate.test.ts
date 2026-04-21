/**
 * UPDATE_TEMPLATE reducer tests - Player retention logic
 *
 * 验证更新模板时智能保留/扩缩容座位玩家
 */

import { gameReducer } from '@werewolf/game-engine/engine/reducer/gameReducer';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { RosterEntry } from '@werewolf/game-engine/protocol/types';

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
  const roster: Record<string, RosterEntry> = {};

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p) {
      playersMap[i] = {
        userId: p.userId,
        seat: i,
        role: p.role ?? null,
        hasViewedRole: false,
      };
      roster[p.userId] = {
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
      };
    } else {
      playersMap[i] = null;
    }
  }

  // 判断是否全部入座
  const allSeated = players.every((p) => p !== null);

  return {
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: allSeated ? GameStatus.Seated : GameStatus.Unseated,
    templateRoles,
    players: playersMap,
    roster,
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
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

    expect(newState.players[0]?.userId).toBe('u1');
    expect(newState.roster['u1']?.displayName).toBe('Player1');
    expect(newState.players[1]?.userId).toBe('u2');
    expect(newState.roster['u2']?.displayName).toBe('Player2');
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

    expect(newState.players[0]?.userId).toBe('u1');
    expect(newState.players[1]?.userId).toBe('u2');
    expect(newState.players[2]).toBeNull();
    expect(newState.status).toBe(GameStatus.Unseated); // 有空座位
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
    expect(newState.players[0]?.userId).toBe('u1');
    expect(newState.players[1]?.userId).toBe('u2');
    expect(newState.players[2]).toBeUndefined(); // 被移除
    expect(newState.status).toBe(GameStatus.Seated);
  });

  it('should clear role if player somehow has one (safety fallback)', () => {
    const state = createStateWithPlayers([{ userId: 'u1', displayName: 'Player1', role: 'wolf' }]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['villager'] },
    });

    expect(newState.players[0]?.role).toBeNull();
    expect(newState.players[0]?.hasViewedRole).toBe(false);
  });

  it('should preserve avatarUrl when retaining players', () => {
    const state = createStateWithPlayers([
      { userId: 'u1', displayName: 'Player1', avatarUrl: 'https://example.com/avatar.png' },
    ]);

    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf'] },
    });

    expect(newState.roster['u1']?.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('should handle partial seating correctly', () => {
    // 原始状态：3 座位，只有 0 和 2 号有人
    const state = createStateWithPlayers([
      { userId: 'u1', displayName: 'Player1' },
      null,
      { userId: 'u3', displayName: 'Player3' },
    ]);

    // 扩容到 4 座
    const newState = gameReducer(state, {
      type: 'UPDATE_TEMPLATE',
      payload: { templateRoles: ['wolf', 'villager', 'seer', 'witch'] },
    });

    expect(newState.players[0]?.userId).toBe('u1');
    expect(newState.players[1]).toBeNull();
    expect(newState.players[2]?.userId).toBe('u3');
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
