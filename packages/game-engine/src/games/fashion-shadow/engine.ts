// Concrete authoritative engine for the first Fashion Shadow vertical slice.

import {
  type CommandContext,
  commit,
  type CommonGameLifecycle,
  type CreateGameContext,
  type Decision,
  type GameEngineDefinition,
  reject,
  resolveHostActorId,
  resolveUncontrolledUserActorId,
} from '../../platform/engine';
import {
  FASHION_SHADOW_GAME_TYPE,
  type FashionShadowGameType,
} from '../../platform/protocol/gameTypes';
import { REASON_GAME_IN_PROGRESS, REASON_NOT_SEATED } from '../../platform/protocol/reasons';
import {
  decideClearSeats,
  decideKickSeat,
  decideLeaveSeat,
  decideTakeSeat,
  findSeatByUserId,
  type SeatChange,
  type SeatOperationResult,
} from '../../platform/room/seating';
import type { FashionCommand } from './commands/types';
import { FASHION_NEXT_ROUND, FASHION_ROUND_BY_NUMBER } from './domain/content';
import type { FashionEvent } from './domain/events';
import { evolveFashionState } from './domain/evolve';
import {
  REASON_FASHION_ACTION_TOKEN_REQUIRED,
  REASON_FASHION_ALREADY_VOTED,
  REASON_FASHION_CROSS_EXAM_AWARD_ALREADY_SET,
  REASON_FASHION_CROSS_EXAM_AWARD_INVALID,
  REASON_FASHION_CROSS_EXAM_AWARD_VOTES_INCOMPLETE,
  REASON_FASHION_CROSS_EXAM_NOT_FINISHED,
  REASON_FASHION_DISCUSSION_LIMIT_REACHED,
  REASON_FASHION_IDENTITY_GUESS_ROUND_LIMIT,
  REASON_FASHION_IDENTITY_GUESS_TARGET_REPEATED,
  REASON_FASHION_PHASE_INVALID,
  REASON_FASHION_ROLE_ALREADY_CONFIRMED,
  REASON_FASHION_ROLE_NOT_ASSIGNED,
  REASON_FASHION_ROLES_NOT_CONFIRMED,
  REASON_FASHION_ROOM_NOT_FULL,
  REASON_FASHION_VOTES_INCOMPLETE,
} from './domain/reasons';
import { assignFashionRoles } from './domain/roles';
import { evaluateFashionVictory } from './domain/victoryEvaluator';
import type { FashionEffect } from './effects/types';
import { normalizeFashionState } from './state/normalize';
import {
  FASHION_CROSS_EXAM_DURATION_MS,
  FASHION_INITIAL_ACTION_TOKENS,
  FASHION_MAX_DISCUSSION_SPEAKS,
  FASHION_PLAYER_COUNT,
  type FashionConfig,
  type FashionContractPromise,
  type FashionHumanSeat,
  type FashionProfileUpdate,
  type FashionRoleId,
  type FashionSeatProfile,
  type FashionState,
  getFashionBotUserId,
  isFashionBotUserId,
  isFashionRoomFull,
} from './state/types';
import { FASHION_STATE_IDENTITY, FASHION_STATE_VERSION } from './state/version';

type FashionDecision = Decision<FashionEvent, FashionEffect>;

function commitFashion(events: readonly FashionEvent[]): FashionDecision {
  return commit({ events, broadcast: events.length === 0 ? 'none' : 'state' });
}

function seatChangesEvent(changes: readonly SeatChange<FashionHumanSeat>[]): FashionEvent {
  return { type: 'fashion.seats.changed', changes };
}

function rejectSeatOperation(
  result: Extract<SeatOperationResult<FashionHumanSeat>, { readonly kind: 'rejected' }>,
): FashionDecision {
  return reject(result.reason);
}

function requireLobby(state: FashionState): FashionDecision | null {
  return state.phase === 'lobby' ? null : reject(REASON_GAME_IN_PROGRESS);
}

