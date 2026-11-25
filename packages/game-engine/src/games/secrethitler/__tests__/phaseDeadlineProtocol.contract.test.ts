import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { REASON_CONTROLLED_SEAT_NOT_ALLOWED } from '../../../platform/protocol/reasons';
import {
  describePhaseDeadlineProtocol,
  type PhaseDeadlineSession,
} from '../../../platform/room/__tests__/phaseDeadlineScenarios';
import { SECRETHITLER_REASONS } from '../domain/decision';
import { SECRETHITLER_NIGHT_VIEW_ACTION_KEY } from '../domain/nightSteps';
import { getSecrethitlerNightParticipants } from '../domain/rules';
import { secrethitlerEngine } from '../engine';
import { parseSecrethitlerState } from '../state/parseState';
import { DEFAULT_SECRETHITLER_CONFIG } from '../state/types';

function armedVotingSession() {
  const session = createEngineSession(secrethitlerEngine, {
    config: { ...DEFAULT_SECRETHITLER_CONFIG, numberOfPlayers: 5 },
    parse: parseSecrethitlerState,
  });
  session.send({ type: 'room.seat.fillBots' });
  session.send({ type: 'secrethitler.roles.assign' });
  session.send({ type: 'secrethitler.bots.markAllBotsViewed' });
  session.send({ type: 'secrethitler.game.begin' });
  for (const seat of getSecrethitlerNightParticipants(session.state)) {
    const phase = session.state.phase;
    if (phase.kind !== 'night' || phase.steps.current === null)
      throw new Error('Expected the current first-night step');
    session.send(
      {
        type: 'secrethitler.step.submit',
        gameSequence: session.state.gameSequence,
        submission: {
          stepId: phase.steps.current.stepId,
          serial: phase.steps.current.serial,
          actionKey: SECRETHITLER_NIGHT_VIEW_ACTION_KEY,
        },
      },
      'host',
      seat,
    );
  }
  while (session.state.isAudioPlaying)
    session.send({ type: 'secrethitler.audio.ack', audioBatchId: session.state.audioBatchId });
  const election = session.state.phase;
  if (election.kind !== 'election') throw new Error('Expected election');
  const target = session.state.livingSeats.find((seat) => seat !== election.presidentSeat);
  if (target === undefined) throw new Error('Missing chancellor candidate');
  session.send(
    { type: 'secrethitler.government.preselect', chancellorSeatId: target },
    'host',
    election.presidentSeat,
  );
  session.send(
    { type: 'secrethitler.government.nominate', chancellorSeatId: target },
    'host',
    election.presidentSeat,
  );
  for (const seat of session.state.livingSeats)
    session.send({ type: 'secrethitler.government.castVote', vote: 'ja' }, 'host', seat);
  const armed = session.state.phase;
  if (armed.kind !== 'voting' || armed.deadlineAt === null) throw new Error('Expected armed vote');
  return session;
}

function makeSession(): PhaseDeadlineSession {
  const session = armedVotingSession();
  const armed = session.state.phase;
  if (armed.kind !== 'voting' || armed.deadlineAt === null) throw new Error('Expected armed vote');
  return {
    expireSettleAsSystem: (nowMs) => {
      session.setNow(nowMs);
      const command = { type: 'secrethitler.phase.settleExpired' } as const;
      const context = session.systemContext('settle');
      const decision = session.decideAs(command, context);
      if (decision.kind === 'commit') session.sendAs(command, context);
      return decision;
    },
    expireSettleAsUser: (nowMs) => {
      session.setNow(nowMs);
      return session.decide({ type: 'secrethitler.phase.settleExpired' });
    },
    expireWithStaleRevision: () => {
      throw new Error('Expiry has no revision');
    },
    deadlineAt: () => armed.deadlineAt ?? 0,
    hasAdvanced: () => session.state.phase.kind !== 'voting',
  };
}

describePhaseDeadlineProtocol({
  game: 'secrethitler',
  makeSession,
  expectations: {
    notExpiredReason: SECRETHITLER_REASONS.deadline,
    hasSettleCommand: true,
    stalePolicy: 'none',
    staleReason: null,
    dispatchAdvances: true,
  },
});

describe('secrethitler.phase.retrySettle (host self-rescue)', () => {
  it('allows only the uncontrolled host to settle an overdue public result', () => {
    const session = armedVotingSession();
    const voting = session.state.phase;
    if (voting.kind !== 'voting' || voting.deadlineAt === null)
      throw new Error('Expected an armed vote');
    session.setNow(voting.deadlineAt);
    session.sendAs(
      { type: 'secrethitler.phase.settleExpired' },
      session.systemContext('vote-settle'),
    );
    const result = session.state.phase;
    if (result.kind !== 'publicResult' || result.deadlineAt === null)
      throw new Error('Expected an armed public result');

    const retry = { type: 'secrethitler.phase.retrySettle' } as const;
    session.setNow(result.deadlineAt - 1);
    expect(session.decide(retry, 'host')).toEqual({
      kind: 'reject',
      reason: SECRETHITLER_REASONS.deadline,
    });

    session.setNow(result.deadlineAt);
    expect(session.decide(retry, 'guest')).toEqual({
      kind: 'reject',
      reason: SECRETHITLER_REASONS.notHostRetrySettle,
    });
    expect(session.decide(retry, 'host', 0)).toEqual({
      kind: 'reject',
      reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED,
    });

    session.send(retry, 'host');
    expect(session.state.phase.kind).not.toBe('publicResult');
  });
});
