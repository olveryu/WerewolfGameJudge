/**
 * RoomScreen.helpers.test.ts - Unit tests for pure helper functions
 */

import {
  determineActionerState,
  getRoleStats,
  formatRoleList,
  buildSeatViewModels,
  toGameRoomLike,
} from '@/screens/RoomScreen/RoomScreen.helpers';
import type { RoleId } from '@/models/roles';
import type { LocalGameState } from '@/types/GameStateTypes';
import { GameStatus } from '@/models/GameStatus';
import { SCHEMAS } from '@/models/roles/spec/schemas';

// =============================================================================
// determineActionerState
// =============================================================================

describe('determineActionerState', () => {
  // Helper to get wolfKill schema (has meeting config)
  const wolfKillSchema = SCHEMAS.wolfKill;
  // Helper to get a non-wolfVote schema
  const seerCheckSchema = SCHEMAS.seerCheck;
  const _nightmareBlockSchema = SCHEMAS.nightmareBlock;

  it('should return imActioner=true when my role matches current action role', () => {
    const result = determineActionerState(
      'seer', // myRole
      'seer', // currentActionRole
      seerCheckSchema, // currentSchema
      0, // mySeatNumber
      new Map(), // wolfVotes
      false, // isHost
      new Map(), // actions
    );

    expect(result.imActioner).toBe(true);
    expect(result.showWolves).toBe(false);
  });

  it('should return imActioner=true when wolf has already voted (revote allowed)', () => {
    const wolfVotes = new Map<number, number>();
    wolfVotes.set(1, 0); // seat 1 voted for seat 0

    const result = determineActionerState(
      'wolf', // myRole
      'wolf', // currentActionRole
      wolfKillSchema, // currentSchema
      1, // mySeatNumber (same as voted seat)
      wolfVotes,
      false,
      new Map(),
    );

    expect(result.imActioner).toBe(true);
    expect(result.showWolves).toBe(true); // Still sees wolves during wolf meeting
  });

  it('should return showWolves=true for wolf team during wolf turn (not yet voted)', () => {
    const wolfVotes = new Map<number, number>();

    const result = determineActionerState(
      'darkWolfKing', // myRole (a wolf role that participates in vote)
      'wolf', // currentActionRole
      wolfKillSchema, // currentSchema
      2, // mySeatNumber
      wolfVotes,
      false,
      new Map(),
    );

    expect(result.showWolves).toBe(true);
    expect(result.imActioner).toBe(true);
  });

  describe('wolfKill meeting visibility & participation (contract)', () => {
    it('should NOT show wolves for lone wolves (gargoyle) during wolfKill', () => {
      const result = determineActionerState(
        'gargoyle',
        'wolf',
        wolfKillSchema,
        3,
        new Map(),
        false,
        new Map(),
      );

      expect(result.showWolves).toBe(false);
      expect(result.imActioner).toBe(false);
    });

    it('should NOT show wolves for lone wolves (wolfRobot) during wolfKill', () => {
      const result = determineActionerState(
        'wolfRobot',
        'wolf',
        wolfKillSchema,
        3,
        new Map(),
        false,
        new Map(),
      );

      expect(result.showWolves).toBe(false);
      expect(result.imActioner).toBe(false);
    });

    it('should show wolves for participating wolf roles during wolfKill (nightmare/wolfQueen/spiritKnight)', () => {
      for (const role of ['nightmare', 'wolfQueen', 'spiritKnight'] as const) {
        const result = determineActionerState(
          role,
          'wolf',
          wolfKillSchema,
          2,
          new Map(),
          false,
          new Map(),
        );

        expect(result.showWolves).toBe(true);
        expect(result.imActioner).toBe(true);
      }
    });

    it('should set imActioner=true for participating wolf roles that already voted (revote allowed)', () => {
      const wolfVotes = new Map<number, number>();
      wolfVotes.set(7, 0);

      for (const role of [
        'wolf',
        'nightmare',
        'wolfQueen',
        'darkWolfKing',
        'spiritKnight',
      ] as const) {
        const result = determineActionerState(
          role,
          // In practice wolfKill is a meeting step, currentActionRole can be any wolf-team role.
          role,
          wolfKillSchema,
          7,
          wolfVotes,
          false,
          new Map(),
        );

        // Revote allowed: imActioner stays true even after voting
        expect(result.imActioner).toBe(true);
      }
    });
  });

  it('should handle mixed board with special wolves', () => {
    const roles: RoleId[] = [
      'villager',
      'villager',
      'wolf',
      'wolf',
      'darkWolfKing',
      'seer',
      'witch',
      'guard',
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
    const result = formatRoleList(['预言家', '女巫'], { 预言家: 1, 女巫: 1 });
    expect(result).toBe('预言家、女巫');
  });

  it('should format roles with count when > 1', () => {
    const result = formatRoleList(['狼人', '村民'], { 狼人: 4, 村民: 1 });
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
      currentStepIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      currentNightResults: {},
      status: GameStatus.seated,
    };

    const result = toGameRoomLike(mockState);

    expect(result.template).toBe(mockState.template);
    expect(result.players).toBe(mockState.players);
    expect(result.actions).toBe(mockState.actions);
    expect(result.wolfVotes).toBe(mockState.wolfVotes);
    expect(result.currentStepIndex).toBe(0);
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
        [
          0,
          {
            uid: 'p1',
            seatNumber: 0,
            displayName: 'Player1',
            role: 'villager' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          1,
          {
            uid: 'p2',
            seatNumber: 1,
            displayName: 'Player2',
            role: 'wolf' as RoleId,
            hasViewedRole: true,
          },
        ],
        [2, null],
      ]),
      actions: new Map(),
      wolfVotes: new Map(),
      currentStepIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      currentNightResults: {},
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

  it('should highlight only visible wolves when showWolves=true (gargoyle/wolfRobot hidden)', () => {
    const mockState: LocalGameState = {
      roomCode: 'TEST',
      hostUid: 'host1',
      template: {
        name: 'Test',
        numberOfPlayers: 4,
        roles: ['wolf', 'gargoyle', 'wolfRobot', 'seer'] as RoleId[],
      },
      players: new Map([
        [
          0,
          {
            uid: 'p1',
            seatNumber: 0,
            displayName: 'Wolf',
            role: 'wolf' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          1,
          {
            uid: 'p2',
            seatNumber: 1,
            displayName: 'Gargoyle',
            role: 'gargoyle' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          2,
          {
            uid: 'p3',
            seatNumber: 2,
            displayName: 'Robot',
            role: 'wolfRobot' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          3,
          {
            uid: 'p4',
            seatNumber: 3,
            displayName: 'Seer',
            role: 'seer' as RoleId,
            hasViewedRole: true,
          },
        ],
      ]),
      actions: new Map(),
      wolfVotes: new Map(),
      currentStepIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      currentNightResults: {},
      status: GameStatus.ongoing,
    };

    const seats = buildSeatViewModels(mockState, null, true, null);

    // Only wolf with canSeeWolves=true is highlighted
    expect(seats[0].isWolf).toBe(true);
    // gargoyle and wolfRobot have canSeeWolves=false, so they are NOT highlighted
    expect(seats[1].isWolf).toBe(false);
    expect(seats[2].isWolf).toBe(false);
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
        [
          0,
          {
            uid: 'p1',
            seatNumber: 0,
            displayName: 'P1',
            role: 'villager' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          1,
          {
            uid: 'p2',
            seatNumber: 1,
            displayName: 'P2',
            role: 'wolf' as RoleId,
            hasViewedRole: true,
          },
        ],
      ]),
      actions: new Map(),
      wolfVotes: new Map(),
      currentStepIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      currentNightResults: {},
      status: GameStatus.ongoing,
    };

    const seats = buildSeatViewModels(mockState, null, true, null);
    expect(seats[0].isWolf).toBe(false);
    expect(seats[1].isWolf).toBe(true);
  });

  describe('schemaConstraints option (UX early rejection)', () => {
    it('notSelf constraint disables own seat with reason', () => {
      const mockState: LocalGameState = {
        roomCode: 'TEST',
        hostUid: 'host1',
        template: {
          name: 'Test',
          numberOfPlayers: 3,
          roles: ['seer', 'villager', 'wolf'] as RoleId[],
        },
        players: new Map([
          [
            0,
            {
              uid: 'p1',
              seatNumber: 0,
              displayName: 'Seer',
              role: 'seer' as RoleId,
              hasViewedRole: true,
            },
          ],
          [
            1,
            {
              uid: 'p2',
              seatNumber: 1,
              displayName: 'P2',
              role: 'villager' as RoleId,
              hasViewedRole: true,
            },
          ],
          [
            2,
            {
              uid: 'p3',
              seatNumber: 2,
              displayName: 'P3',
              role: 'wolf' as RoleId,
              hasViewedRole: true,
            },
          ],
        ]),
        actions: new Map(),
        wolfVotes: new Map(),
        currentStepIndex: 0,
        isAudioPlaying: false,
        lastNightDeaths: [],
        currentNightResults: {},
        status: GameStatus.ongoing,
      };

      // I am seat 0, with notSelf constraint
      const seats = buildSeatViewModels(mockState, 0, false, null, {
        schemaConstraints: ['notSelf'],
      });

      // My seat should be disabled
      expect(seats[0].disabledReason).toBe('不能选择自己');
      // Other seats should not be disabled
      expect(seats[1].disabledReason).toBeUndefined();
      expect(seats[2].disabledReason).toBeUndefined();
    });

    it('no constraint means own seat is selectable', () => {
      const mockState: LocalGameState = {
        roomCode: 'TEST',
        hostUid: 'host1',
        template: {
          name: 'Test',
          numberOfPlayers: 3,
          roles: ['seer', 'villager', 'wolf'] as RoleId[],
        },
        players: new Map([
          [
            0,
            {
              uid: 'p1',
              seatNumber: 0,
              displayName: 'Seer',
              role: 'seer' as RoleId,
              hasViewedRole: true,
            },
          ],
          [
            1,
            {
              uid: 'p2',
              seatNumber: 1,
              displayName: 'P2',
              role: 'villager' as RoleId,
              hasViewedRole: true,
            },
          ],
          [
            2,
            {
              uid: 'p3',
              seatNumber: 2,
              displayName: 'P3',
              role: 'wolf' as RoleId,
              hasViewedRole: true,
            },
          ],
        ]),
        actions: new Map(),
        wolfVotes: new Map(),
        currentStepIndex: 0,
        isAudioPlaying: false,
        lastNightDeaths: [],
        currentNightResults: {},
        status: GameStatus.ongoing,
      };

      // I am seat 0, with NO constraints
      const seats = buildSeatViewModels(mockState, 0, false, null, {
        schemaConstraints: [],
      });

      // All seats should be selectable
      expect(seats[0].disabledReason).toBeUndefined();
      expect(seats[1].disabledReason).toBeUndefined();
      expect(seats[2].disabledReason).toBeUndefined();
    });
  });

  describe('wolfVoteTarget badge', () => {
    const createWolfVoteState = (
      wolfVotesBySeat: Record<string, number> | undefined,
    ): LocalGameState => ({
      roomCode: 'TEST',
      hostUid: 'host1',
      template: {
        name: 'Test',
        numberOfPlayers: 3,
        roles: ['wolf', 'villager', 'seer'] as RoleId[],
      },
      players: new Map([
        [
          0,
          {
            uid: 'p1',
            seatNumber: 0,
            displayName: 'Wolf',
            role: 'wolf' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          1,
          {
            uid: 'p2',
            seatNumber: 1,
            displayName: 'Villager',
            role: 'villager' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          2,
          {
            uid: 'p3',
            seatNumber: 2,
            displayName: 'Seer',
            role: 'seer' as RoleId,
            hasViewedRole: true,
          },
        ],
      ]),
      actions: new Map(),
      wolfVotes: new Map(),
      currentStepIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      currentNightResults: { wolfVotesBySeat },
      status: GameStatus.ongoing,
    });

    it('should populate wolfVoteTarget when showWolves=true and wolf has voted', () => {
      const state = createWolfVoteState({ '0': 2 }); // seat 0 voted for seat 2
      const seats = buildSeatViewModels(state, 0, true, null);

      // Wolf seat 0 should show vote target
      expect(seats[0].wolfVoteTarget).toBe(2);
      // Non-wolf seats should not have wolfVoteTarget
      expect(seats[1].wolfVoteTarget).toBeUndefined();
      expect(seats[2].wolfVoteTarget).toBeUndefined();
    });

    it('should NOT populate wolfVoteTarget when showWolves=false', () => {
      const state = createWolfVoteState({ '0': 2 });
      const seats = buildSeatViewModels(state, 0, false, null);

      // Even though wolf voted, showWolves=false hides it
      expect(seats[0].wolfVoteTarget).toBeUndefined();
    });

    it('should show wolfVoteTarget=-1 for empty knife vote', () => {
      const state = createWolfVoteState({ '0': -1 }); // seat 0 voted empty knife
      const seats = buildSeatViewModels(state, 0, true, null);

      expect(seats[0].wolfVoteTarget).toBe(-1);
    });

    it('wolfVoteTarget and showReadyBadge should be mutually exclusive', () => {
      const state = createWolfVoteState({ '0': 2 });
      const seats = buildSeatViewModels(state, 0, true, null);

      // Wolf seat 0 has wolfVoteTarget → showReadyBadge must be false
      expect(seats[0].wolfVoteTarget).toBe(2);
      expect(seats[0].showReadyBadge).toBe(false);
    });
  });
});
