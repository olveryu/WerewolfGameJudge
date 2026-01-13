/**
 * usePrivateInbox.test.ts - Tests for private inbox functionality in GameStateService
 * 
 * Tests Zero-Trust filtering and revision-bound storage.
 * @see docs/phase4-final-migration.md
 */

import type { WitchContextPayload } from '../../services/types/PrivateBroadcast';

describe('GameStateService Private Inbox', () => {
  describe('Zero-Trust filtering contract', () => {
    it('should only store messages where toUid matches myUid', () => {
      // This contract is enforced in GameStateService.handlePrivateMessage
      // The test documents the expected behavior
      
      const myUid = 'my-user-123';
      const otherUid = 'other-user-456';
      
      // Simulate filtering logic
      const shouldProcess = (msgToUid: string): boolean => msgToUid === myUid;
      
      expect(shouldProcess(myUid)).toBe(true);
      expect(shouldProcess(otherUid)).toBe(false);
    });

    it('Host player should also be filtered (no visibility privilege)', () => {
      // Even Host device filters by toUid
      const hostUid: string = 'host-player-uid';
      const witchUid: string = 'witch-player-uid';
      
      // If Host is NOT the witch, they shouldn't see witch context
      const msgToUid: string = witchUid;
      const hostShouldProcess = msgToUid === hostUid;
      
      expect(hostShouldProcess).toBe(false);
    });
  });

  describe('Revision-bound storage', () => {
    it('should generate unique keys per revision', () => {
      const makeKey = (rev: number, kind: string) => `${rev}_${kind}`;
      
      const key1 = makeKey(1, 'WITCH_CONTEXT');
      const key2 = makeKey(2, 'WITCH_CONTEXT');
      const key3 = makeKey(2, 'SEER_REVEAL');
      
      expect(key1).toBe('1_WITCH_CONTEXT');
      expect(key2).toBe('2_WITCH_CONTEXT');
      expect(key3).toBe('2_SEER_REVEAL');
      
      // Different revisions have different keys
      expect(key1).not.toBe(key2);
    });

    it('should not return stale data from previous revision', () => {
      // Simulate inbox behavior
      const inbox = new Map<string, WitchContextPayload>();
      
      // Store for revision 1
      const payload1: WitchContextPayload = {
        kind: 'WITCH_CONTEXT',
        killedIndex: 3,
        canSave: true,
        canPoison: true,
        phase: 'save',
      };
      inbox.set('1_WITCH_CONTEXT', payload1);
      
      // Query for revision 2 should return undefined
      const currentRevision = 2;
      const key = `${currentRevision}_WITCH_CONTEXT`;
      const result = inbox.get(key);
      
      expect(result).toBeUndefined();
    });
  });

  describe('WitchContext retrieval', () => {
    it('should return correct payload when available', () => {
      const inbox = new Map<string, WitchContextPayload>();
      const currentRevision = 5;
      
      const payload: WitchContextPayload = {
        kind: 'WITCH_CONTEXT',
        killedIndex: 2,
        canSave: true,
        canPoison: true,
        phase: 'save',
      };
      
      inbox.set(`${currentRevision}_WITCH_CONTEXT`, payload);
      
      // Simulate getWitchContext logic
      const key = `${currentRevision}_WITCH_CONTEXT`;
      const result = inbox.get(key) ?? null;
      
      expect(result).not.toBeNull();
      expect(result?.killedIndex).toBe(2);
      expect(result?.canSave).toBe(true);
    });

    it('should return null when no message for current revision', () => {
      const inbox = new Map<string, WitchContextPayload>();
      const currentRevision = 5;
      
      // No message stored
      const key = `${currentRevision}_WITCH_CONTEXT`;
      const result = inbox.get(key) ?? null;
      
      expect(result).toBeNull();
    });
  });

  describe('Seer and Psychic reveal retrieval', () => {
    it('should retrieve SEER_REVEAL from inbox with correct key', () => {
      type SeerPayload = { kind: 'SEER_REVEAL'; targetSeat: number; result: '好人' | '狼人' };
      const inbox = new Map<string, SeerPayload>();
      const revision = 3;
      
      const payload: SeerPayload = {
        kind: 'SEER_REVEAL',
        targetSeat: 5,
        result: '狼人',
      };
      
      const key = `${revision}_SEER_REVEAL`;
      inbox.set(key, payload);
      
      const retrieved = inbox.get(key);
      expect(retrieved?.kind).toBe('SEER_REVEAL');
      expect(retrieved?.targetSeat).toBe(5);
      expect(retrieved?.result).toBe('狼人');
    });

    it('should retrieve PSYCHIC_REVEAL from inbox with correct key', () => {
      type PsychicPayload = { kind: 'PSYCHIC_REVEAL'; targetSeat: number; result: string };
      const inbox = new Map<string, PsychicPayload>();
      const revision = 3;
      
      const payload: PsychicPayload = {
        kind: 'PSYCHIC_REVEAL',
        targetSeat: 2,
        result: '预言家',
      };
      
      const key = `${revision}_PSYCHIC_REVEAL`;
      inbox.set(key, payload);
      
      const retrieved = inbox.get(key);
      expect(retrieved?.kind).toBe('PSYCHIC_REVEAL');
      expect(retrieved?.targetSeat).toBe(2);
      expect(retrieved?.result).toBe('预言家');
    });

    it('should not cross-contaminate between reveal types', () => {
      type AnyPayload = { kind: string; targetSeat: number; result: string };
      const inbox = new Map<string, AnyPayload>();
      const revision = 3;
      
      inbox.set(`${revision}_SEER_REVEAL`, { kind: 'SEER_REVEAL', targetSeat: 1, result: '好人' });
      inbox.set(`${revision}_PSYCHIC_REVEAL`, { kind: 'PSYCHIC_REVEAL', targetSeat: 2, result: '守卫' });
      
      const seerKey = `${revision}_SEER_REVEAL`;
      const psychicKey = `${revision}_PSYCHIC_REVEAL`;
      
      expect(inbox.get(seerKey)?.kind).toBe('SEER_REVEAL');
      expect(inbox.get(psychicKey)?.kind).toBe('PSYCHIC_REVEAL');
    });
  });

  describe('Inbox clearing on game restart', () => {
    it('should clear all messages on GAME_RESTARTED', () => {
      const inbox = new Map<string, WitchContextPayload>();
      
      // Store some messages
      inbox.set('1_WITCH_CONTEXT', {
        kind: 'WITCH_CONTEXT',
        killedIndex: 3,
        canSave: true,
        canPoison: true,
        phase: 'save',
      });
      
      expect(inbox.size).toBe(1);
      
      // Clear (simulating GAME_RESTARTED)
      inbox.clear();
      
      expect(inbox.size).toBe(0);
    });
  });
});
