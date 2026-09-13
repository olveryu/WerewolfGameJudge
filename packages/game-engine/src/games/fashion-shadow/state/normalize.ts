// Fail-fast invariants for authoritative Fashion Shadow state.

import { FASHION_SHADOW_GAME_TYPE } from '../../../platform/protocol/gameTypes';
import { FASHION_ROLE_BY_ID } from '../domain/content';
import {
  FASHION_CONTRACT_ID_MAX_LENGTH,
  FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH,
  FASHION_DISCUSSION_MESSAGE_MAX_LENGTH,
  FASHION_HEARING_STATEMENT_MAX_LENGTH,
  FASHION_INITIAL_ACTION_TOKENS,
  FASHION_MAX_CROSS_EXAM_STATEMENTS_PER_MATCH,
  FASHION_MAX_DISCUSSION_SPEAKS,
  FASHION_PLAYER_COUNT,
  FASHION_ROLE_IDS,
  FASHION_SECRET_IDS,
  type FashionState,
  isFashionEvidenceId,
} from './types';
import { FASHION_STATE_VERSION } from './version';

function assertSeat(seat: number, label: string): void {
  if (!Number.isSafeInteger(seat) || seat < 0 || seat >= FASHION_PLAYER_COUNT) {
    throw new Error(`${label} must be a Fashion Shadow seat`);
  }
}

function assertSeatRecord(record: Readonly<Record<number, unknown>>, label: string): void {
  for (const rawSeat of Object.keys(record)) {
    const seat = Number(rawSeat);
    if (String(seat) !== rawSeat) {
      throw new Error(`${label} key ${rawSeat} is not canonical`);
    }
    assertSeat(seat, `${label}.${rawSeat}`);
  }
}