function decideTakeFashionSeat(
  state: FashionState,
  seat: number,
  profile: FashionSeatProfile,
  context: CommandContext,
): FashionDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const result = decideTakeSeat(
    state.realSeats,
    state.numberOfPlayers,
    seat,
    actor.value,
    (targetSeat): FashionHumanSeat => ({
      userId: actor.value,
      seat: targetSeat,
      profile: { ...profile },
    }),
  );
  return result.kind === 'rejected'
    ? rejectSeatOperation(result)
    : commitFashion([seatChangesEvent(result.changes)]);
}

function decideLeaveFashionSeat(state: FashionState, context: CommandContext): FashionDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const result = decideLeaveSeat(state.realSeats, state.numberOfPlayers, actor.value);
  return result.kind === 'rejected'
    ? rejectSeatOperation(result)
    : commitFashion([seatChangesEvent(result.changes)]);
}

function decideKickFashionSeat(
  state: FashionState,
  seat: number,
  context: CommandContext,
): FashionDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const result = decideKickSeat(state.realSeats, state.numberOfPlayers, seat);
  return result.kind === 'rejected'
    ? rejectSeatOperation(result)
    : commitFashion([seatChangesEvent(result.changes)]);
}

function decideClearFashionSeats(state: FashionState, context: CommandContext): FashionDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const result = decideClearSeats(state.realSeats, state.numberOfPlayers);
  if (result.kind === 'rejected') return rejectSeatOperation(result);
  return commitFashion(result.changes.length === 0 ? [] : [seatChangesEvent(result.changes)]);
}

function getFashionBotSeats(state: FashionState): number[] {
  return Object.entries(state.realSeats)
    .filter(([, occupant]) => occupant !== undefined && isFashionBotUserId(occupant.userId))
    .map(([seat]) => Number(seat))
    .sort((left, right) => left - right);
}

function hasFashionBots(state: FashionState): boolean {
  return getFashionBotSeats(state).length > 0;
}

function createFashionBotSeat(seat: number): FashionHumanSeat {
  return {
    userId: getFashionBotUserId(seat),
    seat,
    profile: { displayName: `测试玩家 ${seat + 1}` },
  };
}

function decideFillFashionBots(state: FashionState, context: CommandContext): FashionDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);

  const changes: SeatChange<FashionHumanSeat>[] = [];
  for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
    if (state.realSeats[seat] !== undefined) continue;
    changes.push({ seat, previous: null, next: createFashionBotSeat(seat) });
  }
  return commitFashion(changes.length === 0 ? [] : [seatChangesEvent(changes)]);
}

function createFashionBotInvestigationVotes(state: FashionState): FashionEvent[] {
  const botSeats = getFashionBotSeats(state);
  const approveCount = Math.floor(botSeats.length / 2);
  return botSeats.map((seat, index) => ({
    type: 'fashion.vote.cast',
    seat,
    vote: index < approveCount ? 'approve' : 'reject',
  }));
}

function createFashionBotCrossExamAwardVotes(state: FashionState): FashionEvent[] {
  if (state.crossExamParticipantSeats.length === 0) return [];
  return getFashionBotSeats(state).map((seat, index) => ({
    type: 'fashion.crossExam.awardVoted',
    voterSeat: seat,
    candidateSeat: state.crossExamParticipantSeats[index % state.crossExamParticipantSeats.length]!,
  }));
}

function createFashionBotHearingVotes(state: FashionState): FashionEvent[] {
  return getFashionBotSeats(state).map((seat, index) => ({
    type: 'fashion.hearing.vote',
    seat,
    targetSeat: index % FASHION_PLAYER_COUNT,
  }));
}

function decideUpdateFashionProfile(
  state: FashionState,
  profile: FashionProfileUpdate,
  context: CommandContext,
): FashionDecision {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const seat = findSeatByUserId(state.realSeats, state.numberOfPlayers, actor.value);
  return seat === null
    ? reject(REASON_NOT_SEATED)
    : commitFashion([{ type: 'fashion.profile.updated', seat, profile: { ...profile } }]);
}

function getActorSeat(state: FashionState, context: CommandContext): number | FashionDecision {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const seat = findSeatByUserId(state.realSeats, state.numberOfPlayers, actor.value);
  return seat === null ? reject(REASON_NOT_SEATED) : seat;
}

