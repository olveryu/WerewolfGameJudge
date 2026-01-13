/**
 * RoomScreen.helpers.test.ts - Unit tests for pure helper functions
 */

import {
  determineActionerState,
  getRoleStats,
  formatRoleList,
  buildSeatViewModels,
  toGameRoomLike,
} from '../RoomScreen.helpers';
import type { RoleName } from '../../../models/roles';
import type { LocalGameState } from '../../../services/types/GameStateTypes';
import { GameStatus } from '../../../services/GameStateService';

// =============================================================================
// determineActionerState
// =============================================================================

describe('determineActionerState', () => {
  it('should return imActioner=true when my role matches current action role', () => {
    const result = determineActionerState(
      'seer',           // myRole
      'seer',           // currentActionRole
      0,                // mySeatNumber
      new Map(),        // wolfVotes
      false             // isHost
    );

    expect(result.imActioner).toBe(true);
    expect(result.showWolves).toBe(false);
  });

  it('should return imActioner=false when wolf has already voted', () => {
    const wolfVotes = new Map<number, number>();
    wolfVotes.set(1, 0); // seat 1 voted for seat 0

    const result = determineActionerState(
      'wolf',           // myRole
      'wolf',           // currentActionRole
      1,                // mySeatNumber (same as voted seat)
      wolfVotes,
      false
    );

    expect(result.imActioner).toBe(false);
    expect(result.showWolves).toBe(true);
  });

  it('should return showWolves=true for wolf team during wolf turn (not yet voted)', () => {
    const result = determineActionerState(
      'darkWolfKing',   // myRole (a wolf role)
      'wolf',           // currentActionRole
      2,                // mySeatNumber
      new Map(),        // wolfVotes (empty, not voted)
      false
    );

    expect(result.imActioner).toBe(true);
    expect(result.showWolves).toBe(true);
  });

  it('should return imActioner=false when no current action role', () => {
    const result = determineActionerState(
      'seer',
      null,             // no current action
      0,
      new Map(),
      false
    );

    expect(result.imActioner).toBe(false);
    expect(result.showWolves).toBe(false);
  });

  it('should apply wolf visibility rules (phase-based for nightmare, meeting wolves for pack)', () => {
    // Nightmare fear step: solo, does NOT see wolves
    const nightmareFear = determineActionerState('nightmare', 'nightmare', 0, new Map(), false);
    expect(nightmareFear.showWolves).toBe(false);

    // WolfRobot/Gargoyle are non-meeting wolves: their own step shouldn't show wolves
    const gargoyleSelfStep = determineActionerState('gargoyle', 'gargoyle', 0, new Map(), false);
    expect(gargoyleSelfStep.showWolves).toBe(false);

    const wolfRobotSelfStep = determineActionerState('wolfRobot', 'wolfRobot', 0, new Map(), false);
    expect(wolfRobotSelfStep.showWolves).toBe(false);

    // SpiritKnight is a meeting wolf: should see wolves when it's their turn (if any)
    const spiritKnightSelf = determineActionerState('spiritKnight', 'spiritKnight', 0, new Map(), false);
    expect(spiritKnightSelf.showWolves).toBe(true);

    // Wolf turn: participating wolves see pack list
    const nightmareWolfTurn = determineActionerState('nightmare', 'wolf', 0, new Map(), false);
    expect(nightmareWolfTurn.showWolves).toBe(true);
    const spiritKnightWolfTurn = determineActionerState('spiritKnight', 'wolf', 0, new Map(), false);
    expect(spiritKnightWolfTurn.showWolves).toBe(true);

    // Wolf turn: non-voting wolves do NOT see pack list
    const gargoyleWolfTurn = determineActionerState('gargoyle', 'wolf', 0, new Map(), false);
    expect(gargoyleWolfTurn.showWolves).toBe(false);
    const wolfRobotWolfTurn = determineActionerState('wolfRobot', 'wolf', 0, new Map(), false);
    expect(wolfRobotWolfTurn.showWolves).toBe(false);
  });
});

