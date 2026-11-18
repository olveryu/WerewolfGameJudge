/** Authoritative Secret Hitler gameplay decisions. */

import { guardAudioPlayback } from '../../../platform/audio';
import { type CommandContext, reject, requireHost } from '../../../platform/engine';
import { buildGameCompletionPayloadV2 } from '../../../platform/engine/completionEffect';
import { createSeededRng, shuffleArray } from '../../../platform/random';
import { resolveActingSeat } from '../../../platform/room/actingSeat';
import { getHumanSeatMap } from '../../../platform/room/seating';
import type { SecrethitlerCommand } from '../commands/types';
import {
  SECRETHITLER_MIN_PLAYERS,
  type SecrethitlerActionRecord,
  type SecrethitlerEndReason,
  type SecrethitlerGameplayPatch,
  type SecrethitlerGovernmentRecord,
  type SecrethitlerPhase,
  type SecrethitlerPolicy,
  type SecrethitlerPower,
  type SecrethitlerState,
  type SecrethitlerWinner,
} from '../state/types';
import {
  commitSecrethitler,
  SECRETHITLER_REASONS,
  type SecrethitlerDecision,
  type SecrethitlerEffect,
  type SecrethitlerEvent,
} from './decision';
import { evolveSecrethitlerState } from './evolve';
import { getSecrethitlerFaction, getSecrethitlerNightParticipants } from './rules';

const NIGHT_STEP_COUNT = 4;

function nightAudioKey(playerCount: number, step: number): string {
  if (step === 0) return 'night_start';
  if (step === 1) return playerCount <= 6 ? 'evil_reveal_5_6' : 'fascist_reveal_7_10';
  if (step === 2) return 'evil_close';
  return 'night_end';
}

function patch(
  changes: Partial<SecrethitlerGameplayPatch>,
  effects: readonly SecrethitlerEffect[] = [],
): SecrethitlerDecision {
  return commitSecrethitler([{ type: 'secrethitler.gameplay.updated', patch: changes }], effects);
}

function nextLivingSeat(
  livingSeats: readonly number[],
  seatCount: number,
  afterSeat: number,
): number {
  for (let offset = 1; offset <= seatCount; offset += 1) {
    const candidate = (afterSeat + offset) % seatCount;
    if (livingSeats.includes(candidate)) return candidate;
  }
  throw new Error('Secret Hitler requires at least one living player');
}

function livingSeatAtOrAfter(
  livingSeats: readonly number[],
  seatCount: number,
  cursor: number,
): number {
  for (let offset = 0; offset < seatCount; offset += 1) {
    const candidate = (cursor + offset) % seatCount;
    if (livingSeats.includes(candidate)) return candidate;
  }
  throw new Error('Secret Hitler requires at least one living player');
}

function checkSeat(state: SecrethitlerState, context: CommandContext): number | null {
  const resolution = resolveActingSeat(state, state.config.numberOfPlayers, context);
  return resolution.kind === 'resolved' && state.livingSeats.includes(resolution.value)
    ? resolution.value
    : null;
}

function requireCurrentPresident(
  state: SecrethitlerState,
  context: CommandContext,
  presidentSeat: number,
): SecrethitlerDecision | number {
  const seat = checkSeat(state, context);
  return seat === presidentSeat ? seat : reject(SECRETHITLER_REASONS.notPresident);
}

function completionEffect(
  state: SecrethitlerState,
  winner: SecrethitlerWinner,
  context: CommandContext,
): SecrethitlerEffect | null {
  const humans = Object.values(getHumanSeatMap(state.roster, state.config.numberOfPlayers));
  const payload = buildGameCompletionPayloadV2({
    roundId: `secrethitler:game:${state.gameSequence}`,
    completedAt: context.nowMs,
    humans,
    minimumHumanPlayers: SECRETHITLER_MIN_PLAYERS,
    stats: humans.map(({ userId, seat }) => {
      const role = state.identities[seat];
      if (role === undefined) throw new Error('Missing opening role for eligible player');
      const faction = getSecrethitlerFaction(role);
      return {
        userId,
        gamesPlayed: 1 as const,
        liberalWins: faction === 'liberal' && winner === 'liberal' ? (1 as const) : (0 as const),
        fascistWins: faction === 'fascist' && winner === 'fascist' ? (1 as const) : (0 as const),
      };
    }),
  });
  return payload === null ? null : { type: 'secrethitler.game.completed', payload };
}

