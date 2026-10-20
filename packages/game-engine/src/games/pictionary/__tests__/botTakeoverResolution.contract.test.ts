/**
 * Bot Takeover Resolution — pictionary scenario (bot wave PR-2).
 *
 * Runs the shared acting-seat propositions against the real
 * pictionary engine. Two of its commands resolve an acting seat:
 * the relay task commands (through the shared relay machine) and
 * pictionary.drawing.reserve, whose own seat-task resolution this
 * wave switched to the shared resolver; the probe is the reserve
 * command in the settling phase, and its commit event names the
 * author seat. Layout: host at seat 0, a human guest at seat 1,
 * bots at seats 2-3.
 */

import type { CommandContext, CreateGameContext, Decision } from '../../../platform/engine';
import {
  type ActingSeatProbe,
  type ActingSeatProbeActor,
  describeBotTakeoverResolution,
} from '../../../platform/room/__tests__/actingSeatScenarios';
import { isBotSeat } from '../../../platform/room/seating';
import type { PictionaryCommandInput, PictionaryInternalCommand } from '../commands/types';
import type { PictionaryEvent } from '../domain/events';
import { REASON_PICTIONARY_TASK_INVALID } from '../domain/reasons';
import type { PictionaryEffect } from '../effects/types';
import { pictionaryEngine } from '../engine';
import {
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryExpectedKind,
  type PictionaryState,
} from '../state/types';
import { decidePictionaryInput } from './commandBinding';

const CREATE_CONTEXT: CreateGameContext = {
  roomCode: '2468',
  hostUserId: 'host',
  nowMs: 1_000,
  commandId: 'create-room',
};

function user(userId: string, controlledSeat: number | null = null, nowMs = 2_000): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs,
    commandId: `${userId}:${controlledSeat ?? 'self'}:${nowMs}`,
    randomSeed: 'pictionary-takeover-seed',
  };
}

/** The context a seat's own commands arrive with: humans act as themselves, bots via the host. */
function seatContext(state: PictionaryState, seat: number): CommandContext {
  if (!isBotSeat(state.roster, seat)) {
    return user(seat === 0 ? 'host' : 'guest');
  }
  return user('host', seat);
}

function applyDecision(
  state: PictionaryState,
  decision: Decision<PictionaryEvent, PictionaryEffect>,
): PictionaryState {
  if (decision.kind !== 'commit') {
    throw new Error(`Expected committed Pictionary decision, received ${decision.reason}`);
  }
  return decision.events.reduce(
    (nextState, event) => pictionaryEngine.normalize(pictionaryEngine.evolve(nextState, event)),
    state,
  );
}

function dispatch(
  state: PictionaryState,
  command: PictionaryCommandInput | PictionaryInternalCommand,
  context: CommandContext,
): PictionaryState {
  return applyDecision(state, decidePictionaryInput(state, command, context));
}

function markEverySeatReady(state: PictionaryState): PictionaryState {
  let nextState = state;
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    nextState = dispatch(
      nextState,
      { type: 'pictionary.task.ready.set', isReady: true },
      seatContext(nextState, seat),
    );
  }
  return nextState;
}

function drawingCollectionState(): PictionaryState {
  let state = pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
    CREATE_CONTEXT,
  );
  state = dispatch(
    state,
    { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } },
    user('host'),
  );
  state = dispatch(
    state,
    { type: 'room.seat.take', seat: 1, profile: { displayName: '客人' } },
    user('guest'),
  );
  state = dispatch(state, { type: 'room.seat.fillBots' }, user('host'));
  state = dispatch(state, { type: 'pictionary.game.begin' }, user('host'));

  state = markEverySeatReady(state);
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    state = dispatch(
      state,
      { type: 'pictionary.text.submit', text: `题目 ${seat + 1}` },
      seatContext(state, seat),
    );
  }
  if (state.deadlineAt === null) throw new Error('Pictionary transition deadline is missing');
  state = dispatch(
    state,
    { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
    user('host', null, state.deadlineAt),
  );
  state = markEverySeatReady(state);
  if (state.phase !== 'settling' || getPictionaryExpectedKind(state.stepIndex) !== 'drawing') {
    throw new Error('Expected the drawing collection settling phase');
  }
  return state;
}

describeBotTakeoverResolution({
  game: 'pictionary',
  hostUserId: 'host',
  hostSeat: 0,
  guestUserId: 'guest',
  guestSeat: 1,
  botSeat: 2,
  // Pictionary binds every task command to a chain before deciding
  // (command-binding preamble): an actor that cannot be seat-bound —
  // a system actor, an unseated user — fails that identity check
  // before the shared seat resolution runs.
  systemActorReason: REASON_PICTIONARY_TASK_INVALID,
  unseatedReason: REASON_PICTIONARY_TASK_INVALID,
  makeSession() {
    const state = drawingCollectionState();
    return {
      probe(actor: ActingSeatProbeActor): ActingSeatProbe {
        const context: CommandContext =
          actor.kind === 'system'
            ? {
                actor: { kind: 'system', effectId: 'probe' },
                controlledSeat: null,
                nowMs: 2_000,
                commandId: 'probe',
                randomSeed: 'pictionary-takeover-seed',
              }
            : user(actor.userId, actor.controlledSeat);
        const decision = decidePictionaryInput(
          state,
          { type: 'pictionary.drawing.reserve' },
          context,
        );
        if (decision.kind === 'reject') return { kind: 'rejected', reason: decision.reason };
        const event = decision.events.find(
          (entry): entry is Extract<typeof entry, { type: 'pictionary.drawing.reserved' }> =>
            entry.type === 'pictionary.drawing.reserved',
        );
        if (event === undefined) throw new Error('Reserve commit carried no reserved event');
        return { kind: 'resolved', seat: event.reservation.authorSeat };
      },
    };
  },
});
