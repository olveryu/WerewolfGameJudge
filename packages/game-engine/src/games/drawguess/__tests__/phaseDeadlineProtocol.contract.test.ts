/**
 * Phase Deadline Protocol — drawguess scenario (E-2).
 *
 * DrawGuess's registered assembly: the public expire command
 * travels on the uncontrolled-user channel, and its revision
 * policy is the dual check (phaseRevision + turnIndex) at the
 * guard, rejecting stale revisions. No settle.due: expiry is pure
 * client acceleration through the shared countdown hook.
 * Same-named scenario files live in each switched game's
 * __tests__.
 *
 * The guard-order pins below the shared suite record the E-2
 * PR-2 alignment: DrawGuess previously ran its revision check
 * ahead of the actor resolution (and ahead of the phase
 * dispatch), so a command failing two gates heard the stale
 * reason. The shared sequence answers the phase first, then the
 * actor, then the revision; these cases pin the new answers.
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext } from '../../../platform/engine';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_USER_ACTOR_REQUIRED,
} from '../../../platform/protocol/reasons';
import {
  describePhaseDeadlineProtocol,
  type PhaseDeadlineSession,
} from '../../../platform/room/__tests__/phaseDeadlineScenarios';
import type { DrawGuessCommand } from '../commands/types';
import { DRAWGUESS_REASONS, type DrawGuessDecision } from '../domain/decision';
import { drawGuessEngine } from '../engine';
import { parseDrawGuessState } from '../state/parseState';
import {
  DEFAULT_DRAWGUESS_CONFIG,
  type DrawGuessState,
  type DrawGuessWordChoice,
} from '../state/types';

const CHOICES: DrawGuessWordChoice[] = [
  { word: '大熊猫', pinyinInitials: 'd x m' },
  { word: '火锅', pinyinInitials: 'h g' },
  { word: '风筝', pinyinInitials: 'f z' },
];

interface DrawGuessHarness {
  readonly state: () => DrawGuessState;
  userContext(userId: string, controlledSeat: number | null, nowMs: number): CommandContext;
  systemContext(nowMs: number): CommandContext;
  attempt(command: DrawGuessCommand, context: CommandContext): DrawGuessDecision;
}

function createHarness(): DrawGuessHarness {
  let state: DrawGuessState = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1357', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
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
    actor: { kind: 'system', effectId: 'words' },
    controlledSeat: null,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'phase-deadline',
  });
  const attempt = (command: DrawGuessCommand, context: CommandContext): DrawGuessDecision => {
    const decision = drawGuessEngine.decide(state, command, context);
    if (decision.kind === 'commit') {
      state = parseDrawGuessState(
        JSON.parse(
          JSON.stringify(
            drawGuessEngine.normalize(decision.events.reduce(drawGuessEngine.evolve, state)),
          ),
        ),
      );
    }
    return decision;
  };
  return { state: () => state, userContext, systemContext, attempt };
}

/** Seats four humans, begins the game, and deals the word choices (deadline armed). */
function armedHarness(): DrawGuessHarness {
  const harness = createHarness();
  const send = (command: DrawGuessCommand, context: CommandContext) => {
    const decision = harness.attempt(command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  };
  for (let seat = 0; seat < 4; seat += 1) {
    const userId = seat === 0 ? 'host' : `u${seat}`;
    send(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      harness.userContext(userId, null, 1000),
    );
  }
  send({ type: 'drawguess.game.begin' }, harness.userContext('host', null, 1000));
  send(
    { type: 'drawguess.words.dealt', turnIndex: 0, choices: CHOICES },
    harness.systemContext(1000),
  );
  return harness;
}

function armedDeadlineAt(harness: DrawGuessHarness): number {
  const phase = harness.state().phase;
  if (phase.kind !== 'wordSelect' || phase.deadlineAt === null) {
    throw new Error('Expected an armed wordSelect deadline');
  }
  return phase.deadlineAt;
}

function makeSession(): PhaseDeadlineSession {
  const harness = armedHarness();
  const armedPhase = harness.state().phase;
  const expire = (phaseRevision: number, turnIndex: number, context: CommandContext) =>
    harness.attempt({ type: 'drawguess.phase.expire', phaseRevision, turnIndex }, context);
  const current = () => harness.state();

  return {
    expireAsUser: (nowMs) =>
      expire(
        current().phaseRevision,
        current().turnIndex,
        harness.userContext('host', null, nowMs),
      ),
    expireAsControlledUser: (nowMs) =>
      expire(current().phaseRevision, current().turnIndex, harness.userContext('host', 1, nowMs)),
    expirePublicAsSystem: (nowMs) =>
      expire(current().phaseRevision, current().turnIndex, harness.systemContext(nowMs)),
    expireSettleAsSystem: () => {
      throw new Error('DrawGuess has no internal settle command');
    },
    expireSettleAsUser: () => {
      throw new Error('DrawGuess has no internal settle command');
    },
    expireWithStaleRevision: (nowMs) =>
      expire(
        current().phaseRevision + 1,
        current().turnIndex,
        harness.userContext('host', null, nowMs),
      ),
    deadlineAt: () => armedDeadlineAt(harness),
    hasAdvanced: () => current().phase !== armedPhase,
  };
}

describePhaseDeadlineProtocol({
  game: 'drawguess',
  makeSession,
  expectations: {
    notExpiredReason: DRAWGUESS_REASONS.deadline,
    publicChannel: 'uncontrolledUser',
    hasSettleCommand: false,
    stalePolicy: 'reject',
    staleReason: DRAWGUESS_REASONS.stale,
    dispatchAdvances: true,
  },
});

describe('Phase Deadline Protocol - drawguess guard order pins', () => {
  it('answers a controlled-seat actor ahead of a stale revision', () => {
    const harness = armedHarness();
    const state = harness.state();
    const decision = harness.attempt(
      {
        type: 'drawguess.phase.expire',
        phaseRevision: state.phaseRevision + 1,
        turnIndex: state.turnIndex,
      },
      harness.userContext('host', 1, armedDeadlineAt(harness)),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED });
  });

  it('answers the system actor ahead of a stale revision on the public command', () => {
    const harness = armedHarness();
    const state = harness.state();
    const decision = harness.attempt(
      {
        type: 'drawguess.phase.expire',
        phaseRevision: state.phaseRevision + 1,
        turnIndex: state.turnIndex,
      },
      harness.systemContext(armedDeadlineAt(harness)),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_USER_ACTOR_REQUIRED });
  });

  it('answers the phase ahead of a stale revision outside an expirable phase', () => {
    const harness = createHarness();
    const state = harness.state();
    const decision = harness.attempt(
      {
        type: 'drawguess.phase.expire',
        phaseRevision: state.phaseRevision + 1,
        turnIndex: state.turnIndex,
      },
      harness.userContext('host', null, 1000),
    );
    expect(decision).toEqual({ kind: 'reject', reason: DRAWGUESS_REASONS.phase });
  });

  it('answers the phase ahead of a controlled-seat actor outside an expirable phase', () => {
    const harness = createHarness();
    const state = harness.state();
    const decision = harness.attempt(
      {
        type: 'drawguess.phase.expire',
        phaseRevision: state.phaseRevision,
        turnIndex: state.turnIndex,
      },
      harness.userContext('host', 1, 1000),
    );
    expect(decision).toEqual({ kind: 'reject', reason: DRAWGUESS_REASONS.phase });
  });

  it('answers a stale turn index ahead of the deadline gate', () => {
    const harness = armedHarness();
    const state = harness.state();
    const decision = harness.attempt(
      {
        type: 'drawguess.phase.expire',
        phaseRevision: state.phaseRevision,
        turnIndex: state.turnIndex + 1,
      },
      harness.userContext('host', null, armedDeadlineAt(harness) - 1),
    );
    expect(decision).toEqual({ kind: 'reject', reason: DRAWGUESS_REASONS.stale });
  });
});