function finishGame(
  state: SecrethitlerState,
  winner: SecrethitlerWinner,
  reason: SecrethitlerEndReason,
  context: CommandContext,
  beforeEnd: readonly SecrethitlerEvent[] = [],
): SecrethitlerDecision {
  const events: readonly SecrethitlerEvent[] = [
    ...beforeEnd,
    { type: 'secrethitler.game.ended', winner, reason },
  ];
  const ended = events.reduce(evolveSecrethitlerState, state);
  const effect = state.xpSettled ? null : completionEffect(ended, winner, context);
  return commitSecrethitler(events, effect === null ? [] : [effect]);
}

function newGovernmentRecord(
  presidentSeat: number,
  chancellorSeat: number,
): SecrethitlerGovernmentRecord {
  return { presidentSeat, chancellorSeat, outcome: 'pending', votes: null };
}

function updateLatestGovernment(
  state: SecrethitlerState,
  record: SecrethitlerGovernmentRecord,
): SecrethitlerState['history']['governments'] {
  const governments = [...state.history.governments];
  if (governments.length === 0) throw new Error('Missing pending Secret Hitler government');
  governments[governments.length - 1] = record;
  return governments;
}

function drawPolicies(
  state: SecrethitlerState,
  amount: number,
  randomSeed: string,
  deckOverride = state.policyDeck,
  discardOverride = state.policyDiscard,
): {
  readonly hand: readonly SecrethitlerPolicy[];
  readonly deck: readonly SecrethitlerPolicy[];
  readonly discard: readonly SecrethitlerPolicy[];
} {
  let deck = [...deckOverride];
  let discard = [...discardOverride];
  if (deck.length < amount) {
    deck = shuffleArray(
      [...deck, ...discard],
      createSeededRng(`${randomSeed}:secrethitler-policy-reshuffle`),
    );
    discard = [];
  }
  if (deck.length < amount) throw new Error('Secret Hitler policy deck exhausted');
  return { hand: deck.slice(0, amount), deck: deck.slice(amount), discard };
}

function powerForPolicy(state: SecrethitlerState, policyNumber: number): SecrethitlerPower | null {
  const players = state.config.numberOfPlayers;
  if ((policyNumber === 1 && players >= 9) || (policyNumber === 2 && players >= 7))
    return 'investigate';
  if (policyNumber === 3) return players <= 6 ? 'policyPeek' : 'specialElection';
  if (policyNumber === 4 || policyNumber === 5) return 'execute';
  return null;
}

function finishGovernment(
  state: SecrethitlerState,
  policy: SecrethitlerPolicy,
  source: 'government' | 'chaos',
  presidentSeat: number,
  returnToSeat: number | null,
  context: CommandContext,
  extraPatch: Partial<SecrethitlerGameplayPatch> = {},
): SecrethitlerDecision {
  const liberalPolicies = state.liberalPolicies + (policy === 'liberal' ? 1 : 0);
  const fascistPolicies = state.fascistPolicies + (policy === 'fascist' ? 1 : 0);
  const history = {
    ...state.history,
    policies: [...state.history.policies, { policy, source }],
  };
  const basePatch = {
    ...extraPatch,
    liberalPolicies,
    fascistPolicies,
    history,
  } satisfies Partial<SecrethitlerGameplayPatch>;
  if (liberalPolicies === 5)
    return finishGame(state, 'liberal', 'liberalPolicies', context, [
      { type: 'secrethitler.gameplay.updated', patch: basePatch },
    ]);
  if (fascistPolicies === 6)
    return finishGame(state, 'fascist', 'fascistPolicies', context, [
      { type: 'secrethitler.gameplay.updated', patch: basePatch },
    ]);

  const power =
    source === 'government' && policy === 'fascist' ? powerForPolicy(state, fascistPolicies) : null;
  if (power !== null) {
    let preview: readonly SecrethitlerPolicy[] = [];
    let policyDeck = state.policyDeck;
    let policyDiscard = basePatch.policyDiscard ?? state.policyDiscard;
    if (power === 'policyPeek') {
      const prepared = drawPolicies(state, 3, context.randomSeed, state.policyDeck, policyDiscard);
      preview = prepared.hand;
      policyDeck = [...prepared.hand, ...prepared.deck];
      policyDiscard = prepared.discard;
    }
    return patch({
      ...basePatch,
      policyDeck,
      policyDiscard,
      phase: { kind: 'executive', presidentSeat, returnToSeat, power, preview },
    });
  }
  const nextSeat =
    returnToSeat === null
      ? nextLivingSeat(state.livingSeats, state.config.numberOfPlayers, presidentSeat)
      : livingSeatAtOrAfter(state.livingSeats, state.config.numberOfPlayers, returnToSeat);
  return patch({
    ...basePatch,
    nextPresidentSeat: nextSeat,
    phase: { kind: 'election', presidentSeat: nextSeat, returnToSeat: null },
  });
}