function getActionTokens(state: FashionState, seat: number): number {
  const tokens = state.actionTokens[seat];
  if (tokens === undefined) {
    throw new Error(`Fashion seat ${seat} is missing action tokens`);
  }
  return tokens;
}

function decideStartFashionGame(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'lobby') return reject(REASON_FASHION_PHASE_INVALID);
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (!isFashionRoomFull(state)) return reject(REASON_FASHION_ROOM_NOT_FULL);

  const assignments = assignFashionRoles(context.randomSeed);
  const actionTokens: Record<number, number> = {};
  for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
    actionTokens[seat] = FASHION_INITIAL_ACTION_TOKENS;
  }
  return commitFashion([
    {
      type: 'fashion.game.started',
      roles: assignments.roles,
      secrets: assignments.secrets,
      actionTokens,
    },
    ...getFashionBotSeats(state).map(
      (seat): FashionEvent => ({ type: 'fashion.role.confirmed', seat }),
    ),
  ]);
}

function decideConfirmFashionRole(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'roleReveal') return reject(REASON_FASHION_PHASE_INVALID);
  const seat = getActorSeat(state, context);
  if (typeof seat !== 'number') return seat;
  if (state.roles[seat] === undefined || state.secrets[seat] === undefined) {
    return reject(REASON_FASHION_ROLE_NOT_ASSIGNED);
  }
  if (state.roleConfirmedSeats.includes(seat)) {
    return reject(REASON_FASHION_ROLE_ALREADY_CONFIRMED);
  }
  return commitFashion([{ type: 'fashion.role.confirmed', seat }]);
}

function decideRevealFashionEvent(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'roleReveal') return reject(REASON_FASHION_PHASE_INVALID);
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.roleConfirmedSeats.length !== FASHION_PLAYER_COUNT) {
    return reject(REASON_FASHION_ROLES_NOT_CONFIRMED);
  }
  return commitFashion([
    {
      type: 'fashion.event.revealed',
      eventId: FASHION_ROUND_BY_NUMBER[state.currentRound].eventId,
    },
  ]);
}

function findSeatWithRole(state: FashionState, roleId: FashionRoleId): number {
  for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
    if (state.roles[seat] === roleId) return seat;
  }
  throw new Error(`Fashion state is missing required role ${roleId}`);
}

function createCrossExamStartedEvent(
  state: FashionState,
  match: 1 | 2,
  nowMs: number,
): Extract<FashionEvent, { readonly type: 'fashion.crossExam.started' }> | null {
  const round = FASHION_ROUND_BY_NUMBER[state.currentRound];
  const [attackerRole, defenderRole] = match === 1 ? round.mainCrossExam : round.secondaryCrossExam;
  const designatedAttacker = findSeatWithRole(state, attackerRole);
  const designatedDefender = findSeatWithRole(state, defenderRole);
  const blockedSeats = new Set(
    state.identityGuessPenalties
      .filter((penalty) => penalty.blockedRound === state.currentRound)
      .map((penalty) => penalty.seat),
  );
  const priorParticipants =
    match === 2 ? new Set(state.crossExamParticipantSeats) : new Set<number>();
  const chooseSeat = (preferred: number, excluded: ReadonlySet<number>): number | null => {
    if (
      !blockedSeats.has(preferred) &&
      !priorParticipants.has(preferred) &&
      !excluded.has(preferred) &&
      getActionTokens(state, preferred) > 0
    ) {
      return preferred;
    }
    for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
      if (
        blockedSeats.has(seat) ||
        priorParticipants.has(seat) ||
        excluded.has(seat) ||
        getActionTokens(state, seat) < 1
      )
        continue;
      return seat;
    }
    return null;
  };
  const attackerSeat = chooseSeat(designatedAttacker, new Set());
  if (attackerSeat === null) return null;
  const defenderSeat = chooseSeat(designatedDefender, new Set([attackerSeat]));
  if (defenderSeat === null) return null;
  return {
    type: 'fashion.crossExam.started',
    match,
    attackerSeat,
    defenderSeat,
    participantSeats: [attackerSeat, defenderSeat],
    startedAt: nowMs,
    endsAt: nowMs + FASHION_CROSS_EXAM_DURATION_MS,
  };
}

