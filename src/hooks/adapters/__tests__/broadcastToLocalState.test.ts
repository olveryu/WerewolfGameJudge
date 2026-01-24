import { broadcastToLocalState } from '../broadcastToLocalState';
import type { BroadcastGameState } from '../../../services/protocol/types';

function makeBaseBroadcastState(overrides: Partial<BroadcastGameState> = {}): BroadcastGameState {
  return {
    roomCode: 'ROOM',
    hostUid: 'HOST',
    status: 'ongoing',
    templateRoles: ['wolf', 'witch', 'seer'] as any,
    players: {
      0: { uid: 'p0', seatNumber: 0, displayName: 'P1', hasViewedRole: true, role: 'wolf' as any },
      1: { uid: 'p1', seatNumber: 1, displayName: 'P2', hasViewedRole: true, role: 'witch' as any },
      2: { uid: 'p2', seatNumber: 2, displayName: 'P3', hasViewedRole: true, role: 'seer' as any },
    },
    currentActionerIndex: 0,
    isAudioPlaying: false,
    ...overrides,
  };
}

describe('broadcastToLocalState', () => {
  it('maps core fields and optional role contexts', () => {
    const broadcast = makeBaseBroadcastState({
      currentStepId: 'seerCheck' as any,
  currentNightResults: { wolfVotesBySeat: { '0': 2 } } as any,
      witchContext: { killedIndex: 2, canSave: true, canPoison: true },
      seerReveal: { targetSeat: 0, result: '狼人' },
      actionRejected: { action: 'seerCheck', reason: 'invalid_step', targetUid: 'p2', rejectionId: 'test-1' },
    });

    const local = broadcastToLocalState(broadcast);

    expect(local.roomCode).toBe('ROOM');
    expect(local.hostUid).toBe('HOST');
    expect(local.status).toBe('ongoing');
    expect(local.currentStepId).toBe('seerCheck');

    expect(local.players.get(0)?.uid).toBe('p0');
    expect(local.players.get(1)?.uid).toBe('p1');

    expect(local.wolfVotes.get(0)).toBe(2);

    expect(local.witchContext).toEqual({ killedIndex: 2, canSave: true, canPoison: true });
    expect(local.seerReveal).toEqual({ targetSeat: 0, result: '狼人' });
    expect(local.actionRejected).toEqual({ action: 'seerCheck', reason: 'invalid_step', targetUid: 'p2', rejectionId: 'test-1' });
  });

  it('maps BroadcastGameState.actions into LocalGameState.actions (all Night-1 schemas)', () => {
    const broadcast = makeBaseBroadcastState({
      // swap lives in currentNightResults
      currentNightResults: { swappedSeats: [3, 4] } as any,
      witchContext: { killedIndex: 2, canSave: true, canPoison: true },
      actions: [
        { schemaId: 'seerCheck' as any, actorSeat: 2, targetSeat: 0, timestamp: 1 },
        { schemaId: 'guardProtect' as any, actorSeat: 0, targetSeat: 1, timestamp: 2 },
        { schemaId: 'psychicCheck' as any, actorSeat: 0, targetSeat: 2, timestamp: 3 },
        { schemaId: 'dreamcatcherDream' as any, actorSeat: 0, targetSeat: 1, timestamp: 4 },
        { schemaId: 'wolfQueenCharm' as any, actorSeat: 0, targetSeat: 2, timestamp: 5 },
        { schemaId: 'nightmareBlock' as any, actorSeat: 0, targetSeat: 1, timestamp: 6 },
        { schemaId: 'gargoyleCheck' as any, actorSeat: 0, targetSeat: 0, timestamp: 7 },
        { schemaId: 'wolfRobotLearn' as any, actorSeat: 0, targetSeat: 1, timestamp: 8 },
        { schemaId: 'slackerChooseIdol' as any, actorSeat: 0, targetSeat: 2, timestamp: 9 },
        // confirm
        { schemaId: 'hunterConfirm' as any, actorSeat: 0, timestamp: 10 },
        { schemaId: 'darkWolfKingConfirm' as any, actorSeat: 0, timestamp: 11 },
        // witch compound: choose save by targeting killedIndex.
        { schemaId: 'witchAction' as any, actorSeat: 1, targetSeat: 2, timestamp: 12 },
      ],
    });

    const local = broadcastToLocalState(broadcast);

    expect(local.actions.get('seer' as any)).toEqual({ kind: 'target', targetSeat: 0 });
    expect(local.actions.get('guard' as any)).toEqual({ kind: 'target', targetSeat: 1 });
    expect(local.actions.get('psychic' as any)).toEqual({ kind: 'target', targetSeat: 2 });
    expect(local.actions.get('dreamcatcher' as any)).toEqual({ kind: 'target', targetSeat: 1 });
    expect(local.actions.get('wolfQueen' as any)).toEqual({ kind: 'target', targetSeat: 2 });
    expect(local.actions.get('nightmare' as any)).toEqual({ kind: 'target', targetSeat: 1 });
    expect(local.actions.get('gargoyle' as any)).toEqual({ kind: 'target', targetSeat: 0 });
    expect(local.actions.get('wolfRobot' as any)).toEqual({ kind: 'target', targetSeat: 1 });
    expect(local.actions.get('slacker' as any)).toEqual({ kind: 'target', targetSeat: 2 });
    expect(local.actions.get('hunter' as any)).toEqual({ kind: 'none' });
    expect(local.actions.get('darkWolfKing' as any)).toEqual({ kind: 'none' });
    expect(local.actions.get('magician' as any)).toEqual({ kind: 'magicianSwap', firstSeat: 3, secondSeat: 4 });
    expect(local.actions.get('witch' as any)).toEqual({ kind: 'witch', witchAction: { kind: 'save', targetSeat: 2 } });
  });

  it('maps witchAction as poison when target != killedIndex', () => {
    const broadcast = makeBaseBroadcastState({
      witchContext: { killedIndex: 2, canSave: true, canPoison: true },
      actions: [{ schemaId: 'witchAction' as any, actorSeat: 1, targetSeat: 0, timestamp: 1 }],
    });

    const local = broadcastToLocalState(broadcast);
    expect(local.actions.get('witch' as any)).toEqual({ kind: 'witch', witchAction: { kind: 'poison', targetSeat: 0 } });
  });

  it('maps witchAction as none when no targetSeat', () => {
    const broadcast = makeBaseBroadcastState({
      witchContext: { killedIndex: 2, canSave: true, canPoison: true },
      actions: [{ schemaId: 'witchAction' as any, actorSeat: 1, timestamp: 1 }],
    });

    const local = broadcastToLocalState(broadcast);
    expect(local.actions.get('witch' as any)).toEqual({ kind: 'witch', witchAction: { kind: 'none' } });
  });
});
