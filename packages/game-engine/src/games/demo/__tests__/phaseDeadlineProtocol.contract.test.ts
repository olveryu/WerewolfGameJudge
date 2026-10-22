/**
 * Phase Deadline Protocol — demo scenario (E-2).
 *
 * Demo's registered assembly: system only — there is no public
 * expire command at all; the scheduled `demo.settle.due` effect is
 * the sole expiry channel and dispatches the internal settleExpired
 * command on the system channel. The command carries no revision;
 * correctness rides on the worker's pinned-arming staleness gate.
 * Same-named scenario files live in each switched game's __tests__.
 */

import type { CommandContext } from '../../../platform/engine';
import { applyDecision } from '../../../platform/engine/__tests__/engineSession';
import {
  describePhaseDeadlineProtocol,
  type PhaseDeadlineSession,
} from '../../../platform/room/__tests__/phaseDeadlineScenarios';
import type { DemoCommand } from '../commands/types';
import { DEMO_REASONS, type DemoDecision } from '../domain/decision';
import { demoEngine } from '../engine';
import { parseDemoState } from '../state/parseState';
import { DEFAULT_DEMO_CONFIG, type DemoState } from '../state/types';

interface DemoHarness {
  readonly state: () => DemoState;
  userContext(userId: string, controlledSeat: number | null, nowMs: number): CommandContext;
  systemContext(nowMs: number): CommandContext;
  attempt(command: DemoCommand, context: CommandContext): DemoDecision;
}

function createHarness(): DemoHarness {
  let state: DemoState = demoEngine.createInitialState(
    { ...DEFAULT_DEMO_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
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
  const attempt = (command: DemoCommand, context: CommandContext): DemoDecision => {
    const decision = demoEngine.decide(state, command, context);
    if (decision.kind === 'commit') {
      state = applyDecision(demoEngine, state, decision, parseDemoState);
    }
    return decision;
  };
  return { state: () => state, userContext, systemContext, attempt };
}

const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);

/** Four seated humans driven into the playing stage with its deadline armed. */
function armedHarness(): DemoHarness {
  const harness = createHarness();
  const send = (command: DemoCommand, context: CommandContext) => {
    const decision = harness.attempt(command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  };
  const asUser = (userId: string) => harness.userContext(userId, null, 1000);
  for (let seat = 0; seat < 4; seat += 1) {
    send(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      asUser(seatUser(seat)),
    );
  }
  send({ type: 'demo.roles.assign' }, asUser('host'));
  for (let seat = 0; seat < 4; seat += 1) {
    send({ type: 'demo.role.viewed' }, asUser(seatUser(seat)));
  }
  send({ type: 'demo.game.begin' }, asUser('host'));
  if (harness.state().phase.kind !== 'playing') {
    throw new Error('Expected the playing stage with an armed deadline');
  }
  return harness;
}

function makeSession(): PhaseDeadlineSession {
  const harness = armedHarness();
  const armedPhase = harness.state().phase;
  const current = () => harness.state();
  const noPublicExpire = (): never => {
    throw new Error('Demo has no public expire command');
  };

  return {
    expireAsUser: noPublicExpire,
    expireAsControlledUser: noPublicExpire,
    expirePublicAsSystem: noPublicExpire,
    expireSettleAsSystem: (nowMs) =>
      harness.attempt({ type: 'demo.phase.settleExpired' }, harness.systemContext(nowMs)),
    expireSettleAsUser: (nowMs) =>
      harness.attempt(
        { type: 'demo.phase.settleExpired' },
        harness.userContext('host', null, nowMs),
      ),
    expireWithStaleRevision: () => {
      throw new Error('Demo settle commands carry no revision');
    },
    deadlineAt: () => {
      const phase = current().phase;
      if (phase.kind !== 'playing' || phase.deadlineAt === null) {
        throw new Error('Expected the playing stage with an armed deadline');
      }
      return phase.deadlineAt;
    },
    hasAdvanced: () => current().phase !== armedPhase,
  };
}

describePhaseDeadlineProtocol({
  game: 'demo',
  makeSession,
  expectations: {
    notExpiredReason: DEMO_REASONS.deadline,
    publicChannel: null,
    hasSettleCommand: true,
    stalePolicy: 'none',
    staleReason: null,
    dispatchAdvances: true,
  },
});