function chaosPolicy(
  state: SecrethitlerState,
  context: CommandContext,
  returnToSeat: number | null,
  history = state.history,
  policyDiscardOverride = state.policyDiscard,
): SecrethitlerDecision {
  let deck = [...state.policyDeck];
  let discard = [...policyDiscardOverride];
  if (deck.length === 0) {
    deck = shuffleArray(
      discard,
      createSeededRng(`${context.randomSeed}:secrethitler-chaos-reshuffle`),
    );
    discard = [];
  }
  const policy = deck.shift();
  if (policy === undefined) throw new Error('Secret Hitler chaos policy deck exhausted');
  const liberalPolicies = state.liberalPolicies + (policy === 'liberal' ? 1 : 0);
  const fascistPolicies = state.fascistPolicies + (policy === 'fascist' ? 1 : 0);
  const updatedHistory = {
    ...history,
    policies: [...history.policies, { policy, source: 'chaos' as const }],
  };
  const basePatch = {
    policyDeck: deck,
    policyDiscard: discard,
    electionTracker: 0,
    lastPresidentSeat: null,
    lastChancellorSeat: null,
    liberalPolicies,
    fascistPolicies,
    history: updatedHistory,
  } satisfies Partial<SecrethitlerGameplayPatch>;
  if (liberalPolicies === 5)
    return finishGame(state, 'liberal', 'liberalPolicies', context, [
      { type: 'secrethitler.gameplay.updated', patch: basePatch },
    ]);
  if (fascistPolicies === 6)
    return finishGame(state, 'fascist', 'fascistPolicies', context, [
      { type: 'secrethitler.gameplay.updated', patch: basePatch },
    ]);
  const nextSeat =
    returnToSeat === null
      ? nextLivingSeat(
          state.livingSeats,
          state.config.numberOfPlayers,
          state.phase.kind === 'voting'
            ? state.phase.presidentSeat
            : state.phase.kind === 'vetoResponse'
              ? state.phase.presidentSeat
              : 0,
        )
      : livingSeatAtOrAfter(state.livingSeats, state.config.numberOfPlayers, returnToSeat);
  return patch({
    ...basePatch,
    nextPresidentSeat: nextSeat,
    phase: { kind: 'election', presidentSeat: nextSeat, returnToSeat: null },
  });
}

function nextElectionAfterGovernment(
  state: SecrethitlerState,
  presidentSeat: number,
  returnToSeat: number | null,
  livingSeats = state.livingSeats,
): { readonly nextSeat: number; readonly returnToSeat: null } {
  const nextSeat =
    returnToSeat === null
      ? nextLivingSeat(livingSeats, state.config.numberOfPlayers, presidentSeat)
      : livingSeatAtOrAfter(livingSeats, state.config.numberOfPlayers, returnToSeat);
  return { nextSeat, returnToSeat: null };
}

