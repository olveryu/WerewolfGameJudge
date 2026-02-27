/**
 * avatar.test.ts - Tests for avatar selection public APIs
 *
 * Verifies through public APIs (getAvatarByUid, getUniqueAvatarMap, getAvatarImageByIndex):
 * 1. Stability: same (roomId, uid) always returns same avatar
 * 2. Non-collision: getUniqueAvatarMap guarantees unique avatars in a room
 * 3. Room variety: same uid in different rooms may get different avatars
 * 4. Index wrapping: getAvatarImageByIndex handles edge cases
 */

import { getAvatarByUid, getAvatarImageByIndex, getUniqueAvatarMap } from '@/utils/avatar';

/** Number of avatar images (56 dark fantasy portraits) */
const AVATAR_COUNT = 56;

describe('getAvatarByUid', () => {
  describe('stability', () => {
    it('returns same image for same (roomId, uid) across multiple calls', () => {
      const roomId = 'room-1234';
      const uid = 'user-abc123';

      const img1 = getAvatarByUid(roomId, uid);
      const img2 = getAvatarByUid(roomId, uid);
      const img3 = getAvatarByUid(roomId, uid);

      expect(img1).toBe(img2);
      expect(img2).toBe(img3);
    });

    it('returns same image regardless of call order', () => {
      const roomId = 'room-5678';
      const uid = 'user-xyz789';

      // Call with different arguments first
      getAvatarByUid('other-room', 'other-user');
      getAvatarByUid(roomId, 'different-user');

      const img1 = getAvatarByUid(roomId, uid);

      // Call with different arguments again
      getAvatarByUid('another-room', uid);

      const img2 = getAvatarByUid(roomId, uid);

      expect(img1).toBe(img2);
    });

    it('returns a valid (truthy) image source for various inputs', () => {
      const testCases = [
        { roomId: 'room-1', uid: 'user-1' },
        { roomId: 'room-999', uid: 'user-long-id-12345' },
        { roomId: '', uid: '' },
        { roomId: 'a', uid: 'b' },
        { roomId: '中文房间', uid: '玩家一' },
      ];

      for (const { roomId, uid } of testCases) {
        const img = getAvatarByUid(roomId, uid);
        expect(img).toBeTruthy();
      }
    });
  });

  describe('room variety', () => {
    it('same uid may get different avatars in different rooms', () => {
      const uid = 'consistent-user';
      const rooms = ['room-alpha', 'room-beta', 'room-gamma', 'room-delta', 'room-epsilon'];

      const images = rooms.map((roomId) => getAvatarByUid(roomId, uid));
      const uniqueImages = new Set(images);

      // Should have at least 2 different avatars across 5 rooms (probabilistic but very likely)
      expect(uniqueImages.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('seat independence', () => {
    it('avatar does not depend on any seat number parameter', () => {
      // getAvatarByUid only takes roomId and uid — no seatNumber parameter
      const roomId = 'room-seat-test';
      const uid = 'player-moving-seats';

      const img = getAvatarByUid(roomId, uid);
      const imgAfterMove = getAvatarByUid(roomId, uid);

      expect(img).toBe(imgAfterMove);
    });
  });
});

describe('getUniqueAvatarMap', () => {
  it('assigns unique avatar indices to 12 different uids in same room', () => {
    // Precondition: 56 avatars > 12 players
    expect(AVATAR_COUNT).toBeGreaterThanOrEqual(12);

    const roomId = 'room-test-collision';
    const uids = Array.from({ length: 12 }, (_, i) => `player-${i + 1}`);

    const avatarMap = getUniqueAvatarMap(roomId, uids);

    // All 12 indices must be unique (guaranteed by linear probing)
    const indices = [...avatarMap.values()];
    const uniqueIndices = new Set(indices);
    expect(uniqueIndices.size).toBe(12);
  });

  it('assigns unique avatars to 8 diverse uids', () => {
    const roomId = 'room-8players';
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

    const avatarMap = getUniqueAvatarMap(roomId, uids);

    const indices = [...avatarMap.values()];
    const uniqueIndices = new Set(indices);
    expect(uniqueIndices.size).toBe(8);
  });

  it('maintains unique avatars across multiple room instances', () => {
    const rooms = ['room-A', 'room-B', 'room-C'];
    const uids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

    for (const roomId of rooms) {
      const avatarMap = getUniqueAvatarMap(roomId, uids);
      const indices = [...avatarMap.values()];
      const uniqueIndices = new Set(indices);
      expect(uniqueIndices.size).toBe(6);
    }
  });

  it('returns consistent mapping for same inputs', () => {
    const roomId = 'room-stable';
    const uids = ['u1', 'u2', 'u3'];

    const map1 = getUniqueAvatarMap(roomId, uids);
    const map2 = getUniqueAvatarMap(roomId, uids);

    for (const uid of uids) {
      expect(map1.get(uid)).toBe(map2.get(uid));
    }
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
