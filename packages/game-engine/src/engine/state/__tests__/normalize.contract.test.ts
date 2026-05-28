/**
 * normalize.contract.test.ts - normalizeState contract tests
 *
 * Ensures normalizeState correctly passes through all fields of GameState.
 * When adding new fields, if you forget to pass them through in normalizeState, this test will fail.
 */

import { normalizeState } from '@werewolf/game-engine/engine/state/normalize';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';

/**
 * List of all top-level fields of GameState (single source of truth)
 *
 * When adding new fields to GameState:
 * 1. Add the field name to this list
 * 2. Add the pass-through in normalizeState
 * 3. Run this test to verify
 */
const GAME_STATE_FIELDS: (keyof GameState)[] = [
  // Core required fields
  'roomCode',
  'hostUserId',
  'status',
  'templateRoles',
  'rules',
  'players',
  'roster',
  'currentStepIndex',
  'isAudioPlaying',

  // Role reveal animation config
  'roleRevealRandomNonce',

  // Night flow state
  'currentStepId',

  // Execution state
  'actions',
  'currentNightResults',
  'pendingRevealAcks',
  'lastNightDeaths',
  'deathReasons',

  // Nightmare block
  'nightmareBlockedSeat',
  'wolfKillOverride',

  // Piper
  'hypnotizedSeats',
  'piperRevealAcks',

  // Awakened Gargoyle
  'convertedSeat',
  'conversionRevealAcks',

  // Wolf Robot disguise context
  'wolfRobotContext',

  // Role-specific context
  'witchContext',
  'seerReveal',
  'mirrorSeerReveal',
  'drunkSeerReveal',
  'psychicReveal',
  'gargoyleReveal',
  'pureWhiteReveal',
  'wolfWitchReveal',
  'wolfRobotReveal',
  'wolfRobotHunterStatusViewed',
  'confirmStatus',
  'actionRejected',

  // Unified step deadline
  'stepDeadline',

  // Pending audio effect queue
  'pendingAudioEffects',

  // Debug mode
  'debugMode',

  // UI Hints
  'ui',

  // Dual Seer label mapping
  'seerLabelMap',

  // Night review share permissions
  'nightReviewAllowedSeats',

  // Treasure Master
  'bottomCards',
  'treasureMasterSeat',
  'treasureMasterChosenCard',
  'effectiveTeam',
  'bottomCardStepRoles',

  // Thief
  'thiefSeat',
  'thiefChosenCard',

  // Cupid
  'loverSeats',
  'cupidSeat',
  'cupidLoversRevealAcks',

  // Board nominations
  'boardNominations',
];