function decideNightReplay(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.night.replay' }>,
  context: CommandContext,
): SecrethitlerDecision {
  const hostRejection = requireHost<SecrethitlerEvent, SecrethitlerEffect>(
    context,
    state.hostUserId,
    SECRETHITLER_REASONS.notHostNightReplay,
  );
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'night') return reject(SECRETHITLER_REASONS.phase);
  if (command.step !== state.phase.step) return reject(SECRETHITLER_REASONS.nightStep);
  const audioReason = guardAudioPlayback(state, SECRETHITLER_REASONS.audioPlaying);
  if (audioReason !== null) return reject(audioReason);
  return commitSecrethitler([
    {
      type: 'secrethitler.audio.queued',
      effects: [{ audioKey: nightAudioKey(state.config.numberOfPlayers, state.phase.step) }],
    },
  ]);
}

/** Audio completion and authorized confirmations jointly advance the electronic first night. */
export function evaluateSecrethitlerNightCompletion(
  state: SecrethitlerState,
): readonly SecrethitlerEvent[] {
  const phase = state.phase;
  if (phase.kind !== 'night' || state.isAudioPlaying) return [];
  if (
    phase.step === 1 &&
    !getSecrethitlerNightParticipants(state).every((seat) => phase.confirmedSeats.includes(seat))
  )
    return [];
  if (phase.step === NIGHT_STEP_COUNT - 1) {
    return [
      {
        type: 'secrethitler.gameplay.updated',
        patch: {
          phase: { kind: 'election', presidentSeat: state.nextPresidentSeat, returnToSeat: null },
        },
      },
    ];
  }
  const nextStep = phase.step + 1;
  return [
    {
      type: 'secrethitler.gameplay.updated',
      patch: { phase: { kind: 'night', step: nextStep, confirmedSeats: [] } },
    },
    {
      type: 'secrethitler.audio.queued',
      effects: [{ audioKey: nightAudioKey(state.config.numberOfPlayers, nextStep) }],
    },
  ];
}

function decideNightConfirm(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.night.confirm' }>,
  context: CommandContext,
): SecrethitlerDecision {
  if (state.phase.kind !== 'night' || state.phase.step !== 1)
    return reject(SECRETHITLER_REASONS.phase);
  if (command.step !== state.phase.step) return reject(SECRETHITLER_REASONS.nightStep);
  const seat = checkSeat(state, context);
  if (seat === null || !getSecrethitlerNightParticipants(state).includes(seat))
    return reject(SECRETHITLER_REASONS.nightParticipant);
  if (state.phase.confirmedSeats.includes(seat)) return reject(SECRETHITLER_REASONS.phase);
  return patch({
    phase: { ...state.phase, confirmedSeats: [...state.phase.confirmedSeats, seat] },
  });
}

function decideNomination(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.government.nominate' }>,
  context: CommandContext,
): SecrethitlerDecision {
  if (state.phase.kind !== 'election') return reject(SECRETHITLER_REASONS.phase);
  const president = requireCurrentPresident(state, context, state.phase.presidentSeat);
  if (typeof president !== 'number') return president;
  const chancellor = command.chancellorSeatId;
  if (
    !state.livingSeats.includes(chancellor) ||
    chancellor === president ||
    state.lastChancellorSeat === chancellor ||
    (state.livingSeats.length > 5 && state.lastPresidentSeat === chancellor)
  )
    return reject(SECRETHITLER_REASONS.nomination);
  const government = newGovernmentRecord(president, chancellor);
  return patch({
    phase: {
      kind: 'voting',
      presidentSeat: president,
      chancellorSeat: chancellor,
      returnToSeat: state.phase.returnToSeat,
      votes: {},
    },
    history: { ...state.history, governments: [...state.history.governments, government] },
  });
}

