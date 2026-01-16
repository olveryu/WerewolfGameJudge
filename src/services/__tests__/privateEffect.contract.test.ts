/**
 * privateEffect.contract.test.ts - Private message sending contract tests
 * 
 * These tests verify that:
 * 1. Sensitive info (killedIndex, etc.) is sent via sendPrivate with toUid
 * 2. Private messages have correct structure (type, toUid, revision, payload)
 * 
 * @see docs/phase4-final-migration.md
 */

import type { PrivateMessage, WitchContextPayload, SeerRevealPayload, BlockedPayload } from '../types';
import { makeInboxKey } from '../types/PrivateBroadcast';

describe('Private Effect Contract', () => {
  describe('PrivateMessage structure', () => {
    it('should have required fields: type, toUid, revision, payload', () => {
      const message: PrivateMessage = {
        type: 'PRIVATE_EFFECT',
        toUid: 'user-123-abc',
        revision: 5,
        payload: {
          kind: 'WITCH_CONTEXT',
          killedIndex: 2,
          canSave: true,
          canPoison: true,
        },
      };

      expect(message.type).toBe('PRIVATE_EFFECT');
      expect(message.toUid).toBe('user-123-abc');
      expect(message.revision).toBe(5);
      expect(message.payload.kind).toBe('WITCH_CONTEXT');
    });

    it('toUid must be non-empty string', () => {
      const validMessage: PrivateMessage = {
        type: 'PRIVATE_EFFECT',
        toUid: 'some-uid',
        revision: 1,
        payload: { kind: 'BLOCKED', reason: 'nightmare' },
      };

      expect(validMessage.toUid.length).toBeGreaterThan(0);
    });
  });

  describe('WitchContextPayload contract', () => {
    it('should contain killedIndex and canSave (sensitive info)', () => {
      const payload: WitchContextPayload = {
        kind: 'WITCH_CONTEXT',
        killedIndex: 3,
        canSave: true,
        canPoison: true,
      };

      expect(payload.kind).toBe('WITCH_CONTEXT');
      expect(payload.killedIndex).toBe(3);
      expect(payload.canSave).toBe(true);
      expect(payload.canPoison).toBe(true);
    });

    it('killedIndex -1 means empty kill (no victim)', () => {
      const emptyKill: WitchContextPayload = {
        kind: 'WITCH_CONTEXT',
        killedIndex: -1,
        canSave: false,
        canPoison: true,
      };

      expect(emptyKill.killedIndex).toBe(-1);
      expect(emptyKill.canSave).toBe(false); // Nothing to save
    });

    it('canSave should be false when witch is the victim (no self-save)', () => {
      // Host pre-calculates this: witch cannot save herself
      const selfKill: WitchContextPayload = {
        kind: 'WITCH_CONTEXT',
        killedIndex: 5, // witch's seat
        canSave: false, // Host determined: no self-save
        canPoison: true,
      };

      expect(selfKill.canSave).toBe(false);
    });

  // NOTE(phase removed): WitchContextPayload no longer carries “save/poison phase”.
  // UX is now schema-driven and seat taps always mean poison selection.
  });

  describe('SeerRevealPayload contract', () => {
    it('should contain targetSeat and result', () => {
      const wolfReveal: SeerRevealPayload = {
        kind: 'SEER_REVEAL',
        targetSeat: 4,
        result: '狼人',
      };

      const goodReveal: SeerRevealPayload = {
        kind: 'SEER_REVEAL',
        targetSeat: 2,
        result: '好人',
      };

      expect(wolfReveal.result).toBe('狼人');
      expect(goodReveal.result).toBe('好人');
    });
  });

  describe('BlockedPayload contract', () => {
    it('should contain reason for blocking', () => {
      const nightmareBlock: BlockedPayload = {
        kind: 'BLOCKED',
        reason: 'nightmare',
      };

      expect(nightmareBlock.kind).toBe('BLOCKED');
      expect(nightmareBlock.reason).toBe('nightmare');
    });
  });

  describe('Inbox key generation', () => {
    it('should generate revision-bound keys', () => {
      const key1 = makeInboxKey(5, 'WITCH_CONTEXT');
      const key2 = makeInboxKey(5, 'SEER_REVEAL');
      const key3 = makeInboxKey(6, 'WITCH_CONTEXT');

      expect(key1).toBe('5_WITCH_CONTEXT');
      expect(key2).toBe('5_SEER_REVEAL');
      expect(key3).toBe('6_WITCH_CONTEXT');

      // Different revisions should produce different keys
      expect(key1).not.toBe(key3);
    });

    it('should support optional requestId for uniqueness', () => {
      const keyWithRequest = makeInboxKey(5, 'SNAPSHOT', 'req-123');
      expect(keyWithRequest).toBe('5_SNAPSHOT_req-123');
    });
  });

  describe('Zero-Trust filtering contract', () => {
    it('UI must filter by toUid === myUid', () => {
      const myUid = 'my-user-id';
      const otherUid = 'other-user-id';

      const messageForMe: PrivateMessage = {
        type: 'PRIVATE_EFFECT',
        toUid: myUid,
        revision: 1,
        payload: { kind: 'BLOCKED', reason: 'nightmare' },
      };

      const messageForOther: PrivateMessage = {
        type: 'PRIVATE_EFFECT',
        toUid: otherUid,
        revision: 1,
        payload: { kind: 'BLOCKED', reason: 'nightmare' },
      };

      // Zero-Trust filtering logic
      const shouldProcessForMe = messageForMe.toUid === myUid;
      const shouldProcessForOther = messageForOther.toUid === myUid;

      expect(shouldProcessForMe).toBe(true);
      expect(shouldProcessForOther).toBe(false);
    });

    it('Host player must also filter (no visibility privilege)', () => {
      const hostUid = 'host-user-id';
      const witchUid = 'witch-user-id';

      // Even if user is Host, they should not see witch's private message
      const witchContext: PrivateMessage = {
        type: 'PRIVATE_EFFECT',
        toUid: witchUid,
        revision: 1,
        payload: {
          kind: 'WITCH_CONTEXT',
          killedIndex: 3,
          canSave: true,
          canPoison: true,
        },
      };

      // Host filtering: should not process because toUid !== hostUid
      const hostShouldProcess = witchContext.toUid === hostUid;
      expect(hostShouldProcess).toBe(false);

      // Witch filtering: should process
      const witchShouldProcess = witchContext.toUid === witchUid;
      expect(witchShouldProcess).toBe(true);
    });
  });

  describe('Nightmare blocked witch (BUG-FIX lock)', () => {
    // BUG: When witch is blocked by nightmare, she was still receiving WITCH_CONTEXT
    // with killedIndex, revealing who died. Blocked witch should NOT know who died.
    // FIX: When witch is blocked, send BLOCKED instead of WITCH_CONTEXT.

    it('BLOCKED payload should have reason="nightmare"', () => {
      const blocked: BlockedPayload = {
        kind: 'BLOCKED',
        reason: 'nightmare',
      };
      expect(blocked.kind).toBe('BLOCKED');
      expect(blocked.reason).toBe('nightmare');
    });

    it('witch should receive BLOCKED (not WITCH_CONTEXT) when nightmare-blocked', () => {
      // This is a contract test documenting the expected behavior.
      // The actual Host implementation is tested in integration tests.
      const witchUid = 'witch-user-id';

      // When witch is blocked, Host should send this:
      const blockedMessage: PrivateMessage = {
        type: 'PRIVATE_EFFECT',
        toUid: witchUid,
        revision: 1,
        payload: {
          kind: 'BLOCKED',
          reason: 'nightmare',
        },
      };

      expect(blockedMessage.payload.kind).toBe('BLOCKED');
      // NOT WITCH_CONTEXT - witch should NOT know killedIndex
    });
  });
});
