/**
 * ActionHandler Tests
 */

import { handleSubmitAction as executeSubmitAction } from '@game-judge/game-engine/games/werewolf/domain/handlers/actionHandler';
import type { HandlerContext } from '@game-judge/game-engine/games/werewolf/domain/handlers/types';
import type { SubmitActionIntent } from '@game-judge/game-engine/games/werewolf/domain/intents/types';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type {
  ApplyResolverResultAction,
  RecordActionAction,
} from '@game-judge/game-engine/games/werewolf/domain/reducer/types';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/state/version';

import { expectSuccess, TEST_HANDLER_EXECUTION } from './handlerTestUtils';

const baseContext: HandlerContext = {
  myUserId: 'HOST',
  mySeat: 0,
  state: {
    ...WEREWOLF_STATE_IDENTITY,
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
    seedWolfInfectionRevealAcks: [],
    currentStepIndex: 0,
    isAudioPlaying: false,
    currentStepId: 'seerCheck',
    currentNightResults: {},
  },
};

function handleSubmitAction(intent: SubmitActionIntent, context: HandlerContext) {
  return executeSubmitAction(intent, context, TEST_HANDLER_EXECUTION);
}

jest.mock('@game-judge/game-engine/games/werewolf/domain/resolvers', () => ({
  RESOLVERS: {
    seerCheck: jest.fn(() => ({ valid: true, updates: { someUpdate: true } })),
  },
}));

jest.mock('@game-judge/game-engine/games/werewolf/domain/models/roles/spec', () => ({
  NIGHT_STEPS: [{ id: 'seerCheck', roleId: 'seer' }],
  SCHEMAS: { seerCheck: { id: 'seerCheck', kind: 'chooseSeat' } }, // PR4: must mock SCHEMAS
}));

describe('handleSubmitAction', () => {
  it('does not fabricate targetSeat=0 when target is null', () => {
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', actionInput: { schemaId: 'seerCheck' } },
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

  it('uses the server execution timestamp instead of a client field', () => {
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', actionInput: { schemaId: 'seerCheck', target: 1 } },
    };
    const result = handleSubmitAction(intent, baseContext);

    const success = expectSuccess(result);
    const record = success.actions.find((a): a is RecordActionAction => a.type === 'RECORD_ACTION');
    expect(record).toBeDefined();
    expect(record!.payload.action.timestamp).toBe(TEST_HANDLER_EXECUTION.nowMs);
  });
});