function decideVote(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.government.castVote' }>,
  context: CommandContext,
): SecrethitlerDecision {
  if (state.phase.kind !== 'voting') return reject(SECRETHITLER_REASONS.phase);
  const seat = checkSeat(state, context);
  if (seat === null) return reject(SECRETHITLER_REASONS.notEligibleVote);
  const votes = { ...state.phase.votes, [seat]: command.vote };
  if (!state.livingSeats.every((livingSeat) => votes[livingSeat] !== undefined))
    return patch({ phase: { ...state.phase, votes } });

  const revealedVotes = state.livingSeats
    .slice()
    .sort((left, right) => left - right)
    .map((voterSeat) => ({ seat: voterSeat, vote: votes[voterSeat] ?? 'nein' }));
  const yesCount = revealedVotes.filter(({ vote }) => vote === 'ja').length;
  const passed = yesCount > revealedVotes.length - yesCount;
  const government: SecrethitlerGovernmentRecord = {
    presidentSeat: state.phase.presidentSeat,
    chancellorSeat: state.phase.chancellorSeat,
    outcome: passed ? 'passed' : 'rejected',
    votes: revealedVotes,
  };
  const governments = updateLatestGovernment(state, government);
  const history = { ...state.history, governments };
  if (!passed) {
    const tracker = state.electionTracker + 1;
    if (tracker >= 3) return chaosPolicy(state, context, state.phase.returnToSeat, history);
    const { nextSeat } = nextElectionAfterGovernment(
      state,
      state.phase.presidentSeat,
      state.phase.returnToSeat,
    );
    return patch({
      history,
      electionTracker: tracker,
      nextPresidentSeat: nextSeat,
      phase: { kind: 'election', presidentSeat: nextSeat, returnToSeat: null },
    });
  }
  if (state.identities[state.phase.chancellorSeat] === 'hitler' && state.fascistPolicies >= 3) {
    return finishGame(state, 'fascist', 'hitlerElected', context, [
      {
        type: 'secrethitler.gameplay.updated',
        patch: {
          history,
          electionTracker: 0,
          lastPresidentSeat: state.phase.presidentSeat,
          lastChancellorSeat: state.phase.chancellorSeat,
        },
      },
    ]);
  }
  const draw = drawPolicies(state, 3, context.randomSeed);
  return patch({
    history,
    lastPresidentSeat: state.phase.presidentSeat,
    lastChancellorSeat: state.phase.chancellorSeat,
    policyDeck: draw.deck,
    policyDiscard: draw.discard,
    phase: {
      kind: 'legislativePresident',
      presidentSeat: state.phase.presidentSeat,
      chancellorSeat: state.phase.chancellorSeat,
      returnToSeat: state.phase.returnToSeat,
      hand: draw.hand,
    },
  });
}

function decidePresidentDiscard(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.policy.presidentDiscard' }>,
  context: CommandContext,
): SecrethitlerDecision {
  if (state.phase.kind !== 'legislativePresident') return reject(SECRETHITLER_REASONS.phase);
  const president = requireCurrentPresident(state, context, state.phase.presidentSeat);
  if (typeof president !== 'number') return president;
  const discardIndex = state.phase.hand.indexOf(command.policy);
  if (discardIndex < 0) return reject(SECRETHITLER_REASONS.handChoice);
  const hand = state.phase.hand.filter((_, index) => index !== discardIndex);
  return patch({
    policyDiscard: [...state.policyDiscard, command.policy],
    phase: {
      kind: 'legislativeChancellor',
      vetoRejected: false,
      presidentSeat: state.phase.presidentSeat,
      chancellorSeat: state.phase.chancellorSeat,
      returnToSeat: state.phase.returnToSeat,
      hand,
    },
  });
}

function decideChancellorResolve(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.policy.chancellorResolve' }>,
  context: CommandContext,
): SecrethitlerDecision {
  if (state.phase.kind !== 'legislativeChancellor') return reject(SECRETHITLER_REASONS.phase);
  const seat = checkSeat(state, context);
  if (seat !== state.phase.chancellorSeat) return reject(SECRETHITLER_REASONS.notLiving);
  if (command.action === 'veto') {
    if (state.fascistPolicies < 5 || state.phase.vetoRejected)
      return reject(SECRETHITLER_REASONS.veto);
    return patch({
      phase: {
        kind: 'vetoResponse',
        presidentSeat: state.phase.presidentSeat,
        chancellorSeat: state.phase.chancellorSeat,
        returnToSeat: state.phase.returnToSeat,
        hand: state.phase.hand,
      },
    });
  }
  if (!state.phase.hand.includes(command.policy)) return reject(SECRETHITLER_REASONS.handChoice);
  const chosenIndex = state.phase.hand.indexOf(command.policy);
  const otherPolicy = state.phase.hand.find((_, index) => index !== chosenIndex);
  const policyDiscard =
    otherPolicy === undefined ? state.policyDiscard : [...state.policyDiscard, otherPolicy];
  return finishGovernment(
    state,
    command.policy,
    'government',
    state.phase.presidentSeat,
    state.phase.returnToSeat,
    context,
    { policyDiscard },
  );
}

