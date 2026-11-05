/**
 * Phase Deadline Protocol — drawguess scenario (E-2).
 *
 * DrawGuess's registered assembly: system only (D3, 2026-11-05 —
 * the public expire command was deleted). There is no public expire
 * command at all; the scheduled settle.due effect is the sole
 * expiry channel and dispatches the internal settleExpired command
 * on the system channel. The command carries no revision;
 * correctness rides on the worker's pinned-arming staleness gate.
 * Same-named scenario files live in each switched game's
 * __tests__.
 */

import type { CommandContext } from '../../../platform/engine';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_NOT_HOST,
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
  const current = () => harness.state();
  return {
    expireSettleAsSystem: (nowMs) =>
      harness.attempt({ type: 'drawguess.phase.settleExpired' }, harness.systemContext(nowMs)),
    expireSettleAsUser: (nowMs) =>
      harness.attempt(
        { type: 'drawguess.phase.settleExpired' },
        harness.userContext('host', null, nowMs),
      ),
    expireWithStaleRevision: () => {
      throw new Error('DrawGuess settle commands carry no revision');
    },
    deadlineAt: () => armedDeadlineAt(harness),
    hasAdvanced: () => current().phase !== armedPhase,
  };
}

describePhaseDeadlineProtocol({
  game: 'drawguess',
  makeSession,
  expectations: {
    notExpiredReason: DRAWGUESS_REASONS.deadline,
    hasSettleCommand: true,
    stalePolicy: 'none',
    staleReason: null,
    dispatchAdvances: true,
  },
});

/**
 * Host self-rescue (D3 follow-up): `drawguess.phase.retrySettle`
 * re-drives the current phase's settle through the same guard
 * sequence and dispatch as the scheduled delivery. It is not an
 * expire send — the host gate runs first, and the guard still
 * rejects before the deadline, for non-hosts, and for a host acting
 * through a takeover seat.
 */
describe('drawguess.phase.retrySettle (host self-rescue)', () => {
  let harness: DrawGuessHarness;
  let armedPhase: DrawGuessState['phase'];
  let deadlineAt: number;
  const retry = (userId: string, controlledSeat: number | null, nowMs: number) =>
    harness.attempt(
      { type: 'drawguess.phase.retrySettle' },
      harness.userContext(userId, controlledSeat, nowMs),
    );

  beforeEach(() => {
    harness = armedHarness();
    armedPhase = harness.state().phase;
    deadlineAt = armedDeadlineAt(harness);
  });

  it('rejects the host before the deadline', () => {
    expect(retry('host', null, deadlineAt - 1)).toEqual({
      kind: 'reject',
      reason: DRAWGUESS_REASONS.deadline,
    });
    expect(harness.state().phase).toBe(armedPhase);
  });

  it('rejects a non-host after the deadline', () => {
    expect(retry('u1', null, deadlineAt)).toEqual({
      kind: 'reject',
      reason: REASON_NOT_HOST,
    });
    expect(harness.state().phase).toBe(armedPhase);
  });

  it('rejects a host acting through a takeover seat', () => {
    expect(retry('host', 0, deadlineAt)).toEqual({
      kind: 'reject',
      reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED,
    });
    expect(harness.state().phase).toBe(armedPhase);
  });

  it('settles the phase for the host after the deadline', () => {
    expect(retry('host', null, deadlineAt).kind).toBe('commit');
    expect(harness.state().phase).not.toBe(armedPhase);
  });

  it('is a no-op once the phase has advanced', () => {
    expect(retry('host', null, deadlineAt).kind).toBe('commit');
    expect(harness.state().phase).not.toBe(armedPhase);
    expect(retry('host', null, deadlineAt + 1_000).kind).toBe('reject');
  });
});
