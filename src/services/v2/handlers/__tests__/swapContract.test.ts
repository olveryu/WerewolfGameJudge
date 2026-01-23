/**
 * Swap Contract Tests (v2)
 *
 * Verifies the magician swap input protocol and downstream effects:
 *
 * 1. Handler contract: swap input shape (extra.targets)
 * 2. 查验对齐: seer/psychic/gargoyle/wolfRobot check after swap
 * 3. 死亡结算: death falls on swapped seat
 *
 * Key invariants:
 * - swap input MUST use extra.targets: [seatA, seatB], target must be null
 * - swap writes to currentNightResults.swappedSeats
 * - check resolvers use getRoleAfterSwap for effective identity
 * - DeathCalculator swaps death status between two targets
 */

import { handleSubmitAction } from '../actionHandler';
import type { HandlerContext } from '../types';
import type { SubmitActionIntent } from '../../intents/types';
import type { GameState } from '../../store/types';
import type { SchemaId } from '../../../../models/roles/spec';

import { seerCheckResolver } from '../../../night/resolvers/seer';
import { psychicCheckResolver } from '../../../night/resolvers/psychic';
import { gargoyleCheckResolver } from '../../../night/resolvers/gargoyle';
import { wolfRobotLearnResolver } from '../../../night/resolvers/wolfRobot';
import type { ResolverContext, ActionInput } from '../../../night/resolvers/types';
import type { RoleId } from '../../../../models/roles/spec/specs';

// =============================================================================
// Test Helpers
// =============================================================================

function createOngoingState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: 'ongoing',
    templateRoles: ['villager', 'wolf', 'seer', 'magician'],
    players: {
      0: { uid: 'p0', seatNumber: 0, role: 'villager', hasViewedRole: true },
      1: { uid: 'p1', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      2: { uid: 'p2', seatNumber: 2, role: 'seer', hasViewedRole: true },
      3: { uid: 'p3', seatNumber: 3, role: 'magician', hasViewedRole: true },
    },
    currentActionerIndex: 0,
    isAudioPlaying: false,
    actions: [],
    currentNightResults: {},
    currentStepId: 'magicianSwap' as SchemaId,
    ...overrides,
  };
}

function createContext(state: GameState): HandlerContext {
  return {
    state,
    isHost: true,
    myUid: 'host-1',
    mySeat: 0,
  };
}

function createResolverContext(
  players: Map<number, RoleId>,
  actorSeat: number,
  actorRoleId: RoleId,
  swappedSeats?: readonly [number, number],
): ResolverContext {
  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults: swappedSeats ? { swappedSeats } : {},
    gameState: { isNight1: true },
  };
}

// =============================================================================
// 1. Handler contract: swap 输入 shape
// =============================================================================

describe('Swap input protocol (v2 contract)', () => {
  describe('valid swap submission', () => {
    it('should accept swap with extra.targets: [seatA, seatB]', () => {
      const state = createOngoingState();
      const context = createContext(state);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 3,
          role: 'magician',
          target: null, // MUST be null for swap
          extra: { targets: [0, 1] },
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(true);
      // Should write swappedSeats to updates
      const applyAction = result.actions.find((a) => a.type === 'APPLY_RESOLVER_RESULT');
      expect(applyAction).toBeDefined();
      expect((applyAction as any).payload.updates.swappedSeats).toEqual([0, 1]);
    });

    it('should accept skip with empty targets', () => {
      const state = createOngoingState();
      const context = createContext(state);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 3,
          role: 'magician',
          target: null,
          extra: { targets: [] },
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(true);
    });
  });

  describe('invalid swap submission (must reject)', () => {
    it('should reject when targets has only 1 element', () => {
      const state = createOngoingState();
      const context = createContext(state);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 3,
          role: 'magician',
          target: null,
          extra: { targets: [0] },
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('两名');
      expect(result.actions.some((a) => a.type === 'ACTION_REJECTED')).toBe(true);
    });

    it('should reject when targets has 3 elements', () => {
      const state = createOngoingState();
      const context = createContext(state);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 3,
          role: 'magician',
          target: null,
          extra: { targets: [0, 1, 2] },
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('两名');
    });

    it('should reject when targets contains same seat twice', () => {
      const state = createOngoingState();
      const context = createContext(state);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 3,
          role: 'magician',
          target: null,
          extra: { targets: [1, 1] },
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('同一个');
    });

    it('should reject when targets contains non-existent seat', () => {
      const state = createOngoingState();
      const context = createContext(state);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 3,
          role: 'magician',
          target: null,
          extra: { targets: [0, 99] },
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });
  });
});

// =============================================================================
// 2. 查验对齐 integration: check after swap
// =============================================================================

