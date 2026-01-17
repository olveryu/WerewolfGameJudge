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
import type { RoleId } from '../../../models/roles';
import type { LocalGameState } from '../../../services/types/GameStateTypes';
import { GameStatus } from '../../../services/GameStateService';
import { NIGHT_STEPS } from '../../../models/roles/spec/nightSteps';

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
  false,            // isHost
  new Map(),        // actions
  NIGHT_STEPS.find(s => s.id === 'seerCheck')?.visibility
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
  false,
  new Map(),
  NIGHT_STEPS.find(s => s.id === 'wolfKill')?.visibility
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
  false,
  new Map(),
  NIGHT_STEPS.find(s => s.id === 'wolfKill')?.visibility
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
  false,
  new Map(),
  undefined
    );

    expect(result.imActioner).toBe(false);
    expect(result.showWolves).toBe(false);
  });

  it('should apply wolf visibility rules (phase-based for nightmare, meeting wolves for pack)', () => {
    // Nightmare fear step: solo, does NOT see wolves
    const nightmareFear = determineActionerState(
      'nightmare',
      'nightmare',
      0,
      new Map(),
      false,
      new Map(),
      NIGHT_STEPS.find(s => s.id === 'nightmareBlock')?.visibility
    );
    expect(nightmareFear.showWolves).toBe(false);

    // WolfRobot/Gargoyle are non-meeting wolves: their own step shouldn't show wolves
    const gargoyleSelfStep = determineActionerState(
      'gargoyle',
      'gargoyle',
      0,
      new Map(),
      false,
      new Map(),
      NIGHT_STEPS.find(s => s.id === 'gargoyleCheck')?.visibility
    );
    expect(gargoyleSelfStep.showWolves).toBe(false);

    const wolfRobotSelfStep = determineActionerState(
      'wolfRobot',
      'wolfRobot',
      0,
      new Map(),
      false,
      new Map(),
      NIGHT_STEPS.find(s => s.id === 'wolfRobotLearn')?.visibility
    );
    expect(wolfRobotSelfStep.showWolves).toBe(false);

    // SpiritKnight is a meeting wolf: should see wolves when it's their turn (if any)
    const spiritKnightSelf = determineActionerState(
      'spiritKnight',
      'spiritKnight',
      0,
      new Map(),
      false,
      new Map(),
      // Visibility is now step-authoritative; if the current schema doesn't define visibility,
      // we default to conservative "don't show wolves".
      undefined
    );
    expect(spiritKnightSelf.showWolves).toBe(false);

    // Wolf turn: participating wolves see pack list
    const nightmareWolfTurn = determineActionerState(
      'nightmare',
      'wolf',
      0,
      new Map(),
      false,
      new Map(),
      NIGHT_STEPS.find(s => s.id === 'wolfKill')?.visibility
    );
    expect(nightmareWolfTurn.showWolves).toBe(true);
    const spiritKnightWolfTurn = determineActionerState(
      'spiritKnight',
      'wolf',
      0,
      new Map(),
      false,
      new Map(),
      NIGHT_STEPS.find(s => s.id === 'wolfKill')?.visibility
    );
    expect(spiritKnightWolfTurn.showWolves).toBe(true);

    // Wolf turn: non-voting wolves do NOT see pack list
    const gargoyleWolfTurn = determineActionerState(
      'gargoyle',
      'wolf',
      0,
      new Map(),
      false,
      new Map(),
      NIGHT_STEPS.find(s => s.id === 'wolfKill')?.visibility
    );
    expect(gargoyleWolfTurn.showWolves).toBe(false);
    const wolfRobotWolfTurn = determineActionerState(
      'wolfRobot',
      'wolf',
      0,
      new Map(),
      false,
      new Map(),
      NIGHT_STEPS.find(s => s.id === 'wolfKill')?.visibility
    );
    expect(wolfRobotWolfTurn.showWolves).toBe(false);
  });

  it('should not show wolves for non-meeting wolves even on their own (non-solo) step', () => {
    // Assert the new rule surface: when a step is explicitly non-solo,
    // only meeting wolves (participating in vote) can see the pack list.
    const nonSoloVisibility = { actsSolo: false };

    const wolfRobot = determineActionerState(
      'wolfRobot',
      'wolfRobot',
      0,
      new Map(),
      false,
      new Map(),
      nonSoloVisibility
    );
    expect(wolfRobot.imActioner).toBe(true);
    expect(wolfRobot.showWolves).toBe(false);

    const gargoyle = determineActionerState(
      'gargoyle',
      'gargoyle',
      0,
      new Map(),
      false,
      new Map(),
      nonSoloVisibility
    );
    expect(gargoyle.imActioner).toBe(true);
    expect(gargoyle.showWolves).toBe(false);
  });

  it('should return imActioner=false when non-wolf role has already submitted action', () => {
    // Seer has already submitted their action
    const actions = new Map<RoleId, unknown>();
    actions.set('seer', { type: 'seerCheck', target: 2 });

    const result = determineActionerState(
      'seer',           // myRole
      'seer',           // currentActionRole
      0,                // mySeatNumber
      new Map(),        // wolfVotes
      false,            // isHost
      actions as Map<RoleId, import('../../../models/actions/RoleAction').RoleAction>
    );

    expect(result.imActioner).toBe(false);
    expect(result.showWolves).toBe(false);
  });

  it('should return imActioner=true when non-wolf role has NOT submitted action', () => {
    // Empty actions = no action submitted yet
    const result = determineActionerState(
      'witch',          // myRole
      'witch',          // currentActionRole
      1,                // mySeatNumber
      new Map(),        // wolfVotes
      false,            // isHost
      new Map()         // actions (empty)
    );

    expect(result.imActioner).toBe(true);
  });
});

