/**
 * Contract tests for createSeatProfile.
 *
 * Verifies output shape matches RoomSeatProfile and handles:
 * - null displayName → '匿名玩家'
 * - null optional fields → undefined (not null)
 * - anonymous users → no level
 * - equipped effect resolution via resolveEquippedRevealEffect
 */

import { type QueryClient } from '@tanstack/react-query';

import { createSeatProfile } from '../createSeatProfile';

function createUser(overrides = {}) {
  return {
    id: 'user1',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.png',
    avatarFrame: 'frame1',
    seatFlair: 'flair1',
    seatAnimation: 'anim1',
    nameStyle: 'style1',
    equippedEffect: 'tarot',
    isAnonymous: false,
    ...overrides,
  };
}

describe('createSeatProfile', () => {
  // Minimal QueryClient mock - only getQueryData is used
  const createMockQueryClient = () =>
    ({
      getQueryData: jest.fn().mockReturnValue(undefined),
    }) as unknown as QueryClient;

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createMockQueryClient();
  });

  it('builds profile with all fields', () => {
    const profile = createSeatProfile(createUser(), queryClient, 'ROOM1');
    expect(profile.displayName).toBe('Test User');
    expect(profile.avatarUrl).toBe('https://example.com/avatar.png');
    expect(profile.avatarFrame).toBe('frame1');
    expect(profile.seatFlair).toBe('flair1');
    expect(profile.seatAnimation).toBe('anim1');
    expect(profile.nameStyle).toBe('style1');
    expect(profile.revealEffect).toBe('tarot');
  });

  it('uses 匿名玩家 for null displayName', () => {
    const profile = createSeatProfile(createUser({ displayName: null }), queryClient, 'ROOM1');
    expect(profile.displayName).toBe('匿名玩家');
  });

  it('converts null optional fields to undefined', () => {
    const profile = createSeatProfile(
      createUser({
        avatarUrl: null,
        avatarFrame: null,
        seatFlair: null,
        seatAnimation: null,
        nameStyle: null,
        equippedEffect: null,
      }),
      queryClient,
      'ROOM1',
    );
    expect(profile.avatarUrl).toBeUndefined();
    expect(profile.avatarFrame).toBeUndefined();
    expect(profile.seatFlair).toBeUndefined();
    expect(profile.seatAnimation).toBeUndefined();
    expect(profile.nameStyle).toBeUndefined();
    expect(profile.revealEffect).toBeUndefined();
  });

  it('omits level for anonymous users', () => {
    const profile = createSeatProfile(createUser({ isAnonymous: true }), queryClient, 'ROOM1');
    expect(profile.level).toBeUndefined();
  });

  it('resolves invalid equipped effect to undefined', () => {
    const profile = createSeatProfile(
      createUser({ equippedEffect: 'invalid-effect' }),
      queryClient,
      'ROOM1',
    );
    expect(profile.revealEffect).toBeUndefined();
  });
});
