/**
 * witchContext.ts unit tests
 *
 * Tests the maybeCreateWitchContextAction pure function (public API)
 * witchContext computation logic is covered indirectly via the public API
 */

import { maybeCreateWitchContextAction } from '@werewolf/game-engine/engine/handlers/witchContext';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState, Player } from '@werewolf/game-engine/protocol/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createPlayer(seat: number, role: string): Player {
  return {
    userId: `uid-${seat}`,
    seat: seat,
    role: role as Player['role'],
    hasViewedRole: true,
  };
}

function createOngoingState(overrides: Partial<GameState> = {}): NonNullable<GameState> {
  return {
    roomCode: '1234',
    hostUserId: 'host-uid',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'witch', 'villager'],
    players: {
      0: createPlayer(0, 'wolf'),
      1: createPlayer(1, 'witch'),
      2: createPlayer(2, 'villager'),
    },
    currentStepIndex: 0,
    currentStepId: 'wolfKill',
    actions: [],
    currentNightResults: {},
    pendingRevealAcks: [],
    roster: {},
    deaths: [],
    wolfKillOverride: undefined,
    isAudioPlaying: false,
    ...overrides,
  } as NonNullable<GameState>;
}

// =============================================================================
// maybeCreateWitchContextAction Tests
// =============================================================================

describe('maybeCreateWitchContextAction', () => {
  // ---- canSave calculation logic ----

  describe('canSave calculation', () => {
    it('should set canSave=true when wolf kills someone else (normal case)', () => {
      const state = createOngoingState({
        currentNightResults: { wolfVotesBySeat: { '0': 2 } }, // wolf kills villager at seat 2
      });

      const action = maybeCreateWitchContextAction('witchAction', state);

      expect(action?.payload.killedSeat).toBe(2);
      expect(action?.payload.canSave).toBe(true);
    });

    it('should set canSave=false when wolf kills the witch (notSelf constraint)', () => {
      const state = createOngoingState({
        currentNightResults: { wolfVotesBySeat: { '0': 1 } }, // wolf kills witch at seat 1
      });

      const action = maybeCreateWitchContextAction('witchAction', state);

      expect(action?.payload.killedSeat).toBe(1);
      expect(action?.payload.canSave).toBe(false);
    });

    it('should set canSave=false when no one is killed', () => {
      const state = createOngoingState({
        currentNightResults: {},
      });

      const action = maybeCreateWitchContextAction('witchAction', state);

      expect(action?.payload.killedSeat).toBe(-1);
      expect(action?.payload.canSave).toBe(false);
    });

    it('should set canSave=false when wolfKillOverride is set', () => {
      const state = createOngoingState({
        wolfKillOverride: {
          source: 'nightmare',
          ui: { promptTitle: 't', promptMessage: 'm', emptyVoteText: 'e', rejectMessage: 'r' },
        },
        currentNightResults: { wolfVotesBySeat: { '0': 2 } },
      });

      const action = maybeCreateWitchContextAction('witchAction', state);

      expect(action?.payload.killedSeat).toBe(-1);
      expect(action?.payload.canSave).toBe(false);
    });

    /**
     * Edge case: witchSeat === -1
     *
     * Scenario: templateRoles contains witch, but no player in players has role === 'witch'
     * Expected: canSave must be false (defensive: block save to prevent errors in invalid state)
     */
    it('should set canSave=false when witch seat is not found in players (defensive)', () => {
      // Build invalid state: templateRoles has witch but players has no witch
      const state = createOngoingState({
        templateRoles: ['wolf', 'witch', 'villager'],
        players: {
          0: createPlayer(0, 'wolf'),
          1: createPlayer(1, 'villager'), // 本应是 witch，但标记为 villager
          2: createPlayer(2, 'villager'),
        },
        currentNightResults: { wolfVotesBySeat: { '0': 2 } }, // wolf kills villager at seat 2
      });

      const action = maybeCreateWitchContextAction('witchAction', state);

      // Key assertion: even with a killed player, canSave must be false when witchSeat=-1
      expect(action?.payload.killedSeat).toBe(2);
      expect(action?.payload.canSave).toBe(false);
    });
  });

  // ---- canPoison calculation logic ----

  describe('canPoison calculation (Night-1 only)', () => {
    it('should always set canPoison=true (Night-1 only project rule)', () => {
      const state = createOngoingState();

      const action = maybeCreateWitchContextAction('witchAction', state);

      expect(action?.payload.canPoison).toBe(true);
    });
  });

  // ---- gate logic ----

  it('should return SET_WITCH_CONTEXT action when entering witchAction step', () => {
    const state = createOngoingState({
      currentNightResults: { wolfVotesBySeat: { '0': 2 } },
    });

    const action = maybeCreateWitchContextAction('witchAction', state);

    expect(action).not.toBeNull();
    expect(action?.type).toBe('SET_WITCH_CONTEXT');
    expect(action?.payload.killedSeat).toBe(2);
    expect(action?.payload.canSave).toBe(true);
  });

  it('should return null when step is not witchAction', () => {
    const state = createOngoingState();

    const action = maybeCreateWitchContextAction('wolfKill', state);

    expect(action).toBeNull();
  });

  it('should return null when witchContext already exists', () => {
    const state = createOngoingState({
      witchContext: { killedSeat: 2, canSave: true, canPoison: true },
    });

    const action = maybeCreateWitchContextAction('witchAction', state);

    expect(action).toBeNull();
  });

  it('should return null when template has no witch', () => {
    const state = createOngoingState({
      templateRoles: ['wolf', 'villager', 'villager'],
    });

    const action = maybeCreateWitchContextAction('witchAction', state);

    expect(action).toBeNull();
  });
});