function decideStartCrossExam(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'event') return reject(REASON_FASHION_PHASE_INVALID);
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const event = createCrossExamStartedEvent(state, 1, context.nowMs);
  return event === null ? reject(REASON_FASHION_ACTION_TOKEN_REQUIRED) : commitFashion([event]);
}

function decideRevealOwnSecret(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'crossExamination' || state.interrogation === null) {
    return reject(REASON_FASHION_PHASE_INVALID);
  }
  const seat = getActorSeat(state, context);
  if (typeof seat !== 'number') return seat;
  if (!state.interrogation.participantSeats.includes(seat)) {
    return reject(REASON_FASHION_CROSS_EXAM_AWARD_INVALID);
  }
  const secretId = state.secrets[seat];
  if (secretId === undefined) return reject(REASON_FASHION_ROLE_NOT_ASSIGNED);
  if (state.revealedSecrets[seat] !== undefined) return commitFashion([]);
  return commitFashion([{ type: 'fashion.secret.revealed', seat, secretId }]);
}

function decideAwardCrossExam(
  state: FashionState,
  seat: number,
  context: CommandContext,
): FashionDecision {
  if (state.phase !== 'discussion') return reject(REASON_FASHION_PHASE_INVALID);
  const voterSeat = getActorSeat(state, context);
  if (typeof voterSeat !== 'number') return voterSeat;
  if (!state.crossExamParticipantSeats.includes(seat)) {
    return reject(REASON_FASHION_CROSS_EXAM_AWARD_INVALID);
  }
  if (state.crossExamAwardVotes[voterSeat] !== undefined) {
    return reject(REASON_FASHION_CROSS_EXAM_AWARD_ALREADY_SET);
  }
  return commitFashion([{ type: 'fashion.crossExam.awardVoted', voterSeat, candidateSeat: seat }]);
}

function decideFinishCrossExam(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'crossExamination') return reject(REASON_FASHION_PHASE_INVALID);
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const interrogation = state.interrogation;
  if (interrogation === null) {
    throw new Error('Fashion crossExamination phase is missing interrogation state');
  }
  if (context.nowMs < interrogation.endsAt && !hasFashionBots(state)) {
    return reject(REASON_FASHION_CROSS_EXAM_NOT_FINISHED);
  }
  if (interrogation.match === 1) {
    const secondMatch = createCrossExamStartedEvent(state, 2, context.nowMs);
    return secondMatch === null
      ? reject(REASON_FASHION_ACTION_TOKEN_REQUIRED)
      : commitFashion([secondMatch]);
  }
  return commitFashion([
    { type: 'fashion.crossExam.finished' },
    ...createFashionBotCrossExamAwardVotes(state),
  ]);
}

function decideDiscussionSpeak(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'discussion') return reject(REASON_FASHION_PHASE_INVALID);
  const seat = getActorSeat(state, context);
  if (typeof seat !== 'number') return seat;
  if (getActionTokens(state, seat) < 1) {
    return reject(REASON_FASHION_ACTION_TOKEN_REQUIRED);
  }
  if ((state.discussionSpeakCounts[seat] ?? 0) >= FASHION_MAX_DISCUSSION_SPEAKS) {
    return reject(REASON_FASHION_DISCUSSION_LIMIT_REACHED);
  }
  return commitFashion([{ type: 'fashion.discussion.spoken', seat }]);
}

function resolveCrossExamAwardSeat(state: FashionState): number | null {
  const counts = new Map<number, number>();
  for (const candidateSeat of Object.values(state.crossExamAwardVotes)) {
    counts.set(candidateSeat, (counts.get(candidateSeat) ?? 0) + 1);
  }
  let bestCount = 0;
  let bestSeats: number[] = [];
  for (const [seat, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestSeats = [seat];
    } else if (count === bestCount) {
      bestSeats.push(seat);
    }
  }
  return bestSeats.length === 1 ? bestSeats[0]! : null;
}

