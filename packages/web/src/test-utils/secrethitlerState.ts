/** Client fixtures driven through real Secret Hitler commands, including terminal settlement. */
import {
  getSecrethitlerNightParticipants,
  getSecrethitlerViewModel,
  type SecrethitlerCommand,
  secrethitlerEngine,
  type SecrethitlerPhaseKind,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';

import type { ReviewTestRounds } from './reviewTestRounds';

/** Applies a command through the authoritative engine; rejects fail the fixture immediately. */
function driveSecrethitlerTestCommand(
  state: SecrethitlerState,
  command: SecrethitlerCommand,
  userId = 'host',
  controlledSeat: number | null = null,
): SecrethitlerState {
  const decision = secrethitlerEngine.decide(state, command, {
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs: 1000,
    commandId: command.type,
    randomSeed: `seed:${state.gameSequence}:${state.history.governments.length}`,
  });
  if (decision.kind === 'reject') throw new Error(`rejected ${command.type}: ${decision.reason}`);
  return decision.events.reduce(secrethitlerEngine.evolve, state);
}

function settleVote(state: SecrethitlerState): SecrethitlerState {
  if (state.phase.kind !== 'voting' || state.phase.deadlineAt === null)
    throw new Error('Expected armed vote countdown');
  const decision = secrethitlerEngine.decide(
    state,
    { type: 'secrethitler.phase.settleExpired' },
    {
      actor: { kind: 'system', effectId: 'fixture-vote-settle' },
      controlledSeat: null,
      nowMs: state.phase.deadlineAt,
      commandId: 'fixture-vote-settle',
      randomSeed: `seed:${state.gameSequence}:${state.history.governments.length}`,
    },
  );
  if (decision.kind === 'reject') throw new Error(`rejected vote settlement: ${decision.reason}`);
  return decision.events.reduce(secrethitlerEngine.evolve, state);
}

function confirmResult(state: SecrethitlerState): SecrethitlerState {
  if (state.phase.kind !== 'publicResult') throw new Error('Expected public result');
  const decision = secrethitlerEngine.decide(
    state,
    { type: 'secrethitler.phase.settleExpired' },
    {
      actor: { kind: 'system', effectId: 'fixture-result-settle' },
      controlledSeat: null,
      nowMs: state.phase.deadlineAt,
      commandId: 'fixture-result-settle',
      randomSeed: `seed:${state.gameSequence}:${state.history.governments.length}`,
    },
  );
  if (decision.kind === 'reject') throw new Error(`rejected result settlement: ${decision.reason}`);
  return decision.events.reduce(secrethitlerEngine.evolve, state);
}

/** Advances a fully cast fixture ballot through its deadline and result acknowledgement. */
export function completeSecrethitlerTestVote(state: SecrethitlerState): SecrethitlerState {
  return confirmResult(settleVote(state));
}

/** An eight-seat lobby with two humans and test-only bot seats. */
export function buildSecrethitlerTestLobby(numberOfPlayers = 8): SecrethitlerState {
  let state = secrethitlerEngine.createInitialState(
    { numberOfPlayers, voteMode: 'public' },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  state = driveSecrethitlerTestCommand(state, {
    type: 'room.seat.take',
    seat: 0,
    profile: { displayName: '房主' },
  });
  state = driveSecrethitlerTestCommand(
    state,
    { type: 'room.seat.take', seat: 1, profile: { displayName: '小明' } },
    'u1',
  );
  return driveSecrethitlerTestCommand(state, { type: 'room.seat.fillBots' });
}

/** Sends a participant action as its owner or through the real bot-takeover contract. */
export function sendSecrethitlerSeatCommand(
  state: SecrethitlerState,
  seat: number,
  command: SecrethitlerCommand,
): SecrethitlerState {
  return driveSecrethitlerTestCommand(
    state,
    command,
    seat === 1 ? 'u1' : 'host',
    seat >= 2 ? seat : null,
  );
}

/** Completes viewing, electronic narration and the authorized recognition confirmations. */
export function startSecrethitlerTestGame(
  from: SecrethitlerState,
  onState: (state: SecrethitlerState) => void = () => undefined,
): SecrethitlerState {
  let state = driveSecrethitlerTestCommand(from, { type: 'secrethitler.roles.assign' });
  onState(state);
  for (const seat of state.livingSeats)
    state = sendSecrethitlerSeatCommand(state, seat, { type: 'secrethitler.role.viewed' });
  state = driveSecrethitlerTestCommand(state, { type: 'secrethitler.game.begin' });
  onState(state);
  for (const seat of getSecrethitlerNightParticipants(state)) {
    state = sendSecrethitlerSeatCommand(state, seat, {
      type: 'secrethitler.night.confirm',
      step: 1,
    });
  }
  state = driveSecrethitlerTestCommand(state, {
    type: 'secrethitler.audio.ack',
    audioBatchId: state.audioBatchId,
  });
  onState(state);
  state = driveSecrethitlerTestCommand(state, {
    type: 'secrethitler.audio.ack',
    audioBatchId: state.audioBatchId,
  });
  onState(state);
  return state;
}

/** Ends a game through repeated rejected governments and chaos policies, never a test-only seam. */
function endSecrethitlerTestGame(from: SecrethitlerState): SecrethitlerState {
  let state = from;
  for (let election = 0; election < 60 && state.phase.kind !== 'ended'; election += 1) {
    if (state.phase.kind !== 'election') throw new Error('Expected election fixture');
    const view = getSecrethitlerViewModel(state, state.phase.presidentSeat);
    const chancellor = view.eligibleChancellorSeats[0];
    if (chancellor === undefined) throw new Error('Missing fixture chancellor');
    state = sendSecrethitlerSeatCommand(state, state.phase.presidentSeat, {
      type: 'secrethitler.government.nominate',
      chancellorSeatId: chancellor,
    });
    for (const seat of state.livingSeats)
      state = sendSecrethitlerSeatCommand(state, seat, {
        type: 'secrethitler.government.castVote',
        vote: 'nein',
      });
    state = confirmResult(settleVote(state));
  }
  if (state.phase.kind !== 'ended') throw new Error('Fixture did not reach terminal policy');
  return state;
}

/** Collects all gameplay phases from a deterministic, playable round for guidance and UI tests. */
export function buildSecrethitlerPhaseStates(): ReadonlyMap<
  SecrethitlerPhaseKind,
  SecrethitlerState
> {
  const states = new Map<SecrethitlerPhaseKind, SecrethitlerState>();
  const capture = (state: SecrethitlerState) => {
    if (state.phase.kind === 'election' && state.isAudioPlaying) return;
    if (!states.has(state.phase.kind)) states.set(state.phase.kind, state);
  };
  const lobby = buildSecrethitlerTestLobby();
  capture(lobby);
  let state = startSecrethitlerTestGame(lobby, capture);
  const send = (seat: number, command: SecrethitlerCommand) => {
    state = sendSecrethitlerSeatCommand(state, seat, command);
    capture(state);
  };
  for (let attempt = 0; attempt < 40 && state.phase.kind !== 'ended'; attempt += 1) {
    const phase = state.phase;
    if (phase.kind === 'election') {
      const target = getSecrethitlerViewModel(
        state,
        phase.presidentSeat,
      ).eligibleChancellorSeats.find((seat) => state.identities[seat] !== 'hitler');
      if (target === undefined) throw new Error('Missing non-Hitler candidate');
      send(phase.presidentSeat, {
        type: 'secrethitler.government.nominate',
        chancellorSeatId: target,
      });
      for (const seat of state.livingSeats)
        send(seat, { type: 'secrethitler.government.castVote', vote: 'ja' });
      state = settleVote(state);
      capture(state);
      state = confirmResult(state);
      capture(state);
    } else if (phase.kind === 'legislativePresident') {
      send(phase.presidentSeat, {
        type: 'secrethitler.policy.presidentDiscard',
        policy: phase.hand.includes('liberal') ? 'liberal' : 'fascist',
      });
    } else if (phase.kind === 'legislativeChancellor') {
      if (state.fascistPolicies >= 5 && !phase.vetoRejected) {
        send(phase.chancellorSeat, {
          type: 'secrethitler.policy.chancellorResolve',
          action: 'veto',
        });
        send(phase.presidentSeat, { type: 'secrethitler.policy.vetoRespond', approve: false });
        state = confirmResult(state);
        capture(state);
      }
      send(phase.chancellorSeat, {
        type: 'secrethitler.policy.chancellorResolve',
        action: 'enact',
        policy: phase.hand.includes('fascist') ? 'fascist' : 'liberal',
      });
      state = confirmResult(state);
      capture(state);
    } else if (phase.kind === 'investigationResult') {
      send(phase.presidentSeat, { type: 'secrethitler.action.acknowledgeInvestigation' });
    } else if (phase.kind === 'executive') {
      if (phase.power === 'policyPeek') {
        send(phase.presidentSeat, { type: 'secrethitler.action.acknowledgePolicyPeek' });
      } else {
        const target = state.livingSeats.find(
          (seat) =>
            seat !== phase.presidentSeat &&
            state.identities[seat] !== 'hitler' &&
            !state.investigatedSeats.includes(seat),
        );
        if (target === undefined) throw new Error('Missing executive fixture target');
        send(
          phase.presidentSeat,
          phase.power === 'investigate'
            ? { type: 'secrethitler.action.investigate', targetSeatId: target }
            : phase.power === 'execute'
              ? { type: 'secrethitler.action.execute', targetSeatId: target }
              : { type: 'secrethitler.action.specialElection', targetSeatId: target },
        );
      }
    }
  }
  return states;
}

export const SECRETHITLER_REVIEW_ROUNDS: ReviewTestRounds<SecrethitlerState> = {
  lobby: buildSecrethitlerTestLobby,
  ended: () => endSecrethitlerTestGame(startSecrethitlerTestGame(buildSecrethitlerTestLobby())),
  nextRound: (ended) => ({ ...ended, gameSequence: ended.gameSequence + 1 }),
};
