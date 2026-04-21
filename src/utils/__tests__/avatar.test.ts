/**
 * avatar.test.ts - Tests for avatar selection public APIs
 *
 * Verifies through public APIs (getUniqueAvatarMap, getAvatarImageByIndex):
 * 1. Non-collision: getUniqueAvatarMap guarantees unique avatars in a room
 * 2. Index wrapping: getAvatarImageByIndex handles edge cases
 */

import * as fs from 'fs';
import * as path from 'path';

import { getAvatarImageByIndex, getUniqueAvatarMap } from '@/utils/avatar';

/** Number of avatar images — read from disk to stay in sync with static require list */
const avatarDir = path.resolve(__dirname, '../../../assets/avatars/raw');
const AVATAR_COUNT = fs.readdirSync(avatarDir).filter((f) => f.endsWith('.png')).length;

describe('getUniqueAvatarMap', () => {
  it('assigns unique avatar indices to 12 different uids in same room', () => {
    // Precondition: avatars > 12 players
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

    for (const userId of uids) {
      expect(map1.get(userId)).toBe(map2.get(userId));
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
