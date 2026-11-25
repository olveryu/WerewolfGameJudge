/**
 * normalize.contract.test.ts - normalizeState contract tests
 *
 * Ensures normalizeState correctly passes through all fields of GameState.
 * When adding new fields, if you forget to pass them through in normalizeState, this test will fail.
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { GameState } from '@game-judge/game-engine/games/werewolf/domain/protocol/types';
import { normalizeState } from '@game-judge/game-engine/games/werewolf/domain/state/normalize';

import { withTestNightState } from '../../../__tests__/nightStateFixture';

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
  'gameType',
  'roomCode',
  'hostUserId',
  'status',
  'templateRoles',
  'rules',
  'players',
  'roleViewedSeats',
  'startingParticipants',
  'mvpUserId',
  'roster',
  'nightState',
  'isAudioPlaying',
  'audioBatchId',
  'gameSequence',

  // Role reveal animation config
  'roleRevealRandomNonce',

  // Execution state
  'lastNightDeaths',
  'lastNightInfoConfirmed',
  'reviewCompletedUserIds',
  'deathReasons',

  // First-day sheriff election
  'sheriffElection',
  'sheriffElectionResult',

  // Pending audio effect queue
  'pendingAudioEffects',

  // Dual Seer label mapping
  'seerLabelMap',

  // Night review share permissions
  'nightReviewAllowedSeats',

  // Treasure Master
  'bottomCards',
  'treasureMasterSeat',

  // Thief
  'thiefSeat',

  // Board nominations
  'boardNominations',
];

describe('normalizeState contract', () => {
  /**
   * Create a full GameState containing all fields
   */
  const createFullState = (): GameState => {
    return withTestNightState({
      // Core required fields
      gameType: 'werewolf',
      roomCode: 'TEST',
      hostUserId: 'host-uid',
      status: GameStatus.Ongoing,
      templateRoles: ['villager', 'wolf'],
      rules: { isPlagueMode: false },
      players: {
        0: { seat: 0, role: 'villager' },
        1: { seat: 1, role: 'wolf' },
      },
      roleViewedSeats: [],
      roster: {
        0: { seat: 0, userId: 'p0', profile: { displayName: 'P0' } },
        1: { seat: 1, userId: 'p1', profile: { displayName: 'P1' } },
      },
      isAudioPlaying: false,
      audioBatchId: 0,
      gameSequence: 0,

      // Role reveal animation config
      roleRevealRandomNonce: 'nonce-123',

      // Night flow state (step deadline rides inside the live step)
      nightState: null,

      // Execution state
      lastNightDeaths: [3],

      // Nightmare block

      // Piper

      // Awakened Gargoyle

      // Wolf Girl

      // Seed Wolf

      // Wolf Robot disguise context

      // Role-specific context

      // Pending audio effect queue
      pendingAudioEffects: [{ audioKey: 'wolfKill', isEndAudio: true }],

      // Debug mode

      // Night review share permissions
      nightReviewAllowedSeats: [0, 2],

      // Cupid

      // Board nominations
      boardNominations: {
        'user-1': {
          userId: 'user-1',
          displayName: 'Alice',
          roles: ['villager', 'wolf'],
          upvoters: ['user-2'],
        },
      },
    });
  };

  it('should reject a missing pendingAudioEffects field', () => {
    const incomplete = { ...createFullState() } as Record<string, unknown>;
    delete incomplete['pendingAudioEffects'];

    expect(() => normalizeState(incomplete as unknown as GameState)).toThrow(
      'missing required field: pendingAudioEffects',
    );
  });

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

  it('should preserve undefined optional fields as undefined', () => {
    const minimalState: GameState = {
      gameType: 'werewolf',
      roomCode: 'TEST',
      hostUserId: 'host-uid',
      status: GameStatus.Unseated,
      templateRoles: ['villager'],
      players: {},
      roleViewedSeats: [],
      nightState: null,
      isAudioPlaying: false,
      audioBatchId: 0,
      gameSequence: 0,
      pendingAudioEffects: [],
      roster: {},
    };

    const normalized = normalizeState(minimalState);

    // Optional fields should remain undefined
    expect(normalized.rules).toBeUndefined();
    expect(normalized.lastNightDeaths).toBeUndefined();
    expect(normalized.deathReasons).toBeUndefined();
    expect(normalized.sheriffElection).toBeUndefined();
    expect(normalized.bottomCards).toBeUndefined();
    expect(normalized.seerLabelMap).toBeUndefined();
  });
});
