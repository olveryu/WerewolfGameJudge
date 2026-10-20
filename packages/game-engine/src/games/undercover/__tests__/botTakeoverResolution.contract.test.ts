/**
 * Bot Takeover Resolution — undercover scenario (bot wave PR-2).
 *
 * Runs the shared acting-seat propositions against the real
 * undercover engine. The probe command is undercover.role.viewed
 * in the viewing phase, whose commit event names the seat that
 * confirmed. Layout: host at seat 0, a human guest at seat 1, bots
 * filling seats 2-7.
 */

import type { CommandContext } from '../../../platform/engine';
import { dispatchCommand } from '../../../platform/engine/__tests__/engineSession';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
  REASON_USER_ACTOR_REQUIRED,
} from '../../../platform/protocol/reasons';
import {
  type ActingSeatProbe,
  type ActingSeatProbeActor,
  describeBotTakeoverResolution,
} from '../../../platform/room/__tests__/actingSeatScenarios';
import type { UndercoverCommand } from '../commands/types';
import { undercoverEngine } from '../engine';
import type { UndercoverState } from '../state/types';

const CONFIG = { numberOfPlayers: 8, hasBlank: true, category: 'all' } as const;

function user(userId: string, controlledSeat: number | null = null): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    commandId: 'probe',
    randomSeed: 'takeover-resolution',
    nowMs: 1000,
  };
}

function system(): CommandContext {
  return {
    actor: { kind: 'system', effectId: 'word-selection' },
    controlledSeat: null,
    commandId: 'complete',
    randomSeed: 'takeover-resolution',
    nowMs: 1200,
  };
}

function viewingState(): UndercoverState {
  let state = undercoverEngine.createInitialState(CONFIG, {
    roomCode: '1234',
    hostUserId: 'host',
    nowMs: 0,
    commandId: 'create',
  });
  const dispatch = (command: UndercoverCommand, context: CommandContext) =>
    dispatchCommand(undercoverEngine, state, command, context);
  state = dispatch(
    { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
    user('host'),
  );
  state = dispatch(
    { type: 'room.seat.take', seat: 1, profile: { displayName: 'Guest' } },
    user('guest'),
  );
  state = dispatch({ type: 'room.seat.fillBots' }, user('host'));
  state = dispatch({ type: 'undercover.roles.assign', shouldAllowRepeated: false }, user('host'));
  if (state.phase !== 'preparing') throw new Error('Expected preparing state');
  state = dispatch(
    {
      type: 'undercover.round.complete',
      roundId: state.pendingRound.roundId,
      wordPair: { id: 'pair-1', wordA: 'Milk', wordB: 'Soy milk', category: 'food' },
    },
    system(),
  );
  if (state.phase !== 'viewing' || state.round === null) throw new Error('Expected viewing state');
  return state;
}

describeBotTakeoverResolution({
  game: 'undercover',
  hostUserId: 'host',
  hostSeat: 0,
  guestUserId: 'guest',
  guestSeat: 1,
  botSeat: 2,
  systemActorReason: REASON_USER_ACTOR_REQUIRED,
  unseatedReason: REASON_NOT_SEATED,
  makeSession() {
    const state = viewingState();
    const roundId = state.round!.roundId;
    return {
      probe(actor: ActingSeatProbeActor): ActingSeatProbe {
        const context: CommandContext =
          actor.kind === 'system'
            ? { ...system(), commandId: 'probe' }
            : user(actor.userId, actor.controlledSeat);
        const decision = undercoverEngine.decide(
          state,
          { type: 'undercover.role.viewed', roundId },
          context,
        );
        if (decision.kind === 'reject') return { kind: 'rejected', reason: decision.reason };
        const event = decision.events.find(
          (entry): entry is Extract<typeof entry, { type: 'undercover.round.confirmed' }> =>
            entry.type === 'undercover.round.confirmed',
        );
        if (event === undefined) throw new Error('Confirm commit carried no confirmed event');
        return { kind: 'resolved', seat: event.seat };
      },
    };
  },
});

// D-1: host commands go through the platform host gate, so a host acting
// through a controlled bot seat is rejected like in every other game.
// (Confirm above is unaffected: it resolves through the acting seat.)
describe('undercover host gate under bot takeover', () => {
  it('rejects a host round command from a controlled seat', () => {
    const state = viewingState();
    const decision = undercoverEngine.decide(
      state,
      { type: 'undercover.bots.markAllBotsViewed', roundId: state.round!.roundId },
      user('host', 2),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED });
  });

  it('rejects a host reveal from a controlled seat', () => {
    const state = viewingState();
    const decision = undercoverEngine.decide(
      state,
      { type: 'undercover.round.reveal', roundId: state.round!.roundId, seat: 3 },
      user('host', 2),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED });
  });

  it('rejects a host room command from a controlled seat', () => {
    const state = undercoverEngine.createInitialState(CONFIG, {
      roomCode: '1234',
      hostUserId: 'host',
      nowMs: 0,
      commandId: 'create',
    });
    const decision = undercoverEngine.decide(
      state,
      { type: 'undercover.config.update', config: { ...CONFIG, hasBlank: false } },
      user('host', 2),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED });
  });

  it('rejects a non-host round command with the not-host reason', () => {
    const state = viewingState();
    const decision = undercoverEngine.decide(
      state,
      { type: 'undercover.bots.markAllBotsViewed', roundId: state.round!.roundId },
      user('guest'),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
  });

  it('admits the uncontrolled host round command', () => {
    const state = viewingState();
    const decision = undercoverEngine.decide(
      state,
      { type: 'undercover.bots.markAllBotsViewed', roundId: state.round!.roundId },
      user('host'),
    );
    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit') {
      expect(
        decision.events.filter((event) => event.type === 'undercover.round.confirmed'),
      ).toHaveLength(6);
    }
  });
});