function decideVetoRespond(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.policy.vetoRespond' }>,
  context: CommandContext,
): SecrethitlerDecision {
  if (state.phase.kind !== 'vetoResponse') return reject(SECRETHITLER_REASONS.phase);
  const president = requireCurrentPresident(state, context, state.phase.presidentSeat);
  if (typeof president !== 'number') return president;
  if (!command.approve)
    return patch({
      phase: {
        kind: 'legislativeChancellor',
        vetoRejected: true,
        presidentSeat: state.phase.presidentSeat,
        chancellorSeat: state.phase.chancellorSeat,
        returnToSeat: state.phase.returnToSeat,
        hand: state.phase.hand,
      },
    });
  const electionTracker = state.electionTracker + 1;
  const history = state.history;
  const policyDiscard = [...state.policyDiscard, ...state.phase.hand];
  if (electionTracker >= 3)
    return chaosPolicy(state, context, state.phase.returnToSeat, history, policyDiscard);
  const { nextSeat } = nextElectionAfterGovernment(
    state,
    state.phase.presidentSeat,
    state.phase.returnToSeat,
  );
  return patch({
    policyDiscard,
    electionTracker,
    nextPresidentSeat: nextSeat,
    phase: { kind: 'election', presidentSeat: nextSeat, returnToSeat: null },
  });
}

function powerPhase(
  state: SecrethitlerState,
  context: CommandContext,
  power: SecrethitlerPower,
): Extract<SecrethitlerPhase, { readonly kind: 'executive' }> | null {
  return state.phase.kind === 'executive' &&
    state.phase.power === power &&
    context.actor.kind === 'user'
    ? state.phase
    : null;
}

function resolvePowerPresident(
  state: SecrethitlerState,
  phase: Extract<SecrethitlerPhase, { readonly kind: 'executive' }>,
  context: CommandContext,
): SecrethitlerDecision | number {
  return requireCurrentPresident(state, context, phase.presidentSeat);
}

function appendAction(
  state: SecrethitlerState,
  action: SecrethitlerActionRecord,
): SecrethitlerState['history'] {
  return { ...state.history, actions: [...state.history.actions, action] };
}

function concludePower(
  state: SecrethitlerState,
  presidentSeat: number,
  returnToSeat: number | null,
  history: SecrethitlerState['history'],
  changes: Partial<SecrethitlerGameplayPatch> = {},
  livingSeats = state.livingSeats,
): SecrethitlerDecision {
  const { nextSeat } = nextElectionAfterGovernment(state, presidentSeat, returnToSeat, livingSeats);
  return patch({
    ...changes,
    history,
    nextPresidentSeat: nextSeat,
    phase: { kind: 'election', presidentSeat: nextSeat, returnToSeat: null },
  });
}

function decideInvestigate(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.action.investigate' }>,
  context: CommandContext,
): SecrethitlerDecision {
  const phase = powerPhase(state, context, 'investigate');
  if (phase === null) return reject(SECRETHITLER_REASONS.power);
  const president = resolvePowerPresident(state, phase, context);
  if (typeof president !== 'number') return president;
  const target = command.targetSeatId;
  const role = state.identities[target];
  if (
    role === undefined ||
    !state.livingSeats.includes(target) ||
    target === president ||
    state.investigatedSeats.includes(target)
  )
    return reject(SECRETHITLER_REASONS.target);
  const faction = getSecrethitlerFaction(role);
  const history = appendAction(state, {
    action: 'investigate',
    presidentSeat: president,
    targetSeat: target,
  });
  return concludePower(state, president, phase.returnToSeat, history, {
    investigatedSeats: [...state.investigatedSeats, target],
    lastInvestigation: { presidentSeat: president, targetSeat: target, faction },
  });
}