function decideFinishDiscussion(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'discussion') return reject(REASON_FASHION_PHASE_INVALID);
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (Object.keys(state.crossExamAwardVotes).length !== FASHION_PLAYER_COUNT) {
    return reject(REASON_FASHION_CROSS_EXAM_AWARD_VOTES_INCOMPLETE);
  }
  const awardedSeat = resolveCrossExamAwardSeat(state);
  return commitFashion([
    ...(awardedSeat === null
      ? []
      : [
          {
            type: 'fashion.crossExam.awarded' as const,
            award: { round: state.currentRound, seat: awardedSeat },
          },
        ]),
    { type: 'fashion.discussion.finished' },
    ...createFashionBotInvestigationVotes(state),
  ]);
}

function decideCastFashionVote(
  state: FashionState,
  vote: Extract<FashionCommand, { readonly type: 'fashion.vote.cast' }>['vote'],
  context: CommandContext,
): FashionDecision {
  if (state.phase !== 'vote') return reject(REASON_FASHION_PHASE_INVALID);
  const seat = getActorSeat(state, context);
  if (typeof seat !== 'number') return seat;
  if (state.votes[seat] !== undefined) return reject(REASON_FASHION_ALREADY_VOTED);
  return commitFashion([{ type: 'fashion.vote.cast', seat, vote }]);
}

function decideFinishFashionVote(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'vote') return reject(REASON_FASHION_PHASE_INVALID);
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (Object.keys(state.votes).length !== FASHION_PLAYER_COUNT) {
    return reject(REASON_FASHION_VOTES_INCOMPLETE);
  }
  const approveCount = Object.values(state.votes).filter((vote) => vote === 'approve').length;
  const approved = approveCount > FASHION_PLAYER_COUNT / 2;
  return commitFashion([
    {
      type: 'fashion.vote.finished',
      approved,
      evidenceId: FASHION_ROUND_BY_NUMBER[state.currentRound].evidenceId,
    },
  ]);
}

function decideProposeContract(
  state: FashionState,
  contractId: string,
  buyerSeat: number,
  promise: FashionContractPromise,
  context: CommandContext,
): FashionDecision {
  if (state.phase !== 'roundTransition') return reject(REASON_FASHION_PHASE_INVALID);
  const sellerSeat = getActorSeat(state, context);
  if (typeof sellerSeat !== 'number') return sellerSeat;
  if (state.secrets[sellerSeat] === undefined || state.roles[sellerSeat] !== 'factoryWorker') {
    return reject(REASON_FASHION_ROLE_NOT_ASSIGNED);
  }
  if (getActionTokens(state, sellerSeat) < 1) {
    return reject(REASON_FASHION_ACTION_TOKEN_REQUIRED);
  }
  if (
    contractId.length === 0 ||
    state.contracts.some((contract) => contract.id === contractId) ||
    state.realSeats[buyerSeat] === undefined ||
    buyerSeat === sellerSeat
  ) {
    return reject(REASON_FASHION_PHASE_INVALID);
  }
  return commitFashion([
    {
      type: 'fashion.contract.proposed',
      contract: {
        id: contractId,
        sellerSeat,
        buyerSeat,
        promise,
        status: 'proposed',
      },
    },
  ]);
}

function decideAcceptContract(
  state: FashionState,
  contractId: string,
  context: CommandContext,
): FashionDecision {
  if (state.phase !== 'roundTransition') return reject(REASON_FASHION_PHASE_INVALID);
  const seat = getActorSeat(state, context);
  if (typeof seat !== 'number') return seat;
  const contract = state.contracts.find((item) => item.id === contractId);
  if (contract === undefined || contract.buyerSeat !== seat || contract.status !== 'proposed') {
    return reject(REASON_FASHION_PHASE_INVALID);
  }
  return commitFashion([{ type: 'fashion.contract.accepted', contractId }]);
}

function decideFulfillContract(
  state: FashionState,
  contractId: string,
  context: CommandContext,
): FashionDecision {
  const seat = getActorSeat(state, context);
  if (typeof seat !== 'number') return seat;
  const contract = state.contracts.find((item) => item.id === contractId);
  if (contract === undefined || contract.sellerSeat !== seat || contract.status !== 'accepted') {
    return reject(REASON_FASHION_PHASE_INVALID);
  }
  return commitFashion([{ type: 'fashion.contract.fulfilled', contractId }]);
}

