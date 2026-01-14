/**
 * visibility.contract.test.ts - Anti-cheat visibility contract tests
 * 
 * These tests verify that:
 * 1. PublicPayload/PublicGameState do NOT contain sensitive fields
 * 2. Type separation is enforced at compile time
 * 
 * @see docs/phase4-final-migration.md
 */

import type {
  PublicPayload,
  PublicGameState,
  PublicRoleTurn,
  PrivatePayload,
  WitchContextPayload,
  SeerRevealPayload,
  PsychicRevealPayload,
  BlockedPayload,
} from '../types';

/**
 * Sensitive fields that MUST NOT appear in public broadcast.
 * These must be sent via sendPrivate() with toUid.
 */
const SENSITIVE_FIELD_NAMES = [
  'killedIndex',
  'checkResult',
  'seerResult',
  'psychicResult',
  'canSave',
  'canPoison',
  'witchContext',
  'selectableSeats',
  'blockedSeat',
  'nightmareBlockedSeat',
  'actions',
  'wolfKillTarget',
  'visibility', // StepSpec.visibility 不得进入 BroadcastGameState（反作弊红线）
] as const;

describe('Visibility Contract (Anti-cheat)', () => {

  describe('PublicGameState whitelist', () => {
    it('should NOT contain any sensitive fields in its type definition', () => {
      // This test documents the whitelist contract
      // The actual enforcement is compile-time (TypeScript type checking)
      
      // Create a mock PublicGameState to verify structure
      const mockState: PublicGameState = {
        roomCode: 'ABCD',
        hostUid: 'host-123',
        status: 'ongoing',
        templateRoles: ['wolf', 'seer', 'witch', 'villager'],
        players: {},
        currentActionerIndex: 0,
        isAudioPlaying: false,
        wolfVoteStatus: {},
      };

      // Verify the allowed fields exist
      expect(mockState.roomCode).toBeDefined();
      expect(mockState.hostUid).toBeDefined();
      expect(mockState.status).toBeDefined();
      expect(mockState.templateRoles).toBeDefined();
      expect(mockState.players).toBeDefined();
      expect(mockState.currentActionerIndex).toBeDefined();
      expect(mockState.isAudioPlaying).toBeDefined();

      // Verify sensitive fields are NOT in the object's keys
      const stateKeys = Object.keys(mockState);
      for (const sensitiveField of SENSITIVE_FIELD_NAMES) {
        expect(stateKeys).not.toContain(sensitiveField);
      }
    });
  });

  describe('PublicRoleTurn whitelist', () => {
    it('should NOT contain killedIndex or canSave', () => {
      const mockRoleTurn: PublicRoleTurn = {
        type: 'ROLE_TURN',
        role: 'witch',
        stepId: 'witchAction',
        pendingSeats: [3],
      };

      expect(mockRoleTurn.type).toBe('ROLE_TURN');
      expect(mockRoleTurn.role).toBe('witch');
      expect(mockRoleTurn.stepId).toBe('witchAction');
      expect(mockRoleTurn.pendingSeats).toEqual([3]);

      // Verify sensitive fields are NOT in the object's keys
      const turnKeys = Object.keys(mockRoleTurn);
      expect(turnKeys).not.toContain('killedIndex');
      expect(turnKeys).not.toContain('canSave');
      expect(turnKeys).not.toContain('selectableSeats');
    });
  });

  describe('PrivatePayload structure', () => {
    it('WitchContextPayload should contain killedIndex and canSave', () => {
      const witchContext: WitchContextPayload = {
        kind: 'WITCH_CONTEXT',
        killedIndex: 2,
        canSave: true,
        canPoison: true,
        phase: 'save',
      };

      expect(witchContext.kind).toBe('WITCH_CONTEXT');
      expect(witchContext.killedIndex).toBe(2);
      expect(witchContext.canSave).toBe(true);
      expect(witchContext.canPoison).toBe(true);
      expect(witchContext.phase).toBe('save');
    });

    it('SeerRevealPayload should contain result', () => {
      const seerReveal: SeerRevealPayload = {
        kind: 'SEER_REVEAL',
        targetSeat: 3,
        result: '狼人',
      };

      expect(seerReveal.kind).toBe('SEER_REVEAL');
      expect(seerReveal.targetSeat).toBe(3);
      expect(seerReveal.result).toBe('狼人');
    });

    it('PsychicRevealPayload should contain role result', () => {
      const psychicReveal: PsychicRevealPayload = {
        kind: 'PSYCHIC_REVEAL',
        targetSeat: 4,
        result: '女巫',
      };

      expect(psychicReveal.kind).toBe('PSYCHIC_REVEAL');
      expect(psychicReveal.targetSeat).toBe(4);
      expect(psychicReveal.result).toBe('女巫');
    });

    it('BlockedPayload should contain reason', () => {
      const blocked: BlockedPayload = {
        kind: 'BLOCKED',
        reason: 'nightmare',
      };

      expect(blocked.kind).toBe('BLOCKED');
      expect(blocked.reason).toBe('nightmare');
    });
  });

  describe('Type separation enforcement', () => {
    it('PrivatePayload discriminated union covers all sensitive payloads', () => {
      // This test documents the expected payload kinds
      const payloadKinds = [
        'WITCH_CONTEXT',
        'SEER_REVEAL',
        'PSYCHIC_REVEAL',
        'BLOCKED',
      ] as const;

      // Type-level test: ensure PrivatePayload is a union of the expected types
      type ExpectedKinds = PrivatePayload['kind'];
      
      // Runtime verification
      const witchContext: PrivatePayload = { kind: 'WITCH_CONTEXT', killedIndex: -1, canSave: false, canPoison: true, phase: 'save' };
      const seerReveal: PrivatePayload = { kind: 'SEER_REVEAL', targetSeat: 1, result: '好人' };
      const psychicReveal: PrivatePayload = { kind: 'PSYCHIC_REVEAL', targetSeat: 2, result: '预言家' };
      const blocked: PrivatePayload = { kind: 'BLOCKED', reason: 'nightmare' };

      expect(payloadKinds).toContain(witchContext.kind);
      expect(payloadKinds).toContain(seerReveal.kind);
      expect(payloadKinds).toContain(psychicReveal.kind);
      expect(payloadKinds).toContain(blocked.kind);
    });
  });
});
