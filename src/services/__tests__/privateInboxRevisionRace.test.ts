import GameStateService from '../GameStateService';
import type { PrivateMessage } from '../types/PrivateBroadcast';

/**
 * Regression: In web runtime, STATE_UPDATE can advance local stateRevision between
 * PRIVATE_EFFECT arrival and UI polling, causing timeouts if inbox keying uses
 * stateRevision instead of msg.revision.
 */

describe('GameStateService private inbox revision race', () => {
  it('should read SEER_REVEAL even if stateRevision advanced after message arrival', () => {
    const svc = GameStateService.getInstance() as any;

    // Arrange a logged-in player uid so private messages are accepted.
    svc.myUid = 'seer-uid';

    // Simulate state revision being advanced by host STATE_UPDATE
    svc.stateRevision = 10;

    const msg: PrivateMessage = {
      type: 'PRIVATE_EFFECT',
      toUid: 'seer-uid',
      revision: 10,
      payload: {
        kind: 'SEER_REVEAL',
        targetSeat: 1,
        result: '狼人',
      },
    };

    // Act: private message arrives when stateRevision matches
    svc.handlePrivateMessage(msg);

    // Race: state update arrives afterwards and bumps local revision
    svc.stateRevision = 11;

    // Assert: even though stateRevision advanced, reveal is still retrievable
    expect(svc.getSeerReveal()).toEqual({
      kind: 'SEER_REVEAL',
      targetSeat: 1,
      result: '狼人',
    });
  });

  it('should read ACTION_REJECTED even if stateRevision advanced after message arrival', () => {
    const svc = GameStateService.getInstance() as any;

    svc.myUid = 'player-uid';
    svc.stateRevision = 20;

    const msg: PrivateMessage = {
      type: 'PRIVATE_EFFECT',
      toUid: 'player-uid',
      revision: 20,
      payload: {
        kind: 'ACTION_REJECTED',
        action: 'submitAction',
        reason: 'nope',
      },
    };

    svc.handlePrivateMessage(msg);
    svc.stateRevision = 21;

    expect(svc.getActionRejected()).toEqual({
      kind: 'ACTION_REJECTED',
      action: 'submitAction',
      reason: 'nope',
    });
  });
});