function decideIdentityGuess(
  state: FashionState,
  targetSeat: number,
  guessedRoleId: FashionRoleId,
  context: CommandContext,
): FashionDecision {
  if (state.phase !== 'vote') return reject(REASON_FASHION_PHASE_INVALID);
  const guesserSeat = getActorSeat(state, context);
  if (typeof guesserSeat !== 'number') return guesserSeat;
  if (targetSeat === guesserSeat || state.realSeats[targetSeat] === undefined) {
    return reject(REASON_FASHION_PHASE_INVALID);
  }
  if (getActionTokens(state, guesserSeat) < 1) {
    return reject(REASON_FASHION_ACTION_TOKEN_REQUIRED);
  }
  const guessHistory = state.identityGuessHistory.filter(
    (entry) => entry.guesserSeat === guesserSeat,
  );
  if (guessHistory.some((entry) => entry.round === state.currentRound)) {
    return reject(REASON_FASHION_IDENTITY_GUESS_ROUND_LIMIT);
  }
  const previousGuess = guessHistory[guessHistory.length - 1];
  if (
    previousGuess !== undefined &&
    previousGuess.round === state.currentRound - 1 &&
    previousGuess.targetSeat === targetSeat
  ) {
    return reject(REASON_FASHION_IDENTITY_GUESS_TARGET_REPEATED);
  }
  const actualRole = state.roles[targetSeat];
  const actualSecret = state.secrets[targetSeat];
  if (actualRole === undefined || actualSecret === undefined) {
    return reject(REASON_FASHION_ROLE_NOT_ASSIGNED);
  }
  const success = actualRole === guessedRoleId;
  return commitFashion([
    {
      type: 'fashion.identityGuess.cast',
      guesserSeat,
      targetSeat,
      guessedRoleId,
      success,
      revealedSecretId: success ? actualSecret : null,
    },
  ]);
}

function decideAdvanceRound(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'roundTransition') return reject(REASON_FASHION_PHASE_INVALID);
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const nextRound = FASHION_NEXT_ROUND[state.currentRound];
  if (nextRound === null) return reject(REASON_FASHION_PHASE_INVALID);
  return commitFashion([
    {
      type: 'fashion.round.advanced',
      round: nextRound,
      eventId: FASHION_ROUND_BY_NUMBER[nextRound].eventId,
    },
  ]);
}

function decideStartHearing(state: FashionState, context: CommandContext): FashionDecision {
  if (state.currentRound !== 4 || state.phase !== 'roundTransition')
    return reject(REASON_FASHION_PHASE_INVALID);
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  return commitFashion([
    { type: 'fashion.hearing.started' },
    ...createFashionBotHearingVotes(state),
  ]);
}

function decideHearingVote(
  state: FashionState,
  targetSeat: number,
  context: CommandContext,
): FashionDecision {
  if (state.phase !== 'hearing') return reject(REASON_FASHION_PHASE_INVALID);
  const seat = getActorSeat(state, context);
  if (typeof seat !== 'number') return seat;
  if (state.realSeats[targetSeat] === undefined) return reject(REASON_FASHION_PHASE_INVALID);
  if (state.finalVotes[seat] !== undefined) return reject(REASON_FASHION_ALREADY_VOTED);
  return commitFashion([{ type: 'fashion.hearing.vote', seat, targetSeat }]);
}

function decideFinishHearing(state: FashionState, context: CommandContext): FashionDecision {
  if (state.phase !== 'hearing') return reject(REASON_FASHION_PHASE_INVALID);
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (Object.keys(state.finalVotes).length !== FASHION_PLAYER_COUNT) {
    return reject(REASON_FASHION_VOTES_INCOMPLETE);
  }
  const { winners } = evaluateFashionVictory(state);
  return commitFashion([{ type: 'fashion.hearing.finished', winners }]);
}