// =============================================================================
// getRoleStats
// =============================================================================

describe('getRoleStats', () => {
  it('should correctly count roles in standard 12-player board', () => {
    const roles: RoleId[] = [
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
    const roles: RoleId[] = [
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
        roles: ['villager', 'wolf', 'seer'] as RoleId[],
      },
      players: new Map([
        [0, { uid: 'p1', seatNumber: 0, displayName: 'Player1', role: 'villager' as RoleId, hasViewedRole: true }],
        [1, { uid: 'p2', seatNumber: 1, displayName: 'Player2', role: 'wolf' as RoleId, hasViewedRole: true }],
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

  it('should highlight all wolf-faction roles when showWolves=true', () => {
    const mockState: LocalGameState = {
      roomCode: 'TEST',
      hostUid: 'host1',
      template: {
        name: 'Test',
        numberOfPlayers: 4,
        roles: ['wolf', 'gargoyle', 'wolfRobot', 'seer'] as RoleId[],
      },
      players: new Map([
        [0, { uid: 'p1', seatNumber: 0, displayName: 'Wolf', role: 'wolf' as RoleId, hasViewedRole: true }],
        [1, { uid: 'p2', seatNumber: 1, displayName: 'Gargoyle', role: 'gargoyle' as RoleId, hasViewedRole: true }],
        [2, { uid: 'p3', seatNumber: 2, displayName: 'Robot', role: 'wolfRobot' as RoleId, hasViewedRole: true }],
        [3, { uid: 'p4', seatNumber: 3, displayName: 'Seer', role: 'seer' as RoleId, hasViewedRole: true }],
      ]),
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      status: GameStatus.ongoing,
    };

    const seats = buildSeatViewModels(mockState, null, true, null);

    expect(seats[0].isWolf).toBe(true);
    expect(seats[1].isWolf).toBe(true);
    expect(seats[2].isWolf).toBe(true);
    expect(seats[3].isWolf).toBe(false);
  });

  it('should highlight based on assigned player.role (not template.roles ordering)', () => {
    // This reproduces the "2号是狼人但1号标红" style bug caused by seat/template mismatch.
    const mockState: LocalGameState = {
      roomCode: 'TEST',
      hostUid: 'host1',
      template: {
        name: 'Test',
        numberOfPlayers: 2,
        roles: ['wolf', 'villager'] as RoleId[],
      },
      // Seat 1 is the wolf, but template says seat 0 is wolf.
      players: new Map([
        [0, { uid: 'p1', seatNumber: 0, displayName: 'P1', role: 'villager' as RoleId, hasViewedRole: true }],
        [1, { uid: 'p2', seatNumber: 1, displayName: 'P2', role: 'wolf' as RoleId, hasViewedRole: true }],
      ]),
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      status: GameStatus.ongoing,
    };

    const seats = buildSeatViewModels(mockState, null, true, null);
    expect(seats[0].isWolf).toBe(false);
    expect(seats[1].isWolf).toBe(true);
  });
});