// =============================================================================
// getRoleStats
// =============================================================================

describe('getRoleStats', () => {
  it('should correctly count roles in standard 12-player board', () => {
    const roles: RoleName[] = [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'wolf',
      'seer', 'witch', 'hunter', 'idiot',
    ];

    const stats = getRoleStats(roles);

    expect(stats.villagerCount).toBe(4);
    expect(stats.wolfRoles).toContain('狼人');
    expect(stats.roleCounts['狼人']).toBe(4);
    expect(stats.godRoles).toContain('预言家');
    expect(stats.godRoles).toContain('女巫');
    expect(stats.godRoles).toContain('猎人');
  });

  it('should handle mixed board with special wolves', () => {
    const roles: RoleName[] = [
      'villager', 'villager',
      'wolf', 'wolf', 'darkWolfKing',
      'seer', 'witch', 'guard',
    ];

    const stats = getRoleStats(roles);

    expect(stats.villagerCount).toBe(2);
    expect(stats.wolfRoles).toContain('狼人');
    expect(stats.wolfRoles).toContain('黑狼王');
    expect(stats.godRoles).toContain('守卫');
  });
});

// =============================================================================
// formatRoleList
// =============================================================================

describe('formatRoleList', () => {
  it('should format single roles without count', () => {
    const result = formatRoleList(['预言家', '女巫'], { '预言家': 1, '女巫': 1 });
    expect(result).toBe('预言家、女巫');
  });

  it('should format roles with count when > 1', () => {
    const result = formatRoleList(['狼人', '村民'], { '狼人': 4, '村民': 1 });
    expect(result).toBe('狼人×4、村民');
  });

  it('should return "无" for empty list', () => {
    const result = formatRoleList([], {});
    expect(result).toBe('无');
  });
});

// =============================================================================
// toGameRoomLike
// =============================================================================

describe('toGameRoomLike', () => {
  it('should extract required fields from LocalGameState', () => {
    const mockState: LocalGameState = {
      roomCode: 'TEST',
      hostUid: 'host1',
      template: {
        name: 'Test',
        numberOfPlayers: 6,
        roles: ['villager', 'wolf', 'seer'],
        actionOrder: ['wolf', 'seer'],
      },
      players: new Map(),
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      status: GameStatus.seated,
    };

    const result = toGameRoomLike(mockState);

    expect(result.template).toBe(mockState.template);
    expect(result.players).toBe(mockState.players);
    expect(result.actions).toBe(mockState.actions);
    expect(result.wolfVotes).toBe(mockState.wolfVotes);
    expect(result.currentActionerIndex).toBe(0);
  });
});

// =============================================================================
// buildSeatViewModels
// =============================================================================

describe('buildSeatViewModels', () => {
  it('should build view models from game state', () => {
    const mockState: LocalGameState = {
      roomCode: 'TEST',
      hostUid: 'host1',
      template: {
        name: 'Test',
        numberOfPlayers: 3,
        roles: ['villager', 'wolf', 'seer'] as RoleName[],
        actionOrder: ['wolf', 'seer'],
      },
      players: new Map([
        [0, { uid: 'p1', seatNumber: 0, displayName: 'Player1', role: 'villager' as RoleName, hasViewedRole: true }],
        [1, { uid: 'p2', seatNumber: 1, displayName: 'Player2', role: 'wolf' as RoleName, hasViewedRole: true }],
        [2, null],
      ]),
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      status: GameStatus.ongoing,
    };

    const seats = buildSeatViewModels(mockState, 0, true, 1);

    expect(seats).toHaveLength(3);
    
    // Seat 0: my spot, not wolf
    expect(seats[0].index).toBe(0);
    expect(seats[0].isMySpot).toBe(true);
    expect(seats[0].isWolf).toBe(false);
    expect(seats[0].player?.displayName).toBe('Player1');
    
    // Seat 1: wolf, selected
    expect(seats[1].isWolf).toBe(true);
    expect(seats[1].isSelected).toBe(true);
    
    // Seat 2: empty
    expect(seats[2].player).toBeNull();
  });
});
