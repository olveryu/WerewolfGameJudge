/**
 * Phase Deadline Protocol — story relay scenario (E-2).
 *
 * Story Relay's registered assembly: the public expire command
 * travels on the uncontrolled-user channel with the host-or-seated
 * actor gate (D1', 2026-11-04: a spectator sends no expire), and
 * its revision policy is 'reject', assembled at the decide entry —
 * every revisioned command is rejected there before dispatch, so
 * the guard itself injects no revision gate. The scheduled
 * `storyrelay.settle.due` effect is the correctness path: the
 * internal settle command travels on the system channel and runs
 * the same expiry decide as the public expire command.
 * Same-named scenario files live in each switched game's __tests__.
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext } from '../../../platform/engine';
import { REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
import {
  describePhaseDeadlineProtocol,
  type PhaseDeadlineSession,
} from '../../../platform/room/__tests__/phaseDeadlineScenarios';
import type { StoryRelayCommand } from '../commands/types';
import { STORY_RELAY_REASONS, type StoryRelayDecision } from '../domain/decision';
import { storyRelayEngine } from '../engine';
import { parseStoryRelayState } from '../state/parseState';
import { DEFAULT_STORY_RELAY_CONFIG, type StoryRelayState } from '../state/types';

/** The shared session plus the actor-gate drivers (D1'). */
interface StoryRelayGateSession extends PhaseDeadlineSession {
  /** Public expire command as an unseated, non-host user. */
  expireAsSpectator(nowMs: number): StoryRelayDecision;
  /** Public expire command as a seated, non-host user. */
  expireAsSeatedNonHost(nowMs: number): StoryRelayDecision;
  /** Public expire command as the room's host. */
  expireAsHost(nowMs: number): StoryRelayDecision;
}

function makeSession(
  options: { hostUserId?: string; hostSeated?: boolean } = {},
): StoryRelayGateSession {
  const hostUserId = options.hostUserId ?? 'host';
  const hostSeated = options.hostSeated ?? true;
  let state: StoryRelayState = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4, transitionDurationSeconds: 0 },
    { roomCode: '1234', hostUserId, nowMs: 1000, commandId: 'create' },
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
    randomSeed: 'round',
  });
  const systemContext = (nowMs: number): CommandContext => ({
    actor: { kind: 'system', effectId: 'settle' },
    controlledSeat: null,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'round',
  });
  const apply = (decision: StoryRelayDecision) => {
    if (decision.kind !== 'commit') return;
    state = parseStoryRelayState(
      JSON.parse(
        JSON.stringify(
          storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state)),
        ),
      ),
    );
  };
  const attempt = (command: StoryRelayCommand, context: CommandContext) => {
    const decision = storyRelayEngine.decide(state, command, context);
    apply(decision);
    return decision;
  };
  const send = (command: StoryRelayCommand) => {
    const decision = attempt(command, userContext(hostUserId, null, 1000));
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  };
  const takeSeat = (seat: number, userId: string, displayName: string) => {
    const decision = attempt(
      { type: 'room.seat.take', seat, profile: { displayName } },
      userContext(userId, null, 1000),
    );
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  };

  takeSeat(0, hostSeated ? hostUserId : 'player-0', hostSeated ? 'Host' : 'Player 1');
  takeSeat(1, 'player-1', 'Player 2');
  send({ type: 'room.seat.fillBots' });
  send({ type: 'storyrelay.game.begin' });
  const armedPhase = state.phase;

  const expire = (phaseRevision: number, context: CommandContext) =>
    attempt({ type: 'storyrelay.phase.expire', phaseRevision }, context);

  const expireSettle = (context: CommandContext) =>
    attempt({ type: 'storyrelay.phase.settleExpired' }, context);

  return {
    expireAsUser: (nowMs) => expire(state.phaseRevision, userContext(hostUserId, null, nowMs)),
    expireAsControlledUser: (nowMs) =>
      expire(state.phaseRevision, userContext(hostUserId, 1, nowMs)),
    expirePublicAsSystem: (nowMs) => expire(state.phaseRevision, systemContext(nowMs)),
    expireSettleAsSystem: (nowMs) => expireSettle(systemContext(nowMs)),
    expireSettleAsUser: (nowMs) => expireSettle(userContext(hostUserId, null, nowMs)),
    expireAsSpectator: (nowMs) =>
      expire(state.phaseRevision, userContext('spectator', null, nowMs)),
    expireAsSeatedNonHost: (nowMs) =>
      expire(state.phaseRevision, userContext('player-1', null, nowMs)),
    expireAsHost: (nowMs) => expire(state.phaseRevision, userContext(hostUserId, null, nowMs)),
    expireWithStaleRevision: (nowMs) =>
      expire(state.phaseRevision + 1, userContext('host', null, nowMs)),
    deadlineAt: () => {
      if (state.deadlineAt === null) throw new Error('Expected an armed deadline');
      return state.deadlineAt;
    },
    hasAdvanced: () => state.phase !== armedPhase,
  };
}

describePhaseDeadlineProtocol({
  game: 'storyrelay',
  makeSession,
  expectations: {
    notExpiredReason: STORY_RELAY_REASONS.deadline,
    publicChannel: 'uncontrolledUser',
    hasSettleCommand: true,
    stalePolicy: 'reject',
    staleReason: STORY_RELAY_REASONS.task,
    dispatchAdvances: true,
  },
});

describe("Phase Deadline Protocol - storyrelay actor gate (D1')", () => {
  // The decide entry's revision gate runs before the shared guard,
  // so these cases carry the current revision: a stale revision
  // from any actor hears the entry rejection first.
  it('rejects a spectator (neither host nor seated) at the deadline', () => {
    const session = makeSession();
    const decision = session.expireAsSpectator(session.deadlineAt());
    expect(decision).toEqual({ kind: 'reject', reason: REASON_NOT_SEATED });
    expect(session.hasAdvanced()).toBe(false);
  });

  it('commits expiry from a seated non-host user', () => {
    const session = makeSession();
    const decision = session.expireAsSeatedNonHost(session.deadlineAt());
    expect(decision.kind).toBe('commit');
    expect(session.hasAdvanced()).toBe(true);
  });

  it('commits expiry from the host even when the host holds no seat', () => {
    const session = makeSession({ hostUserId: 'outsider', hostSeated: false });
    const decision = session.expireAsHost(session.deadlineAt());
    expect(decision.kind).toBe('commit');
    expect(session.hasAdvanced()).toBe(true);
  });
});
