/**
 * ActionHandler Tests
 */

import { handleSubmitAction } from '@/services/engine/handlers/actionHandler';

const baseContext: any = {
  isHost: true,
  myUid: 'HOST',
  mySeat: 0,
  state: {
    roomCode: 'ROOM',
    hostUid: 'HOST',
    status: 'ongoing',
    templateRoles: ['seer', 'villager'],
    players: {
      0: { uid: 'p0', seatNumber: 0, role: 'seer', hasViewedRole: true },
      1: { uid: 'p1', seatNumber: 1, role: 'villager', hasViewedRole: true },
    },
    currentActionerIndex: 0,
    isAudioPlaying: false,
    currentStepId: 'seerCheck', // PR4: 必须设置 currentStepId
    currentNightResults: {},
  },
};

jest.mock('../../../night/resolvers', () => ({
  RESOLVERS: {
    seerCheck: jest.fn(() => ({ valid: true, updates: { someUpdate: true } })),
  },
}));

jest.mock('../../../../models/roles/spec', () => ({
  NIGHT_STEPS: [{ id: 'seerCheck', roleId: 'seer' }],
  SCHEMAS: { seerCheck: { id: 'seerCheck', kind: 'chooseSeat' } }, // PR4: 必须 mock SCHEMAS
}));

describe('handleSubmitAction', () => {
  it('does not fabricate targetSeat=0 when target is null', () => {
    const result = handleSubmitAction(
      {
        type: 'SUBMIT_ACTION',
        payload: { seat: 0, role: 'seer', target: null },
      } as any,
      baseContext,
    );

    expect(result.success).toBe(true);
    // There should be a RECORD_ACTION with targetSeat undefined.
    const record = result.actions.find(
      (a): a is { type: 'RECORD_ACTION'; payload: { action: any } } =>
        (a as any).type === 'RECORD_ACTION',
    );
    expect(record).toBeDefined();
    expect(record!.payload.action.targetSeat).toBeUndefined();

    // APPLY_RESOLVER_RESULT should not contain a reveal with targetSeat=0.
    const apply = result.actions.find(
      (a): a is { type: 'APPLY_RESOLVER_RESULT'; payload: any } =>
        (a as any).type === 'APPLY_RESOLVER_RESULT',
    );
    expect(apply).toBeDefined();
    expect(apply!.payload.seerReveal).toBeUndefined();
  });

  it('uses injected timestamp when provided', () => {
    const result = handleSubmitAction(
      {
        type: 'SUBMIT_ACTION',
        payload: { seat: 0, role: 'seer', target: 1, extra: { timestamp: 123 } },
      } as any,
      baseContext,
    );

    const record = result.actions.find(
      (a): a is { type: 'RECORD_ACTION'; payload: { action: any } } =>
        (a as any).type === 'RECORD_ACTION',
    );
    expect(record).toBeDefined();
    expect(record!.payload.action.timestamp).toBe(123);
  });
});