describe('normalizeState contract', () => {
  /**
   * Create a full GameState containing all fields
   */
  const createFullState = (): GameState => {
    return {
      // Core required fields
      roomCode: 'TEST',
      hostUserId: 'host-uid',
      status: GameStatus.Ongoing,
      templateRoles: ['villager', 'wolf'],
      rules: { isPlagueMode: false },
      players: {
        1: { userId: 'p1', seat: 1, hasViewedRole: true },
      },
      roster: { p1: { displayName: 'P1' } },
      currentStepIndex: 0,
      isAudioPlaying: false,

      // Role reveal animation config
      roleRevealRandomNonce: 'nonce-123',

      // Night flow state
      currentStepId: 'wolfKill',

      // Execution state
      actions: [{ schemaId: 'wolfKill', actorSeat: 1, targetSeat: 2, timestamp: Date.now() }],
      currentNightResults: { wolfVotesBySeat: { '1': 2 } },
      pendingRevealAcks: ['seer-1'],
      lastNightDeaths: [3],

      // Nightmare block
      nightmareBlockedSeat: 5,
      wolfKillOverride: {
        source: 'nightmare',
        ui: { promptTitle: 't', promptMessage: 'm', emptyVoteText: 'e', rejectMessage: 'r' },
      },

      // Piper
      hypnotizedSeats: [3, 5],
      piperRevealAcks: [3],

      // Awakened Gargoyle
      convertedSeat: 2,
      conversionRevealAcks: [0, 1],

      // Wolf Robot disguise context
      wolfRobotContext: { learnedSeat: 4, disguisedRole: 'seer' },

      // Role-specific context
      witchContext: { killedSeat: 2, canSave: true, canPoison: true },
      seerReveal: { targetSeat: 3, result: '好人' },
      psychicReveal: { targetSeat: 4, result: 'seer' },
      gargoyleReveal: { targetSeat: 5, result: '好人阵营' },
      pureWhiteReveal: { targetSeat: 7, result: '好人' },
      wolfWitchReveal: { targetSeat: 8, result: '好人' },
      wolfRobotReveal: { targetSeat: 6, result: 'seer', learnedRoleId: 'seer' },
      wolfRobotHunterStatusViewed: true,
      confirmStatus: { role: 'hunter', canShoot: true },
      actionRejected: {
        action: 'witchAction',
        reason: 'already_used',
        targetUserId: 'p1',
        rejectionId: 'rej-1',
      },

      // Unified step deadline
      stepDeadline: Date.now() + 5000,

      // Pending audio effect queue
      pendingAudioEffects: [{ audioKey: 'wolfKill', isEndAudio: true }],

      // Debug mode
      debugMode: { botsEnabled: true },

      // Night review share permissions
      nightReviewAllowedSeats: [0, 2],

      // Thief
      thiefSeat: 0,
      thiefChosenCard: 'wolf',

      // Cupid
      loverSeats: [1, 3] as readonly [number, number],
      cupidSeat: 4,
      cupidLoversRevealAcks: [1],

      // Board nominations
      boardNominations: {
        'user-1': {
          userId: 'user-1',
          displayName: 'Alice',
          roles: ['villager', 'wolf'],
          upvoters: ['user-2'],
        },
      },
    };
  };

  it('should preserve all GameState fields after normalization', () => {
    const fullState = createFullState();
    const normalized = normalizeState(fullState);

    // Check that all fields are passed through
    for (const field of GAME_STATE_FIELDS) {
      expect(normalized).toHaveProperty(field);
      // For required fields, values should be equal
      // For optional fields, if the source has a value, the normalized result should also have a value
      if (fullState[field] !== undefined) {
        expect(normalized[field]).toBeDefined();
      }
    }
  });

  it('should not drop any fields during normalization (snapshot)', () => {
    const fullState = createFullState();
    const normalized = normalizeState(fullState);

    // Get all fields after normalization
    const normalizedFields = Object.keys(normalized) as (keyof GameState)[];

    // Ensure GAME_STATE_FIELDS covers all fields
    // If a new field appears after normalization that's not in the list, the test fails
    for (const field of normalizedFields) {
      expect(GAME_STATE_FIELDS).toContain(field);
    }

    // Ensure all fields in the list are in the normalized result
    for (const field of GAME_STATE_FIELDS) {
      expect(normalizedFields).toContain(field);
    }
  });

  it('should preserve debugMode.botsEnabled value exactly', () => {
    const stateWithDebugMode = createFullState();
    stateWithDebugMode.debugMode = { botsEnabled: true };

    const normalized = normalizeState(stateWithDebugMode);

    expect(normalized.debugMode).toEqual({ botsEnabled: true });
  });

  it('should preserve undefined optional fields as undefined', () => {
    const minimalState: GameState = {
      roomCode: 'TEST',
      hostUserId: 'host-uid',
      status: GameStatus.Unseated,
      templateRoles: ['villager'],
      players: {},
      currentStepIndex: -1,
      isAudioPlaying: false,
      actions: [],
      pendingRevealAcks: [],
      hypnotizedSeats: [],
      piperRevealAcks: [],
      conversionRevealAcks: [],
      cupidLoversRevealAcks: [],
      roster: {},
    };

    const normalized = normalizeState(minimalState);

    // Optional fields should remain undefined
    expect(normalized.debugMode).toBeUndefined();
    expect(normalized.witchContext).toBeUndefined();
    expect(normalized.seerReveal).toBeUndefined();
  });
});