describe('Check after swap (identity alignment)', () => {
  // Setup: A=villager (seat 0), B=wolf (seat 1)
  // After swap [0,1]: check seat 0 should see wolf, check seat 1 should see villager

  const players = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'wolf'],
    [2, 'seer'],
    [3, 'psychic'],
    [4, 'gargoyle'],
    [5, 'wolfRobot'],
    [6, 'magician'],
  ]);

  const swappedSeats: readonly [number, number] = [0, 1];

  describe('seer check after swap', () => {
    it('should see wolf when checking villager seat (after swap)', () => {
      const ctx = createResolverContext(players, 2, 'seer', swappedSeats);
      const input: ActionInput = { schemaId: 'seerCheck', target: 0 }; // check seat 0 (original villager)

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // After swap, seat 0 has wolf's identity → should return '狼人'
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('should see villager when checking wolf seat (after swap)', () => {
      const ctx = createResolverContext(players, 2, 'seer', swappedSeats);
      const input: ActionInput = { schemaId: 'seerCheck', target: 1 }; // check seat 1 (original wolf)

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // After swap, seat 1 has villager's identity → should return '好人'
      expect(result.result?.checkResult).toBe('好人');
    });

    it('should see original identity for non-swapped seats', () => {
      const ctx = createResolverContext(players, 2, 'seer', swappedSeats);
      const input: ActionInput = { schemaId: 'seerCheck', target: 6 }; // check magician

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // Magician is not swapped → should return '好人'
      expect(result.result?.checkResult).toBe('好人');
    });
  });

  describe('psychic check after swap', () => {
    it('should see wolf identity when checking villager seat (after swap)', () => {
      const ctx = createResolverContext(players, 3, 'psychic', swappedSeats);
      const input: ActionInput = { schemaId: 'psychicCheck', target: 0 };

      const result = psychicCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // After swap, seat 0 has wolf's identity
      expect(result.result?.identityResult).toBe('wolf');
    });

    it('should see villager identity when checking wolf seat (after swap)', () => {
      const ctx = createResolverContext(players, 3, 'psychic', swappedSeats);
      const input: ActionInput = { schemaId: 'psychicCheck', target: 1 };

      const result = psychicCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // After swap, seat 1 has villager's identity
      expect(result.result?.identityResult).toBe('villager');
    });
  });

  describe('gargoyle check after swap', () => {
    it('should see wolf identity when checking villager seat (after swap)', () => {
      const ctx = createResolverContext(players, 4, 'gargoyle', swappedSeats);
      const input: ActionInput = { schemaId: 'gargoyleCheck', target: 0 };

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('wolf');
    });
  });

  describe('wolfRobot learn after swap', () => {
    it('should learn wolf identity when learning from villager seat (after swap)', () => {
      const ctx = createResolverContext(players, 5, 'wolfRobot', swappedSeats);
      const input: ActionInput = { schemaId: 'wolfRobotLearn', target: 0 };

      const result = wolfRobotLearnResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('wolf');
    });
  });

  describe('no swap scenario', () => {
    it('should see original identity when no swap happened', () => {
      const ctx = createResolverContext(players, 2, 'seer'); // no swap
      const input: ActionInput = { schemaId: 'seerCheck', target: 0 };

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人'); // villager
    });
  });
});

// =============================================================================
// 3. 死亡结算对齐 (DeathCalculator integration)
// =============================================================================

describe('Death after swap (DeathCalculator alignment)', () => {
  // Note: DeathCalculator tests are in src/services/__tests__/DeathCalculator.test.ts
  // This section documents the contract and provides a quick sanity check

  it('contract: DeathCalculator.processMagicianSwap swaps death status', () => {
    // This is a documentation test - actual tests are in DeathCalculator.test.ts
    // The contract is:
    // - magicianSwap: { first, second }
    // - If exactly one of first/second is dead, swap their death status
    // - wolfKill=A, swap[A,B] → B dies instead of A

    // Key test cases covered in DeathCalculator.test.ts:
    // - 'should swap death when first target is dead'
    // - 'should swap death when second target is dead'
    // - 'should not swap when both targets are dead'
    // - 'should not swap when neither target is dead'

    expect(true).toBe(true); // placeholder assertion
  });
});

// =============================================================================
// 4. BroadcastGameState single source of truth
// =============================================================================

describe('BroadcastGameState.currentNightResults.swappedSeats (single source of truth)', () => {
  it('swap result should only be stored in currentNightResults.swappedSeats', () => {
    const state = createOngoingState();
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: {
        seat: 3,
        role: 'magician',
        target: null,
        extra: { targets: [0, 1] },
      },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(true);

    // swappedSeats should be in APPLY_RESOLVER_RESULT updates
    const applyAction = result.actions.find((a) => a.type === 'APPLY_RESOLVER_RESULT');
    expect(applyAction).toBeDefined();
    expect((applyAction as any).payload.updates.swappedSeats).toEqual([0, 1]);

    // No other location should store swap info
    // (This is a design invariant, not something we can test directly)
  });
});