function decideSpecialElection(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.action.specialElection' }>,
  context: CommandContext,
): SecrethitlerDecision {
  const phase = powerPhase(state, context, 'specialElection');
  if (phase === null) return reject(SECRETHITLER_REASONS.power);
  const president = resolvePowerPresident(state, phase, context);
  if (typeof president !== 'number') return president;
  const target = command.targetSeatId;
  if (!state.livingSeats.includes(target) || target === president)
    return reject(SECRETHITLER_REASONS.target);
  const returnToSeat = nextLivingSeat(state.livingSeats, state.config.numberOfPlayers, president);
  const history = appendAction(state, {
    action: 'specialElection',
    presidentSeat: president,
    targetSeat: target,
  });
  return patch({
    history,
    phase: { kind: 'election', presidentSeat: target, returnToSeat },
  });
}

function decideExecute(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.action.execute' }>,
  context: CommandContext,
): SecrethitlerDecision {
  const phase = powerPhase(state, context, 'execute');
  if (phase === null) return reject(SECRETHITLER_REASONS.power);
  const president = resolvePowerPresident(state, phase, context);
  if (typeof president !== 'number') return president;
  const target = command.targetSeatId;
  const role = state.identities[target];
  if (role === undefined || !state.livingSeats.includes(target) || target === president)
    return reject(SECRETHITLER_REASONS.target);
  const livingSeats = state.livingSeats.filter((seat) => seat !== target);
  const history = appendAction(state, {
    action: 'execute',
    presidentSeat: president,
    targetSeat: target,
  });
  const changes = {
    livingSeats,
    nextPresidentSeat: livingSeats.includes(state.nextPresidentSeat)
      ? state.nextPresidentSeat
      : livingSeatAtOrAfter(livingSeats, state.config.numberOfPlayers, state.nextPresidentSeat),
  } satisfies Partial<SecrethitlerGameplayPatch>;
  if (role === 'hitler')
    return finishGame(state, 'liberal', 'hitlerExecuted', context, [
      { type: 'secrethitler.gameplay.updated', patch: { ...changes, history } },
    ]);
  const nextReturn =
    phase.returnToSeat === null
      ? null
      : livingSeatAtOrAfter(livingSeats, state.config.numberOfPlayers, phase.returnToSeat);
  return concludePower(state, president, nextReturn, history, changes, livingSeats);
}

function decideAcknowledgePeek(
  state: SecrethitlerState,
  context: CommandContext,
): SecrethitlerDecision {
  const phase = powerPhase(state, context, 'policyPeek');
  if (phase === null) return reject(SECRETHITLER_REASONS.power);
  const president = resolvePowerPresident(state, phase, context);
  if (typeof president !== 'number') return president;
  const history = appendAction(state, {
    action: 'policyPeek',
    presidentSeat: president,
    targetSeat: null,
  });
  return concludePower(state, president, phase.returnToSeat, history);
}

export function decideSecrethitlerGameplay(
  state: SecrethitlerState,
  command: SecrethitlerCommand,
  context: CommandContext,
): SecrethitlerDecision | null {
  switch (command.type) {
    case 'secrethitler.night.replay':
      return decideNightReplay(state, command, context);
    case 'secrethitler.night.confirm':
      return decideNightConfirm(state, command, context);
    case 'secrethitler.government.nominate':
      return decideNomination(state, command, context);
    case 'secrethitler.government.castVote':
      return decideVote(state, command, context);
    case 'secrethitler.policy.presidentDiscard':
      return decidePresidentDiscard(state, command, context);
    case 'secrethitler.policy.chancellorResolve':
      return decideChancellorResolve(state, command, context);
    case 'secrethitler.policy.vetoRespond':
      return decideVetoRespond(state, command, context);
    case 'secrethitler.action.investigate':
      return decideInvestigate(state, command, context);
    case 'secrethitler.action.specialElection':
      return decideSpecialElection(state, command, context);
    case 'secrethitler.action.execute':
      return decideExecute(state, command, context);
    case 'secrethitler.action.acknowledgePolicyPeek':
      return decideAcknowledgePeek(state, context);
    default:
      return null;
  }
}

export function beginSecrethitlerNight(): SecrethitlerDecision {
  return commitSecrethitler([
    {
      type: 'secrethitler.gameplay.updated',
      patch: { phase: { kind: 'night', step: 0, confirmedSeats: [] } },
    },
    {
      type: 'secrethitler.audio.queued',
      effects: [{ audioKey: 'night_start' }],
    },
  ]);
}
