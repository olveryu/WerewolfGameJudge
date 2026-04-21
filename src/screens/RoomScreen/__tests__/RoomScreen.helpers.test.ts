/**
 * RoomScreen.helpers.test.ts - Unit tests for pure helper functions
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { TargetConstraint } from '@werewolf/game-engine/models/roles/spec/schema.types';
import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';

import {
  buildSeatViewModels,
  determineActionerState,
  getRoleStats,
  getWolfVoteSummary,
  toGameRoomLike,
} from '@/screens/RoomScreen/RoomScreen.helpers';
import type { LocalGameState } from '@/types/GameStateTypes';

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
      0, // mySeat
      new Map(), // wolfVotes
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
      1, // mySeat (same as voted seat)
      wolfVotes,
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
      2, // mySeat
      wolfVotes,
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
          new Map(),
        );

        // Revote allowed: imActioner stays true even after voting
        expect(result.imActioner).toBe(true);
      }
    });
  });

  describe('treasureMaster actor override (chosenCard)', () => {
    const psychicCheckSchema = SCHEMAS.psychicCheck;

    it('should set imActioner=true when treasureMaster chose the current action role', () => {
      const result = determineActionerState(
        'treasureMaster',
        'psychic', // currentActionRole (chosen card's role step)
        psychicCheckSchema,
        2,
        new Map(),
        new Map(),
        'psychic', // treasureMasterChosenCard
      );

      expect(result.imActioner).toBe(true);
      expect(result.showWolves).toBe(false);
    });

    it('should NOT set imActioner when treasureMaster chose a different role', () => {
      const result = determineActionerState(
        'treasureMaster',
        'psychic',
        psychicCheckSchema,
        2,
        new Map(),
        new Map(),
        'seer', // chose seer, not psychic
      );

      expect(result.imActioner).toBe(false);
    });

    it('should NOT set imActioner when treasureMasterChosenCard is not provided', () => {
      const result = determineActionerState(
        'treasureMaster',
        'psychic',
        psychicCheckSchema,
        2,
        new Map(),
        new Map(),
      );

      expect(result.imActioner).toBe(false);
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
    expect(stats.wolfRoles).toContain('狼王');
    expect(stats.godRoles).toContain('守卫');
  });
});

// =============================================================================
// toGameRoomLike
// =============================================================================

describe('toGameRoomLike', () => {
  it('should extract required fields from LocalGameState', () => {
    const mockState: LocalGameState = {
      roomCode: 'TEST',
      hostUserId: 'host1',
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
      pendingRevealAcks: [],
      hypnotizedSeats: [],
      piperRevealAcks: [],
      conversionRevealAcks: [],
      cupidLoversRevealAcks: [],
      status: GameStatus.Seated,
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
      hostUserId: 'host1',
      template: {
        name: 'Test',
        numberOfPlayers: 3,
        roles: ['villager', 'wolf', 'seer'] as RoleId[],
      },
      players: new Map([
        [
          0,
          {
            userId: 'p1',
            seat: 0,
            displayName: 'Player1',
            role: 'villager' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          1,
          {
            userId: 'p2',
            seat: 1,
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
      pendingRevealAcks: [],
      hypnotizedSeats: [],
      piperRevealAcks: [],
      conversionRevealAcks: [],
      cupidLoversRevealAcks: [],
      status: GameStatus.Ongoing,
    };

    const seats = buildSeatViewModels(mockState, 0, true, 1);

    expect(seats).toHaveLength(3);

    // Seat 0: my spot, not wolf
    expect(seats[0].seat).toBe(0);
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
      hostUserId: 'host1',
      template: {
        name: 'Test',
        numberOfPlayers: 4,
        roles: ['wolf', 'gargoyle', 'wolfRobot', 'seer'] as RoleId[],
      },
      players: new Map([
        [
          0,
          {
            userId: 'p1',
            seat: 0,
            displayName: 'Wolf',
            role: 'wolf' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          1,
          {
            userId: 'p2',
            seat: 1,
            displayName: 'Gargoyle',
            role: 'gargoyle' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          2,
          {
            userId: 'p3',
            seat: 2,
            displayName: 'Robot',
            role: 'wolfRobot' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          3,
          {
            userId: 'p4',
            seat: 3,
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
      pendingRevealAcks: [],
      hypnotizedSeats: [],
      piperRevealAcks: [],
      conversionRevealAcks: [],
      cupidLoversRevealAcks: [],
      status: GameStatus.Ongoing,
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
      hostUserId: 'host1',
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
            userId: 'p1',
            seat: 0,
            displayName: 'P1',
            role: 'villager' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          1,
          {
            userId: 'p2',
            seat: 1,
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
      pendingRevealAcks: [],
      hypnotizedSeats: [],
      piperRevealAcks: [],
      conversionRevealAcks: [],
      cupidLoversRevealAcks: [],
      status: GameStatus.Ongoing,
    };

    const seats = buildSeatViewModels(mockState, null, true, null);
    expect(seats[0].isWolf).toBe(false);
    expect(seats[1].isWolf).toBe(true);
  });

  describe('schemaConstraints option (UX early rejection)', () => {
    it('notSelf constraint disables own seat with reason', () => {
      const mockState: LocalGameState = {
        roomCode: 'TEST',
        hostUserId: 'host1',
        template: {
          name: 'Test',
          numberOfPlayers: 3,
          roles: ['seer', 'villager', 'wolf'] as RoleId[],
        },
        players: new Map([
          [
            0,
            {
              userId: 'p1',
              seat: 0,
              displayName: 'Seer',
              role: 'seer' as RoleId,
              hasViewedRole: true,
            },
          ],
          [
            1,
            {
              userId: 'p2',
              seat: 1,
              displayName: 'P2',
              role: 'villager' as RoleId,
              hasViewedRole: true,
            },
          ],
          [
            2,
            {
              userId: 'p3',
              seat: 2,
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
        pendingRevealAcks: [],
        hypnotizedSeats: [],
        piperRevealAcks: [],
        conversionRevealAcks: [],
        cupidLoversRevealAcks: [],
        status: GameStatus.Ongoing,
      };

      // I am seat 0, with notSelf constraint
      const seats = buildSeatViewModels(mockState, 0, false, null, {
        schemaConstraints: [TargetConstraint.NotSelf],
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
        hostUserId: 'host1',
        template: {
          name: 'Test',
          numberOfPlayers: 3,
          roles: ['seer', 'villager', 'wolf'] as RoleId[],
        },
        players: new Map([
          [
            0,
            {
              userId: 'p1',
              seat: 0,
              displayName: 'Seer',
              role: 'seer' as RoleId,
              hasViewedRole: true,
            },
          ],
          [
            1,
            {
              userId: 'p2',
              seat: 1,
              displayName: 'P2',
              role: 'villager' as RoleId,
              hasViewedRole: true,
            },
          ],
          [
            2,
            {
              userId: 'p3',
              seat: 2,
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
        pendingRevealAcks: [],
        hypnotizedSeats: [],
        piperRevealAcks: [],
        conversionRevealAcks: [],
        cupidLoversRevealAcks: [],
        status: GameStatus.Ongoing,
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

  describe('wolfVoteBadge', () => {
    const createWolfVoteState = (
      wolfVotesBySeat: Record<string, number> | undefined,
    ): LocalGameState => ({
      roomCode: 'TEST',
      hostUserId: 'host1',
      template: {
        name: 'Test',
        numberOfPlayers: 3,
        roles: ['wolf', 'villager', 'seer'] as RoleId[],
      },
      players: new Map([
        [
          0,
          {
            userId: 'p1',
            seat: 0,
            displayName: 'Wolf',
            role: 'wolf' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          1,
          {
            userId: 'p2',
            seat: 1,
            displayName: 'Villager',
            role: 'villager' as RoleId,
            hasViewedRole: true,
          },
        ],
        [
          2,
          {
            userId: 'p3',
            seat: 2,
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
      pendingRevealAcks: [],
      hypnotizedSeats: [],
      piperRevealAcks: [],
      conversionRevealAcks: [],
      cupidLoversRevealAcks: [],
      status: GameStatus.Ongoing,
    });

    it('should populate wolfVoteBadge when showWolves=true and wolf has voted', () => {
      const state = createWolfVoteState({ '0': 2 }); // seat 0 voted for seat 2
      const seats = buildSeatViewModels(state, 0, true, null);

      // Wolf seat 0 should show formatted badge
      expect(seats[0].wolfVoteBadge).toBe('袭击3号');
      // Non-wolf seats should not have wolfVoteBadge
      expect(seats[1].wolfVoteBadge).toBeUndefined();
      expect(seats[2].wolfVoteBadge).toBeUndefined();
    });

    it('should NOT populate wolfVoteBadge when showWolves=false', () => {
      const state = createWolfVoteState({ '0': 2 });
      const seats = buildSeatViewModels(state, 0, false, null);

      // Even though wolf voted, showWolves=false hides it
      expect(seats[0].wolfVoteBadge).toBeUndefined();
    });

    it('should show schema emptyVoteText for empty knife vote', () => {
      const state = createWolfVoteState({ '0': -1 }); // seat 0 voted empty knife
      const seats = buildSeatViewModels(state, 0, true, null);

      expect(seats[0].wolfVoteBadge).toBe('放弃袭击');
    });

    it('wolfVoteBadge and showReadyBadge should be mutually exclusive', () => {
      const state = createWolfVoteState({ '0': 2 });
      const seats = buildSeatViewModels(state, 0, true, null);

      // Wolf seat 0 has wolfVoteBadge → showReadyBadge must be false
      expect(seats[0].wolfVoteBadge).toBe('袭击3号');
      expect(seats[0].showReadyBadge).toBe(false);
    });
  });

  describe('showReadyBadge option (assigned phase)', () => {
    it('should show ready badge for players who have viewed their role', () => {
      const mockState: LocalGameState = {
        roomCode: 'TEST',
        hostUserId: 'host1',
        template: {
          name: 'Test',
          numberOfPlayers: 3,
          roles: ['wolf', 'villager', 'seer'] as RoleId[],
        },
        players: new Map([
          [
            0,
            {
              userId: 'p1',
              seat: 0,
              displayName: 'P1',
              role: 'wolf' as RoleId,
              hasViewedRole: true,
            },
          ],
          [
            1,
            {
              userId: 'p2',
              seat: 1,
              displayName: 'P2',
              role: 'villager' as RoleId,
              hasViewedRole: false,
            },
          ],
          [
            2,
            {
              userId: 'p3',
              seat: 2,
              displayName: 'P3',
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
        pendingRevealAcks: [],
        hypnotizedSeats: [],
        piperRevealAcks: [],
        conversionRevealAcks: [],
        cupidLoversRevealAcks: [],
        status: GameStatus.Assigned,
      };

      const seats = buildSeatViewModels(mockState, null, false, null, {
        showReadyBadges: true,
      });

      expect(seats[0].showReadyBadge).toBe(true);
      expect(seats[1].showReadyBadge).toBe(false); // has NOT viewed
      expect(seats[2].showReadyBadge).toBe(true);
    });

    it('should not show ready badge when player slot is null', () => {
      const mockState: LocalGameState = {
        roomCode: 'TEST',
        hostUserId: 'host1',
        template: {
          name: 'Test',
          numberOfPlayers: 2,
          roles: ['wolf', 'villager'] as RoleId[],
        },
        players: new Map([[0, null]]),
        actions: new Map(),
        wolfVotes: new Map(),
        currentStepIndex: 0,
        isAudioPlaying: false,
        lastNightDeaths: [],
        currentNightResults: {},
        pendingRevealAcks: [],
        hypnotizedSeats: [],
        piperRevealAcks: [],
        conversionRevealAcks: [],
        cupidLoversRevealAcks: [],
        status: GameStatus.Assigned,
      };

      const seats = buildSeatViewModels(mockState, null, false, null, {
        showReadyBadges: true,
      });

      expect(seats[0].showReadyBadge).toBe(false);
    });

    it('should not show ready badge when showReadyBadges is not set', () => {
      const mockState: LocalGameState = {
        roomCode: 'TEST',
        hostUserId: 'host1',
        template: {
          name: 'Test',
          numberOfPlayers: 1,
          roles: ['wolf'] as RoleId[],
        },
        players: new Map([
          [
            0,
            {
              userId: 'p1',
              seat: 0,
              displayName: 'P1',
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
        pendingRevealAcks: [],
        hypnotizedSeats: [],
        piperRevealAcks: [],
        conversionRevealAcks: [],
        cupidLoversRevealAcks: [],
        status: GameStatus.Assigned,
      };

      const seats = buildSeatViewModels(mockState, null, false, null);
      expect(seats[0].showReadyBadge).toBeFalsy();
    });
  });

  describe('secondSelectedSeat option', () => {
    it('should mark secondSelectedSeat as isSelected', () => {
      const mockState: LocalGameState = {
        roomCode: 'TEST',
        hostUserId: 'host1',
        template: {
          name: 'Test',
          numberOfPlayers: 3,
          roles: ['wolf', 'villager', 'seer'] as RoleId[],
        },
        players: new Map(),
        actions: new Map(),
        wolfVotes: new Map(),
        currentStepIndex: 0,
        isAudioPlaying: false,
        lastNightDeaths: [],
        currentNightResults: {},
        pendingRevealAcks: [],
        hypnotizedSeats: [],
        piperRevealAcks: [],
        conversionRevealAcks: [],
        cupidLoversRevealAcks: [],
        status: GameStatus.Ongoing,
      };

      const seats = buildSeatViewModels(mockState, null, false, 0, {
        secondSelectedSeat: 2,
      });

      expect(seats[0].isSelected).toBe(true); // primary
      expect(seats[1].isSelected).toBe(false);
      expect(seats[2].isSelected).toBe(true); // secondary
    });
  });
});

// =============================================================================
// getWolfVoteSummary
// =============================================================================

describe('getWolfVoteSummary', () => {
  function makeRoom(players: Array<[number, RoleId]>, wolfVotes: Map<number, number>) {
    return {
      template: {
        name: 'Test',
        numberOfPlayers: players.length,
        roles: players.map(([, role]) => role),
      },
      players: new Map(
        players.map(([seat, role]) => [
          seat,
          { userId: `p${seat}`, seat: seat, role, hasViewedRole: true },
        ]),
      ),
      actions: new Map(),
      wolfVotes,
      currentStepIndex: 0,
    };
  }

  it('should return "0/0 狼人已确认" when there are no wolves', () => {
    const room = makeRoom(
      [
        [0, 'villager'],
        [1, 'seer'],
      ],
      new Map(),
    );
    expect(getWolfVoteSummary(room)).toBe('0/0 狼人已确认');
  });

  it('should count only wolves that participate in wolfVote', () => {
    const room = makeRoom(
      [
        [0, 'wolf'],
        [1, 'wolfRobot'], // doesn't participate
        [2, 'nightmare'], // participates
        [3, 'villager'],
      ],
      new Map(),
    );
    // wolf + nightmare participate, wolfRobot does not
    expect(getWolfVoteSummary(room)).toBe('0/2 狼人已确认');
  });

  it('should count voted wolves correctly', () => {
    const room = makeRoom(
      [
        [0, 'wolf'],
        [1, 'wolf'],
        [2, 'seer'],
      ],
      new Map([
        [0, 2], // wolf seat 0 voted
      ]),
    );
    expect(getWolfVoteSummary(room)).toBe('1/2 狼人已确认');
  });

  it('should return "2/2 狼人已确认" when all wolves voted', () => {
    const room = makeRoom(
      [
        [0, 'wolf'],
        [1, 'darkWolfKing'],
        [2, 'villager'],
      ],
      new Map([
        [0, 2],
        [1, 2],
      ]),
    );
    expect(getWolfVoteSummary(room)).toBe('2/2 狼人已确认');
  });

  it('should handle null player entries', () => {
    const room = {
      template: { name: 'Test', numberOfPlayers: 2, roles: ['wolf', 'wolf'] as RoleId[] },
      players: new Map<number, any>([
        [0, null],
        [1, { userId: 'p1', seat: 1, role: 'wolf', hasViewedRole: true }],
      ]),
      actions: new Map(),
      wolfVotes: new Map([[1, 0]]),
      currentStepIndex: 0,
    };
    expect(getWolfVoteSummary(room)).toBe('1/1 狼人已确认');
  });
});

// =============================================================================
// toGameRoomLike — legacy wolfVotes fallback
// =============================================================================

describe('toGameRoomLike — legacy wolfVotes fallback', () => {
  it('should use currentNightResults.wolfVotesBySeat when present', () => {
    const state: LocalGameState = {
      roomCode: 'TEST',
      hostUserId: 'host1',
      template: { name: 'T', numberOfPlayers: 2, roles: ['wolf', 'villager'] as RoleId[] },
      players: new Map(),
      actions: new Map(),
      wolfVotes: new Map(),
      currentStepIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      currentNightResults: { wolfVotesBySeat: { '0': 1 } },
      pendingRevealAcks: [],
      hypnotizedSeats: [],
      piperRevealAcks: [],
      conversionRevealAcks: [],
      cupidLoversRevealAcks: [],
      status: GameStatus.Ongoing,
    };

    const result = toGameRoomLike(state);
    expect(result.wolfVotes.get(0)).toBe(1);
  });

  it('should convert plain object wolfVotes (legacy) to Map', () => {
    // Simulate legacy data where wolfVotes is a plain object instead of Map
    const legacyState = {
      roomCode: 'TEST',
      hostUserId: 'host1',
      template: { name: 'T', numberOfPlayers: 2, roles: ['wolf', 'villager'] as RoleId[] },
      players: new Map(),
      actions: new Map(),
      // A legacy plain object that wasn't deserialized to Map
      wolfVotes: { '0': 1, '2': 3 } as unknown as Map<number, number>,
      currentStepIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      currentNightResults: {},
      pendingRevealAcks: [],
      hypnotizedSeats: [],
      piperRevealAcks: [],
      conversionRevealAcks: [],
      cupidLoversRevealAcks: [],
      status: GameStatus.Ongoing,
    } as LocalGameState;

    const result = toGameRoomLike(legacyState);
    expect(result.wolfVotes).toBeInstanceOf(Map);
    expect(result.wolfVotes.get(0)).toBe(1);
    expect(result.wolfVotes.get(2)).toBe(3);
  });

  it('should return empty Map when no wolfVotes sources exist', () => {
    const state: LocalGameState = {
      roomCode: 'TEST',
      hostUserId: 'host1',
      template: { name: 'T', numberOfPlayers: 2, roles: ['wolf', 'villager'] as RoleId[] },
      players: new Map(),
      actions: new Map(),
      wolfVotes: new Map(),
      currentStepIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      currentNightResults: {},
      pendingRevealAcks: [],
      hypnotizedSeats: [],
      piperRevealAcks: [],
      conversionRevealAcks: [],
      cupidLoversRevealAcks: [],
      status: GameStatus.Ongoing,
    };

    const result = toGameRoomLike(state);
    expect(result.wolfVotes.size).toBe(0);
  });
});