export function normalizeFashionState(state: FashionState): FashionState {
  if (state.gameType !== FASHION_SHADOW_GAME_TYPE) {
    throw new Error(`Fashion gameType must be ${FASHION_SHADOW_GAME_TYPE}`);
  }
  if (state.stateVersion !== FASHION_STATE_VERSION) {
    throw new Error(`Unsupported Fashion state version ${state.stateVersion}`);
  }
  if (state.numberOfPlayers !== FASHION_PLAYER_COUNT) {
    throw new Error('Fashion Shadow requires exactly seven players');
  }
  if (state.currentRound < 1 || state.currentRound > 4) {
    throw new Error('Fashion currentRound must be 1-4');
  }
  if (state.roomCode.length === 0 || state.hostUserId.length === 0) {
    throw new Error('Fashion room identity must be non-empty');
  }

  assertSeatRecord(state.realSeats, 'Fashion realSeats');
  assertSeatRecord(state.roles, 'Fashion roles');
  assertSeatRecord(state.secrets, 'Fashion secrets');
  assertSeatRecord(state.actionTokens, 'Fashion actionTokens');
  assertSeatRecord(state.votes, 'Fashion votes');
  assertSeatRecord(state.discussionSpeakCounts, 'Fashion discussionSpeakCounts');
  assertSeatRecord(state.crossExamAwardVotes, 'Fashion crossExamAwardVotes');
  assertSeatRecord(state.revealedSecrets, 'Fashion revealedSecrets');
  assertSeatRecord(state.finalVotes, 'Fashion finalVotes');

  const userIds = new Set<string>();
  for (const [rawSeat, occupant] of Object.entries(state.realSeats)) {
    if (occupant === undefined) {
      throw new Error(`Fashion real seat ${rawSeat} cannot store undefined`);
    }
    const seat = Number(rawSeat);
    if (occupant.seat !== seat) {
      throw new Error(`Fashion real seat ${seat} stores mismatched seat ${occupant.seat}`);
    }
    if (occupant.userId.length === 0 || occupant.profile.displayName.length === 0) {
      throw new Error(`Fashion real seat ${seat} has invalid identity`);
    }
    if (userIds.has(occupant.userId)) {
      throw new Error(`Fashion user ${occupant.userId} occupies multiple seats`);
    }
    userIds.add(occupant.userId);
  }

  if (state.phase === 'lobby') {
    if (
      Object.keys(state.roles).length !== 0 ||
      Object.keys(state.secrets).length !== 0 ||
      Object.keys(state.actionTokens).length !== 0 ||
      state.roleConfirmedSeats.length !== 0 ||
      state.currentEvent !== null ||
      state.interrogation !== null
    ) {
      throw new Error('Fashion lobby cannot carry started-game state');
    }
  } else {
    if (Object.keys(state.realSeats).length !== FASHION_PLAYER_COUNT) {
      throw new Error('Started Fashion game requires seven occupied seats');
    }
    if (Object.keys(state.roles).length !== FASHION_PLAYER_COUNT) {
      throw new Error('Started Fashion game requires seven role assignments');
    }
    if (new Set(Object.values(state.roles)).size !== FASHION_ROLE_IDS.length) {
      throw new Error('Fashion role assignments must be unique');
    }
    if (Object.keys(state.secrets).length !== FASHION_PLAYER_COUNT) {
      throw new Error('Started Fashion game requires seven secret assignments');
    }
    if (new Set(Object.values(state.secrets)).size !== FASHION_SECRET_IDS.length) {
      throw new Error('Fashion secret assignments must be unique');
    }
    for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
      const roleId = state.roles[seat];
      const secretId = state.secrets[seat];
      const tokens = state.actionTokens[seat];
      if (roleId === undefined || secretId === undefined) {
        throw new Error(`Fashion seat ${seat} is missing private assignment`);
      }
      if (FASHION_ROLE_BY_ID[roleId].secretId !== secretId) {
        throw new Error(`Fashion seat ${seat} role and secret do not match`);
      }
      if (
        tokens === undefined ||
        !Number.isSafeInteger(tokens) ||
        tokens < 0 ||
        tokens > FASHION_INITIAL_ACTION_TOKENS
      ) {
        throw new Error(`Fashion seat ${seat} has invalid action tokens`);
      }
    }
  }

  let previousConfirmedSeat = -1;
  for (const seat of state.roleConfirmedSeats) {
    assertSeat(seat, 'Fashion roleConfirmedSeats');
    if (seat <= previousConfirmedSeat) {
      throw new Error('Fashion roleConfirmedSeats must be unique and ascending');
    }
    previousConfirmedSeat = seat;
  }

  for (const message of state.discussionMessages) {
    assertSeat(message.seat, 'Fashion discussion message seat');
    if (message.round < 1 || message.round > state.currentRound) {
      throw new Error('Fashion discussion message round is invalid');
    }
    if (
      message.message.trim().length === 0 ||
      message.message !== message.message.trim() ||
      message.message.length > FASHION_DISCUSSION_MESSAGE_MAX_LENGTH
    ) {
      throw new Error('Fashion discussion message content is invalid');
    }
    if (!Number.isSafeInteger(message.createdAt) || message.createdAt < 0) {
      throw new Error('Fashion discussion message timestamp is invalid');
    }
  }

  const crossExamStatementCounts = new Map<string, number>();
  for (const statement of state.crossExamStatements) {
    assertSeat(statement.seat, 'Fashion cross exam statement seat');
    if (statement.round < 1 || statement.round > state.currentRound) {
      throw new Error('Fashion cross exam statement round is invalid');
    }
    if (statement.match !== 1 && statement.match !== 2) {
      throw new Error('Fashion cross exam statement match is invalid');
    }
    if (statement.side !== 'attacker' && statement.side !== 'defender') {
      throw new Error('Fashion cross exam statement side is invalid');
    }
    if (
      statement.message.trim().length === 0 ||
      statement.message !== statement.message.trim() ||
      statement.message.length > FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH
    ) {
      throw new Error('Fashion cross exam statement content is invalid');
    }
    if (statement.evidenceId !== null && !isFashionEvidenceId(statement.evidenceId)) {
      throw new Error('Fashion cross exam statement evidence is invalid');
    }
    if (!Number.isSafeInteger(statement.createdAt) || statement.createdAt < 0) {
      throw new Error('Fashion cross exam statement timestamp is invalid');
    }
    const key = `${statement.round}:${statement.match}:${statement.seat}`;
    const nextCount = (crossExamStatementCounts.get(key) ?? 0) + 1;
    if (nextCount > FASHION_MAX_CROSS_EXAM_STATEMENTS_PER_MATCH) {
      throw new Error(`Fashion cross exam statement count exceeds limit for ${key}`);
    }
    crossExamStatementCounts.set(key, nextCount);
  }

  const hearingStatementSeats = new Set<number>();
  for (const statement of state.hearingStatements) {
    assertSeat(statement.seat, 'Fashion hearing statement seat');
    if (hearingStatementSeats.has(statement.seat)) {
      throw new Error(`Fashion seat ${statement.seat} has multiple hearing statements`);
    }
    hearingStatementSeats.add(statement.seat);
    if (
      statement.message.trim().length === 0 ||
      statement.message !== statement.message.trim() ||
      statement.message.length > FASHION_HEARING_STATEMENT_MAX_LENGTH
    ) {
      throw new Error('Fashion hearing statement content is invalid');
    }
    if (!state.publicEvidence.includes(statement.evidenceId)) {
      throw new Error('Fashion hearing statement must cite public evidence');
    }
    if (!Number.isSafeInteger(statement.createdAt) || statement.createdAt < 0) {
      throw new Error('Fashion hearing statement timestamp is invalid');
    }
  }

  const investigationVoteKeys = new Set<string>();
  for (const record of state.investigationVoteHistory) {
    assertSeat(record.seat, 'Fashion investigation vote seat');
    const key = `${record.round}:${record.seat}`;
    if (investigationVoteKeys.has(key)) {
      throw new Error(`Fashion investigation vote history duplicates ${key}`);
    }
    investigationVoteKeys.add(key);
  }

  let previousCrossExamParticipant = -1;
  for (const seat of state.crossExamParticipantSeats) {
    assertSeat(seat, 'Fashion cross exam participant seat');
    if (seat <= previousCrossExamParticipant) {
      throw new Error('Fashion cross exam participant seats must be unique and ascending');
    }
    previousCrossExamParticipant = seat;
  }
  for (const [rawVoterSeat, candidateSeat] of Object.entries(state.crossExamAwardVotes)) {
    assertSeat(Number(rawVoterSeat), 'Fashion cross exam award voter');
    assertSeat(candidateSeat, 'Fashion cross exam award candidate');
    if (!state.crossExamParticipantSeats.includes(candidateSeat)) {
      throw new Error(`Fashion cross exam award candidate ${candidateSeat} did not participate`);
    }
  }

  const awardRounds = new Set<number>();
  for (const award of state.crossExamAwards) {
    assertSeat(award.seat, 'Fashion cross exam award seat');
    if (awardRounds.has(award.round)) {
      throw new Error(`Fashion cross exam round ${award.round} has multiple awards`);
    }
    if (
      state.identityGuessPenalties.some(
        (penalty) => penalty.seat === award.seat && penalty.blockedRound === award.round,
      )
    ) {
      throw new Error(`Fashion blocked seat ${award.seat} cannot receive a cross exam award`);
    }
    awardRounds.add(award.round);
  }

  for (const penalty of state.identityGuessPenalties) {
    assertSeat(penalty.seat, 'Fashion identity guess penalty seat');
  }

  const contractIds = new Set<string>();
  for (const contract of state.contracts) {
    if (
      contract.id.length === 0 ||
      contract.id.length > FASHION_CONTRACT_ID_MAX_LENGTH ||
      contractIds.has(contract.id)
    ) {
      throw new Error(
        `Fashion contract id must be non-empty, at most ${FASHION_CONTRACT_ID_MAX_LENGTH} characters, and unique`,
      );
    }
    contractIds.add(contract.id);
    assertSeat(contract.sellerSeat, 'Fashion contract seller');
    assertSeat(contract.buyerSeat, 'Fashion contract buyer');
    if (contract.sellerSeat === contract.buyerSeat) {
      throw new Error('Fashion contract seller and buyer must differ');
    }
    const sellerRole = state.roles[contract.sellerSeat];
    if (sellerRole !== undefined && sellerRole !== 'factoryWorker') {
      throw new Error('Fashion contract seller must be the factory worker');
    }
  }

  for (const [rawSeat, targetSeat] of Object.entries(state.finalVotes)) {
    assertSeat(Number(rawSeat), 'Fashion hearing voter');
    assertSeat(targetSeat, 'Fashion hearing target');
  }

  for (const [rawSeat, count] of Object.entries(state.discussionSpeakCounts)) {
    const seat = Number(rawSeat);
    if (!Number.isSafeInteger(count) || count < 1 || count > FASHION_MAX_DISCUSSION_SPEAKS) {
      throw new Error(`Fashion discussion speak count invalid for seat ${seat}`);
    }
  }

  if (state.interrogation !== null) {
    if (state.interrogation.match !== 1 && state.interrogation.match !== 2) {
      throw new Error('Fashion interrogation match must be 1 or 2');
    }
    assertSeat(state.interrogation.attackerSeat, 'Fashion interrogation attacker');
    assertSeat(state.interrogation.defenderSeat, 'Fashion interrogation defender');
    if (state.interrogation.attackerSeat === state.interrogation.defenderSeat) {
      throw new Error('Fashion interrogation seats must differ');
    }
    const participantSeats = [...state.interrogation.participantSeats].sort(
      (left, right) => left - right,
    );
    for (let index = 0; index < participantSeats.length; index += 1) {
      const seat = participantSeats[index]!;
      assertSeat(seat, 'Fashion interrogation participant');
      if (index > 0 && participantSeats[index - 1] === seat) {
        throw new Error('Fashion interrogation participants must be unique');
      }
      if (
        state.identityGuessPenalties.some(
          (penalty) => penalty.seat === seat && penalty.blockedRound === state.currentRound,
        )
      ) {
        throw new Error(`Fashion blocked seat ${seat} cannot participate in cross examination`);
      }
    }
    if (state.interrogation.endsAt <= state.interrogation.startedAt) {
      throw new Error('Fashion interrogation timestamps are invalid');
    }
    if (state.phase !== 'crossExamination') {
      throw new Error('Fashion interrogation can exist only during crossExamination');
    }
  } else if (state.phase === 'crossExamination') {
    throw new Error('Fashion crossExamination phase requires interrogation state');
  }

  return state;
}
