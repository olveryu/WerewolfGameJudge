/**
 * avatar.test.ts - Tests for default avatar selection
 *
 * Verifies:
 * 1. Stability: same (roomId, uid) always returns same avatar index
 * 2. Non-collision: different uids in same room get different avatars (when count allows)
 * 3. Room variety: same uid in different rooms may get different avatars
 */

import {
  getDefaultAvatarIndex,
  getAvatarByUid,
  getAvatarImageByIndex,
  AVATAR_COUNT,
} from '@/utils/avatar';

// AVATAR_COUNT is exported from avatar.ts for test assertions only
// (not re-exported from utils/index.ts since no production code needs it)

describe('getDefaultAvatarIndex', () => {
  describe('stability', () => {
    it('returns same index for same (roomId, uid) across multiple calls', () => {
      const roomId = 'room-1234';
      const uid = 'user-abc123';

      const index1 = getDefaultAvatarIndex(roomId, uid);
      const index2 = getDefaultAvatarIndex(roomId, uid);
      const index3 = getDefaultAvatarIndex(roomId, uid);

      expect(index1).toBe(index2);
      expect(index2).toBe(index3);
    });

    it('returns same index regardless of call order', () => {
      const roomId = 'room-5678';
      const uid = 'user-xyz789';

      // Call with different arguments first
      getDefaultAvatarIndex('other-room', 'other-user');
      getDefaultAvatarIndex(roomId, 'different-user');

      const index1 = getDefaultAvatarIndex(roomId, uid);

      // Call with different arguments again
      getDefaultAvatarIndex('another-room', uid);

      const index2 = getDefaultAvatarIndex(roomId, uid);

      expect(index1).toBe(index2);
    });

    it('returns valid index in range [0, AVATAR_COUNT)', () => {
      const testCases = [
        { roomId: 'room-1', uid: 'user-1' },
        { roomId: 'room-999', uid: 'user-long-id-12345' },
        { roomId: '', uid: '' },
        { roomId: 'a', uid: 'b' },
        { roomId: '中文房间', uid: '玩家一' },
      ];

      for (const { roomId, uid } of testCases) {
        const index = getDefaultAvatarIndex(roomId, uid);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(AVATAR_COUNT);
      }
    });
  });

  describe('non-collision within same room (best effort)', () => {
    it('assigns different avatars to 12 different uids in same room (high probability)', () => {
      // Precondition: we have at least 12 avatars (actually 29)
      expect(AVATAR_COUNT).toBeGreaterThanOrEqual(12);

      const roomId = 'room-test-collision';
      const uids = Array.from({ length: 12 }, (_, i) => `player-${i + 1}`);

      const indices = uids.map((uid) => getDefaultAvatarIndex(roomId, uid));
      const uniqueIndices = new Set(indices);

      // With 29 avatars and 12 players, expect at least 10 unique (allow up to 2 collisions)
      // This is probabilistic but should pass reliably with a good hash
      expect(uniqueIndices.size).toBeGreaterThanOrEqual(10);
    });

    it('assigns mostly different avatars to 8 different uids in same room', () => {
      const roomId = 'room-8players';
      // Use diverse UIDs
      const uids = [
        'abc123XYZ789',
        'user_2_test',
        'player-three',
        'fourthPerson',
        '5th_uid_here',
        'number-six-6',
        'seven777777',
        'eight888888',
      ];

      const indices = uids.map((uid) => getDefaultAvatarIndex(roomId, uid));
      const uniqueIndices = new Set(indices);

      // Expect at least 6 unique out of 8 (allow up to 2 collisions)
      expect(uniqueIndices.size).toBeGreaterThanOrEqual(6);
    });

    it('maintains mostly unique avatars across multiple room instances', () => {
      const rooms = ['room-A', 'room-B', 'room-C'];
      const uids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

      for (const roomId of rooms) {
        const indices = uids.map((uid) => getDefaultAvatarIndex(roomId, uid));
        const uniqueIndices = new Set(indices);
        // Expect at least 5 unique out of 6
        expect(uniqueIndices.size).toBeGreaterThanOrEqual(5);
      }
    });
  });

  describe('room variety', () => {
    it('same uid may get different avatars in different rooms', () => {
      const uid = 'consistent-user';
      const rooms = ['room-alpha', 'room-beta', 'room-gamma', 'room-delta', 'room-epsilon'];

      const indices = rooms.map((roomId) => getDefaultAvatarIndex(roomId, uid));
      const uniqueIndices = new Set(indices);

      // Should have at least 2 different avatars across 5 rooms (probabilistic but very likely)
      // With djb2 hash, this is essentially guaranteed
      expect(uniqueIndices.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('seat independence', () => {
    it('avatar does not depend on any seat number parameter', () => {
      // This test verifies the design: getDefaultAvatarIndex only takes roomId and uid
      // There's no seatNumber parameter, so avatar is inherently seat-independent
      const roomId = 'room-seat-test';
      const uid = 'player-moving-seats';

      // Get avatar index
      const index = getDefaultAvatarIndex(roomId, uid);

      // Simulate "changing seats" by calling again (in the new design, seat is not a factor)
      // The function signature doesn't even accept seatNumber
      const indexAfterMove = getDefaultAvatarIndex(roomId, uid);

      expect(index).toBe(indexAfterMove);
    });
  });
});

describe('getAvatarByUid', () => {
  it('returns consistent image source for same (roomId, uid)', () => {
    const roomId = 'room-img-test';
    const uid = 'user-img-test';

    const img1 = getAvatarByUid(roomId, uid);
    const img2 = getAvatarByUid(roomId, uid);

    expect(img1).toBe(img2);
  });

  it('returns a valid image source', () => {
    const result = getAvatarByUid('any-room', 'any-user');
    // In Jest/Node environment, require() may return object or number depending on config
    // The important thing is it returns something truthy and consistent
    expect(result).toBeTruthy();
  });
});

describe('getAvatarImageByIndex', () => {
  it('returns same image for same index', () => {
    const img1 = getAvatarImageByIndex(5);
    const img2 = getAvatarImageByIndex(5);
    expect(img1).toBe(img2);
  });

  it('handles negative index by taking absolute value', () => {
    const imgPositive = getAvatarImageByIndex(5);
    const imgNegative = getAvatarImageByIndex(-5);
    expect(imgPositive).toBe(imgNegative);
  });

  it('handles out-of-range index by wrapping with modulo', () => {
    const imgBase = getAvatarImageByIndex(0);
    const imgWrapped = getAvatarImageByIndex(AVATAR_COUNT);
    expect(imgBase).toBe(imgWrapped);
  });
});
