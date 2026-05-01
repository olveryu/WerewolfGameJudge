/**
 * ActionHandler Tests
 */

import { handleSubmitAction } from '@werewolf/game-engine/engine/handlers/actionHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import type { SubmitActionIntent } from '@werewolf/game-engine/engine/intents/types';
import type {
  ApplyResolverResultAction,
  RecordActionAction,
} from '@werewolf/game-engine/engine/reducer/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

import { expectSuccess } from './handlerTestUtils';

const baseContext: HandlerContext = {
  myUserId: 'HOST',
  mySeat: 0,
  state: {
    roomCode: 'ROOM',
    hostUserId: 'HOST',
    status: GameStatus.Ongoing,
    templateRoles: ['seer', 'villager'],
    players: {
      0: { userId: 'p0', seat: 0, role: 'seer', hasViewedRole: true },
      1: { userId: 'p1', seat: 1, role: 'villager', hasViewedRole: true },
    },
    roster: {},
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    currentStepIndex: 0,
    isAudioPlaying: false,
    currentStepId: 'seerCheck',
    currentNightResults: {},
  },
};

jest.mock('@werewolf/game-engine/resolvers', () => ({
  RESOLVERS: {
    seerCheck: jest.fn(() => ({ valid: true, updates: { someUpdate: true } })),
  },
}));

jest.mock('@werewolf/game-engine/models/roles/spec', () => ({
  NIGHT_STEPS: [{ id: 'seerCheck', roleId: 'seer' }],
  SCHEMAS: { seerCheck: { id: 'seerCheck', kind: 'chooseSeat' } }, // PR4: 必须 mock SCHEMAS
}));

describe('handleSubmitAction', () => {
  it('does not fabricate targetSeat=0 when target is null', () => {
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: null },
    };
    const result = handleSubmitAction(intent, baseContext);

    const success = expectSuccess(result);
    // There should be a RECORD_ACTION with targetSeat undefined.
    const record = success.actions.find((a): a is RecordActionAction => a.type === 'RECORD_ACTION');
    expect(record).toBeDefined();
    expect(record!.payload.action.targetSeat).toBeUndefined();

    // APPLY_RESOLVER_RESULT should not contain a reveal with targetSeat=0.
    const apply = success.actions.find(
      (a): a is ApplyResolverResultAction => a.type === 'APPLY_RESOLVER_RESULT',
    );
    expect(apply).toBeDefined();
    expect(apply!.payload.seerReveal).toBeUndefined();
  });

  it('uses injected timestamp when provided', () => {
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: { timestamp: 123 } },
    };
    const result = handleSubmitAction(intent, baseContext);

    const success = expectSuccess(result);
    const record = success.actions.find((a): a is RecordActionAction => a.type === 'RECORD_ACTION');
    expect(record).toBeDefined();
    expect(record!.payload.action.timestamp).toBe(123);
  });
});
