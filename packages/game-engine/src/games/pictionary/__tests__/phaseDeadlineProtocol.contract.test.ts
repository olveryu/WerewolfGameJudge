/**
 * Phase Deadline Protocol — pictionary scenario (E-2).
 *
 * Pictionary's registered assembly: system only (D3, 2026-11-05 —
 * the public expire command was deleted). There is no public expire
 * command at all; the scheduled settle.due effect is the sole
 * expiry channel and dispatches the internal settleExpired command
 * on the system channel. The command carries no revision;
 * correctness rides on the worker's pinned-arming staleness gate.
 * Same-named scenario files live in each switched game's __tests__.
 */

import type { CommandContext, Decision } from '../../../platform/engine';
import {
  describePhaseDeadlineProtocol,
  type PhaseDeadlineSession,
} from '../../../platform/room/__tests__/phaseDeadlineScenarios';
import type { PictionaryEvent } from '../domain/events';
import { REASON_PICTIONARY_PHASE_NOT_EXPIRED } from '../domain/reasons';
import type { PictionaryEffect } from '../effects/types';
import { pictionaryEngine } from '../engine';
import { parsePictionaryState } from '../state/parseState';
import { DEFAULT_PICTIONARY_CONFIG, type PictionaryState } from '../state/types';
import { bindPictionaryCommand, type PictionaryInput } from './commandBinding';

function makeSession(hostUserId = 'user-0'): PhaseDeadlineSession {
  let state: PictionaryState = pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4, drawingDurationSeconds: 90 },
    { roomCode: '2468', hostUserId, nowMs: 1000, commandId: 'create' },
  );
  let commandNumber = 0;
  const userContext = (
    userId: string,
    controlledSeat: number | null,
    nowMs: number,
  ): CommandContext => ({
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'phase-deadline',
  });
  const systemContext = (nowMs: number): CommandContext => ({
    actor: { kind: 'system', effectId: 'settle' },
    controlledSeat: null,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'phase-deadline',
  });
  const apply = (decision: Decision<PictionaryEvent, PictionaryEffect>) => {
    if (decision.kind !== 'commit') return;
    state = parsePictionaryState(
      JSON.parse(
        JSON.stringify(
          pictionaryEngine.normalize(decision.events.reduce(pictionaryEngine.evolve, state)),
        ),
      ),
    );
  };
  const attempt = (input: PictionaryInput, context: CommandContext) => {
    const decision = pictionaryEngine.decide(
      state,
      bindPictionaryCommand(state, input, context),
      context,
    );
    apply(decision);
    return decision;
  };
  const send = (input: PictionaryInput, userId: string) => {
    const decision = attempt(input, userContext(userId, null, 1000));
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  };

  for (let seat = 0; seat < 4; seat += 1) {
    send(
      { type: 'room.seat.take', seat, profile: { displayName: `玩家 ${seat + 1}` } },
      `user-${seat}`,
    );
  }
  send({ type: 'pictionary.game.begin' }, hostUserId);
  const armedPhase = state.phase;

  const expireSettle = (context: CommandContext) => {
    const decision = pictionaryEngine.decide(
      state,
      { type: 'pictionary.phase.settleExpired' },
      context,
    );
    apply(decision);
    return decision;
  };

  return {
    expireSettleAsSystem: (nowMs) => expireSettle(systemContext(nowMs)),
    expireSettleAsUser: (nowMs) => expireSettle(userContext('user-1', null, nowMs)),
    expireWithStaleRevision: () => {
      throw new Error('Pictionary settle commands carry no revision');
    },
    deadlineAt: () => {
      if (state.deadlineAt === null) throw new Error('Expected an armed deadline');
      return state.deadlineAt;
    },
    hasAdvanced: () => state.phase !== armedPhase,
  };
}

describePhaseDeadlineProtocol({
  game: 'pictionary',
  makeSession,
  expectations: {
    notExpiredReason: REASON_PICTIONARY_PHASE_NOT_EXPIRED,
    hasSettleCommand: true,
    stalePolicy: 'none',
    staleReason: null,
    dispatchAdvances: true,
  },
});
