/**
 * Regression: when Host is also a reveal role (seer/psychic/gargoyle/wolfRobot),
 * Host must still receive its own PRIVATE_EFFECT messages.
 *
 * Bug: Host didn't register onHostBroadcast in initializeAsHost(), so even though
 * BroadcastService has broadcast.self=true, the host-side GameStateService never
 * handled PRIVATE_EFFECT and UI waitFor*Reveal() timed out.
 */

import GameStateService from '../GameStateService';
import BroadcastService from '../BroadcastService';
import type { PrivateMessage } from '../types/PrivateBroadcast';

describe('Host loopback: PRIVATE_EFFECT for host reveal roles', () => {
  it('host can receive SEER_REVEAL via handleHostBroadcast()', async () => {
    const svc = GameStateService.getInstance();

    const broadcastService = (svc as unknown as { broadcastService: BroadcastService }).broadcastService;

    // Minimal "joinRoom" mock: capture onHostBroadcast callback so we can simulate self-broadcast
    let onHostBroadcast: ((msg: any) => void) | null = null;
    jest.spyOn(broadcastService, 'joinRoom').mockImplementation(async (_roomCode, _userId, callbacks) => {
      onHostBroadcast = callbacks.onHostBroadcast ?? null;
    });

    // Avoid any actual channel sends
    jest.spyOn(broadcastService, 'broadcastAsHost').mockResolvedValue(undefined);

    // Boot host
    await svc.initializeAsHost('ROOM', 'host-uid', {
      name: 'T',
      numberOfPlayers: 2,
      roles: ['seer', 'villager'],
    });

    expect(typeof onHostBroadcast).toBe('function');

    const privateMsg: PrivateMessage = {
      type: 'PRIVATE_EFFECT',
      toUid: 'host-uid',
      revision: 123,
      payload: {
        kind: 'SEER_REVEAL',
        targetSeat: 0,
        result: '好人',
      },
    };

    // Simulate BroadcastService loopback delivering host broadcast to self
    onHostBroadcast!(privateMsg);

    // Host should read it from inbox now
    const reveal = svc.getSeerReveal();
    expect(reveal).toMatchObject({
      kind: 'SEER_REVEAL',
      targetSeat: 0,
      result: '好人',
    });
  });
});
