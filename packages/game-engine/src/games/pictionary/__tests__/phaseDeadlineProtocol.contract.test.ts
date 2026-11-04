/**
 * Phase Deadline Protocol — pictionary scenario (E-2).
 *
 * Pictionary's registered assembly: the public expire command
 * travels on the uncontrolled-user channel with the host-or-seated
 * actor gate (D1', 2026-11-04: a spectator sends no expire), a
 * stale revision silently commits empty (which is why the decide
 * entry exempts this command from the revision rejection every
 * other revisioned command gets), and the scheduled settle.due
 * effect settles through the internal settleExpired command on
 * the system channel. Same-named scenario files live in each
 * switched game's __tests__.
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext, Decision } from '../../../platform/engine';
import { REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
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

/** The shared session plus the actor-gate drivers (D1'). */
interface PictionaryGateSession extends PhaseDeadlineSession {
  /** Public expire command as an unseated, non-host user. */
  expireAsSpectator(nowMs: number): Decision<PictionaryEvent, PictionaryEffect>;
  /** Public expire command as the room's host. */
  expireAsHost(nowMs: number): Decision<PictionaryEvent, PictionaryEffect>;
}

function makeSession(hostUserId = 'user-0'): PictionaryGateSession {
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

  const expire = (phaseRevision: number, context: CommandContext) =>
    attempt({ type: 'pictionary.phase.expire', phaseRevision }, context);

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
    expireAsUser: (nowMs) => expire(state.phaseRevision, userContext('user-1', null, nowMs)),
    expireAsControlledUser: (nowMs) => expire(state.phaseRevision, userContext('user-1', 1, nowMs)),
    expirePublicAsSystem: (nowMs) => expire(state.phaseRevision, systemContext(nowMs)),
    expireSettleAsSystem: (nowMs) => expireSettle(systemContext(nowMs)),
    expireSettleAsUser: (nowMs) => expireSettle(userContext('user-1', null, nowMs)),
    expireAsSpectator: (nowMs) => expire(state.phaseRevision, userContext('user-99', null, nowMs)),
    expireAsHost: (nowMs) => expire(state.phaseRevision, userContext(hostUserId, null, nowMs)),
    expireWithStaleRevision: (nowMs) =>
      expire(state.phaseRevision + 1, userContext('user-0', null, nowMs)),
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
    publicChannel: 'uncontrolledUser',
    hasSettleCommand: true,
    stalePolicy: 'silent',
    staleReason: null,
    dispatchAdvances: true,
  },
});

describe("Phase Deadline Protocol - pictionary actor gate (D1')", () => {
  it('rejects a spectator (neither host nor seated) at the deadline', () => {
    const session = makeSession();
    const decision = session.expireAsSpectator(session.deadlineAt());
    expect(decision).toEqual({ kind: 'reject', reason: REASON_NOT_SEATED });
    expect(session.hasAdvanced()).toBe(false);
  });

  it('commits expiry from a seated non-host user', () => {
    const session = makeSession();
    const decision = session.expireAsUser(session.deadlineAt());
    expect(decision.kind).toBe('commit');
    expect(session.hasAdvanced()).toBe(true);
  });

  it('commits expiry from the host even when the host holds no seat', () => {
    const session = makeSession('user-9');
    const decision = session.expireAsHost(session.deadlineAt());
    expect(decision.kind).toBe('commit');
    expect(session.hasAdvanced()).toBe(true);
  });
});