function createInitialFashionState(
  config: FashionConfig,
  context: CreateGameContext,
): FashionState {
  if (config.numberOfPlayers !== FASHION_PLAYER_COUNT) {
    throw new Error(`Invalid Fashion config: numberOfPlayers must be ${FASHION_PLAYER_COUNT}`);
  }
  return normalizeFashionState({
    ...FASHION_STATE_IDENTITY,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    phase: 'lobby',
    currentRound: 1,
    numberOfPlayers: FASHION_PLAYER_COUNT,
    realSeats: {},
    roles: {},
    secrets: {},
    roleConfirmedSeats: [],
    actionTokens: {},
    currentEvent: null,
    publicEvidence: [],
    destroyedEvidence: [],
    votes: {},
    investigationVoteHistory: [],
    discussionSpeakCounts: {},
    interrogation: null,
    crossExamParticipantSeats: [],
    crossExamAwardVotes: {},
    contracts: [],
    identityGuessPenalties: [],
    identityGuessHistory: [],
    revealedSecrets: {},
    crossExamAwards: [],
    finalVotes: {},
    winners: [],
  });
}

export function getFashionLifecycle(state: FashionState): CommonGameLifecycle {
  if (state.phase === 'lobby') return 'setup';
  return state.phase === 'ended' ? 'ended' : 'ongoing';
}

export function decideFashionCommand(
  state: FashionState,
  command: FashionCommand,
  context: CommandContext,
): FashionDecision {
  switch (command.type) {
    case 'room.seat.take':
      return decideTakeFashionSeat(state, command.seat, command.profile, context);
    case 'room.seat.leave':
      return decideLeaveFashionSeat(state, context);
    case 'room.seat.kick':
      return decideKickFashionSeat(state, command.seat, context);
    case 'room.seat.clear':
      return decideClearFashionSeats(state, context);
    case 'room.seat.fillBots':
      return decideFillFashionBots(state, context);
    case 'room.profile.update':
      return decideUpdateFashionProfile(state, command.profile, context);
    case 'fashion.game.start':
      return decideStartFashionGame(state, context);
    case 'fashion.role.confirm':
      return decideConfirmFashionRole(state, context);
    case 'fashion.event.reveal':
      return decideRevealFashionEvent(state, context);
    case 'fashion.crossExam.start':
      return decideStartCrossExam(state, context);
    case 'fashion.secret.revealSelf':
      return decideRevealOwnSecret(state, context);
    case 'fashion.crossExam.award':
      return decideAwardCrossExam(state, command.seat, context);
    case 'fashion.crossExam.finish':
      return decideFinishCrossExam(state, context);
    case 'fashion.discussion.speak':
      return decideDiscussionSpeak(state, context);
    case 'fashion.discussion.finish':
      return decideFinishDiscussion(state, context);
    case 'fashion.vote.cast':
      return decideCastFashionVote(state, command.vote, context);
    case 'fashion.vote.finish':
      return decideFinishFashionVote(state, context);
    case 'fashion.identityGuess.cast':
      return decideIdentityGuess(state, command.targetSeat, command.guessedRoleId, context);
    case 'fashion.round.advance':
      return decideAdvanceRound(state, context);
    case 'fashion.hearing.start':
      return decideStartHearing(state, context);
    case 'fashion.hearing.vote':
      return decideHearingVote(state, command.targetSeat, context);
    case 'fashion.hearing.finish':
      return decideFinishHearing(state, context);
    case 'fashion.contract.propose':
      return decideProposeContract(
        state,
        command.contractId,
        command.buyerSeat,
        command.promise,
        context,
      );
    case 'fashion.contract.accept':
      return decideAcceptContract(state, command.contractId, context);
    case 'fashion.contract.fulfill':
      return decideFulfillContract(state, command.contractId, context);
  }
  const exhaustive: never = command;
  return exhaustive;
}

export const fashionEngine = {
  gameType: FASHION_SHADOW_GAME_TYPE,
  stateVersion: FASHION_STATE_VERSION,
  createInitialState: createInitialFashionState,
  decide: decideFashionCommand,
  evolve: evolveFashionState,
  normalize: normalizeFashionState,
  getLifecycle: getFashionLifecycle,
} satisfies GameEngineDefinition<
  FashionShadowGameType,
  FashionState,
  FashionConfig,
  FashionCommand,
  FashionEvent,
  FashionEffect
>;

export type FashionEngine = typeof fashionEngine;
