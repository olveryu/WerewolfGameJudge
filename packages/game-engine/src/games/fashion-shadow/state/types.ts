// Authoritative state contracts for Fashion Shadow.

import type { FashionShadowGameType } from '../../../platform/protocol/gameTypes';
import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { SeatOccupant } from '../../../platform/room/seating';

export const FASHION_PLAYER_COUNT = 7 as const;
export const FASHION_INITIAL_ACTION_TOKENS = 3 as const;
export const FASHION_CROSS_EXAM_DURATION_MS = 180_000 as const;
export const FASHION_MAX_DISCUSSION_SPEAKS = 2 as const;
export const FASHION_BOT_USER_ID_PREFIX = 'fashion-bot:' as const;

export function getFashionBotUserId(seat: number): string {
  return `${FASHION_BOT_USER_ID_PREFIX}${seat}`;
}

export function isFashionBotUserId(userId: string): boolean {
  return userId.startsWith(FASHION_BOT_USER_ID_PREFIX);
}

export const FASHION_ROLE_IDS = [
  'journalist',
  'governmentOfficial',
  'consumerRepresentative',
  'factoryWorker',
  'brandExecutive',
  'villainProcurementDirector',
  'supplierOwner',
] as const;
export type FashionRoleId = (typeof FASHION_ROLE_IDS)[number];

export const FASHION_SECRET_IDS = [
  'journalistFormerEmployerAdPressure',
  'governmentOfficialInspectionFavor',
  'consumerRepresentativeVelaSponsorship',
  'factoryWorkerSignedRelabelInstruction',
  'brandExecutiveKnewLabelProblem',
  'villainMastermind',
  'supplierOwnerOriginalOrdersAndBreach',
] as const;
export type FashionSecretId = (typeof FASHION_SECRET_IDS)[number];

export const FASHION_EVENT_IDS = ['E1', 'E2', 'E3', 'E4'] as const;
export type FashionEventId = (typeof FASHION_EVENT_IDS)[number];

export const FASHION_EVIDENCE_IDS = ['V1', 'V2', 'V3', 'V4'] as const;
export type FashionEvidenceId = (typeof FASHION_EVIDENCE_IDS)[number];

export type FashionPhase =
  | 'lobby'
  | 'roleReveal'
  | 'event'
  | 'crossExamination'
  | 'discussion'
  | 'vote'
  | 'roundTransition'
  | 'hearing'
  | 'ended';

export type FashionRound = 1 | 2 | 3 | 4;
export type FashionInvestigationVote = 'approve' | 'reject';

export type FashionSeatProfile = RoomSeatProfile;
export type FashionProfileUpdate = RoomProfileUpdate;

export interface FashionHumanSeat extends SeatOccupant {
  readonly profile: FashionSeatProfile;
}

export interface FashionInterrogation {
  readonly match: 1 | 2;
  readonly attackerSeat: number;
  readonly defenderSeat: number;
  readonly participantSeats: readonly number[];
  readonly startedAt: number;
  readonly endsAt: number;
}

export type FashionContractPromise = 'compensation' | 'protection' | 'legalImmunity';

export type FashionContractStatus = 'proposed' | 'accepted' | 'fulfilled';

export interface FashionContract {
  readonly id: string;
  readonly sellerSeat: number;
  readonly buyerSeat: number;
  readonly promise: FashionContractPromise;
  readonly status: FashionContractStatus;
}

export interface FashionIdentityGuessHistory {
  readonly guesserSeat: number;
  readonly targetSeat: number;
  readonly round: FashionRound;
}

export interface FashionIdentityGuessPenalty {
  readonly seat: number;
  readonly blockedRound: FashionRound;
}

export interface FashionInvestigationVoteRecord {
  readonly round: FashionRound;
  readonly seat: number;
  readonly vote: FashionInvestigationVote;
}

export interface FashionCrossExamAward {
  readonly round: FashionRound;
  readonly seat: number;
}

export interface FashionState extends BaseGameState<FashionShadowGameType> {
  readonly phase: FashionPhase;
  readonly currentRound: FashionRound;
  readonly numberOfPlayers: typeof FASHION_PLAYER_COUNT;
  readonly realSeats: Readonly<Record<number, FashionHumanSeat | undefined>>;
  // Private authoritative assignments. Outbound transport must project these per user.
  readonly roles: Readonly<Record<number, FashionRoleId>>;
  readonly secrets: Readonly<Record<number, FashionSecretId>>;
  readonly roleConfirmedSeats: readonly number[];
  readonly actionTokens: Readonly<Record<number, number>>;
  readonly currentEvent: FashionEventId | null;
  readonly publicEvidence: readonly FashionEvidenceId[];
  readonly destroyedEvidence: readonly FashionEvidenceId[];
  readonly votes: Readonly<Record<number, FashionInvestigationVote>>;
  readonly investigationVoteHistory: readonly FashionInvestigationVoteRecord[];
  readonly discussionSpeakCounts: Readonly<Record<number, number>>;
  readonly interrogation: FashionInterrogation | null;
  readonly crossExamParticipantSeats: readonly number[];
  readonly crossExamAwardVotes: Readonly<Record<number, number>>;
  readonly contracts: readonly FashionContract[];
  readonly identityGuessPenalties: readonly FashionIdentityGuessPenalty[];
  readonly identityGuessHistory: readonly FashionIdentityGuessHistory[];
  readonly revealedSecrets: Readonly<Record<number, FashionSecretId>>;
  readonly crossExamAwards: readonly FashionCrossExamAward[];
  readonly finalVotes: Readonly<Record<number, number>>;
  readonly winners: readonly number[];
}

export interface FashionConfig {
  readonly numberOfPlayers: typeof FASHION_PLAYER_COUNT;
}

export function isFashionRoleId(value: unknown): value is FashionRoleId {
  return FASHION_ROLE_IDS.some((roleId) => roleId === value);
}
export function isFashionSecretId(value: unknown): value is FashionSecretId {
  return FASHION_SECRET_IDS.some((secretId) => secretId === value);
}
export function isFashionEventId(value: unknown): value is FashionEventId {
  return FASHION_EVENT_IDS.some((eventId) => eventId === value);
}
export function isFashionEvidenceId(value: unknown): value is FashionEvidenceId {
  return FASHION_EVIDENCE_IDS.some((evidenceId) => evidenceId === value);
}
export function isFashionInvestigationVote(value: unknown): value is FashionInvestigationVote {
  return value === 'approve' || value === 'reject';
}
export function isFashionRoomFull(state: FashionState): boolean {
  return Object.keys(state.realSeats).length === FASHION_PLAYER_COUNT;
}
