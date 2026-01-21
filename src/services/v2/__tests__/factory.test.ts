/**
 * v2 Factory Tests
 */

import { createGameServices, destroyGameServices } from '../factory';

const mockBroadcastService = {
  broadcastAsHost: jest.fn().mockResolvedValue(undefined),
  sendToHost: jest.fn().mockResolvedValue(undefined),
} as any;

describe('v2 factory', () => {
  it('creates a stable seat map (players[0..N-1] exist and are null)', async () => {
    const services = createGameServices({
      roomCode: 'ROOM1',
      hostUid: 'HOST1',
      isHost: true,
      templateRoles: ['wolf', 'villager'] as any,
      broadcastService: mockBroadcastService,
    });

    const state = services.store.getState();
    expect(state).not.toBeNull();
    expect(state!.players[0]).toBeNull();
    expect(state!.players[1]).toBeNull();

    await destroyGameServices(services);
  });
});
