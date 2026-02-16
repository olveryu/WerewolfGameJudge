/**
 * WolfRobot Hunter Status Gate Contract Tests
 *
 * Verifies:
 * 1. Bottom button appears when learned hunter (regardless of canShootAsHunter)
 * 2. Button disappears after viewed
 * 3. Button only appears for wolfRobot step
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';
import { createTemplateFromRoles } from '@werewolf/game-engine/models/Template';

import type { LocalGameState } from '@/types/GameStateTypes';

// Helper to create minimal game state
function createMinimalState(overrides?: Partial<LocalGameState>): LocalGameState {
  return {
    roomCode: 'TEST',
    hostUid: 'HOST',
    status: GameStatus.ongoing,
    template: createTemplateFromRoles(['wolfRobot', 'hunter', 'villager']),
    players: new Map([
      [0, { uid: 'U1', seatNumber: 0, displayName: 'P1', role: 'wolfRobot', hasViewedRole: true }],
      [1, { uid: 'U2', seatNumber: 1, displayName: 'P2', role: 'hunter', hasViewedRole: true }],
      [2, { uid: 'U3', seatNumber: 2, displayName: 'P3', role: 'villager', hasViewedRole: true }],
    ]),
    actions: new Map(),
    wolfVotes: new Map(),
    currentStepIndex: 0,
    currentStepId: 'wolfRobotLearn',
    isAudioPlaying: false,
    lastNightDeaths: [],
    currentNightResults: {},
    pendingRevealAcks: [],
    ...overrides,
  };
}

// Pure function to determine bottom action (extracted from useRoomActions logic)
function getWolfRobotHunterGateBottomAction(
  gameState: LocalGameState,
  currentSchemaId: string | undefined,
): { showButton: boolean; buttonKey?: string; buttonLabel?: string } {
  if (!currentSchemaId) return { showButton: false };

  const currentSchema = Object.values(SCHEMAS).find((s) => s.id === currentSchemaId);
  if (!currentSchema) return { showButton: false };

  // wolfRobot learned hunter gate: must view status before continuing
  // Condition: learned hunter (regardless of canShootAsHunter true/false)
  if (
    currentSchema.id === 'wolfRobotLearn' &&
    gameState.wolfRobotReveal?.learnedRoleId === 'hunter' &&
    gameState.wolfRobotHunterStatusViewed === false
  ) {
    // Schema-driven: read button text from schema (fail-fast if missing)
    const gateButtonText = currentSchema.ui?.hunterGateButtonText;
    if (!gateButtonText) {
      throw new Error(
        '[useRoomActions] wolfRobotLearn schema missing ui.hunterGateButtonText - schema-driven UI requires this field',
      );
    }
    return { showButton: true, buttonKey: 'viewHunterStatus', buttonLabel: gateButtonText };
  }

  return { showButton: false };
}

describe('WolfRobot Hunter Status Gate', () => {
  describe('bottom button visibility', () => {
    it('shows button when learned hunter AND canShootAsHunter === true', () => {
      const state = createMinimalState({
        currentStepId: 'wolfRobotLearn',
        wolfRobotReveal: {
          targetSeat: 1,
          result: 'hunter',
          learnedRoleId: 'hunter',
          canShootAsHunter: true,
        },
        wolfRobotHunterStatusViewed: false,
      });

      const result = getWolfRobotHunterGateBottomAction(state, 'wolfRobotLearn');

      expect(result.showButton).toBe(true);
      expect(result.buttonKey).toBe('viewHunterStatus');
    });

    it('shows button when learned hunter AND canShootAsHunter === false (poisoned)', () => {
      // This is the key test case: button must appear even when cannot shoot
      const state = createMinimalState({
        currentStepId: 'wolfRobotLearn',
        wolfRobotReveal: {
          targetSeat: 1,
          result: 'hunter',
          learnedRoleId: 'hunter',
          canShootAsHunter: false, // poisoned by witch
        },
        wolfRobotHunterStatusViewed: false,
      });

      const result = getWolfRobotHunterGateBottomAction(state, 'wolfRobotLearn');

      expect(result.showButton).toBe(true);
      expect(result.buttonKey).toBe('viewHunterStatus');
    });

    it('hides button after viewed', () => {
      const state = createMinimalState({
        currentStepId: 'wolfRobotLearn',
        wolfRobotReveal: {
          targetSeat: 1,
          result: 'hunter',
          learnedRoleId: 'hunter',
          canShootAsHunter: true,
        },
        wolfRobotHunterStatusViewed: true, // already viewed
      });

      const result = getWolfRobotHunterGateBottomAction(state, 'wolfRobotLearn');

      expect(result.showButton).toBe(false);
    });

    it('hides button when learned non-hunter role', () => {
      const state = createMinimalState({
        currentStepId: 'wolfRobotLearn',
        wolfRobotReveal: {
          targetSeat: 2,
          result: 'villager',
          learnedRoleId: 'villager',
        },
        wolfRobotHunterStatusViewed: false,
      });

      const result = getWolfRobotHunterGateBottomAction(state, 'wolfRobotLearn');

      expect(result.showButton).toBe(false);
    });

    it('hides button when not on wolfRobotLearn step', () => {
      const state = createMinimalState({
        currentStepId: 'seerCheck', // different step
        wolfRobotReveal: {
          targetSeat: 1,
          result: 'hunter',
          learnedRoleId: 'hunter',
          canShootAsHunter: true,
        },
        wolfRobotHunterStatusViewed: false,
      });

      const result = getWolfRobotHunterGateBottomAction(state, 'seerCheck');

      expect(result.showButton).toBe(false);
    });
  });

  describe('schema-driven UI contract', () => {
    it('button label must equal schema.ui.hunterGateButtonText (no hardcoded strings)', () => {
      const state = createMinimalState({
        currentStepId: 'wolfRobotLearn',
        wolfRobotReveal: {
          targetSeat: 1,
          result: 'hunter',
          learnedRoleId: 'hunter',
          canShootAsHunter: true,
        },
        wolfRobotHunterStatusViewed: false,
      });

      const result = getWolfRobotHunterGateBottomAction(state, 'wolfRobotLearn');

      // Must match schema exactly
      expect(result.buttonLabel).toBe(SCHEMAS.wolfRobotLearn.ui?.hunterGateButtonText);
      expect(result.buttonLabel).toBeDefined();
    });

    it('schema must have all required hunterGate UI fields', () => {
      const schema = SCHEMAS.wolfRobotLearn;
      // These fields are required for schema-driven UI (fail-fast in runtime)
      expect(schema.ui?.hunterGateButtonText).toBeDefined();
      expect(schema.ui?.hunterGateDialogTitle).toBeDefined();
      expect(schema.ui?.hunterGateCanShootText).toBeDefined();
      expect(schema.ui?.hunterGateCannotShootText).toBeDefined();
    });
  });
});
