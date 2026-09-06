// Public pure API for the Fashion Shadow game module.

export type {
  FashionCommand,
  FashionInternalCommand,
  FashionPublicCommand,
} from './commands/types';
export {
  FASHION_ROLE_BY_ID,
  FASHION_ROUND_BY_NUMBER,
  type FashionRoleDefinition,
  type FashionRoundDefinition,
  getFashionRoleDefinition,
} from './domain/content';
export {
  REASON_FASHION_ACTION_TOKEN_REQUIRED,
  REASON_FASHION_ALREADY_VOTED,
  REASON_FASHION_BOTS_NOT_SUPPORTED,
  REASON_FASHION_CROSS_EXAM_AWARD_ALREADY_SET,
  REASON_FASHION_CROSS_EXAM_AWARD_INVALID,
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
export { assignFashionRoles, type FashionAssignments } from './domain/roles';
export {
  type FashionPrivateIdentityView,
  type FashionPublicState,
  getFashionPublicState,
  getFashionUserSeat,
} from './domain/visibility';
export type { FashionEffect } from './effects/types';
export {
  decideFashionCommand,
  type FashionEngine,
  fashionEngine,
  getFashionLifecycle,
} from './engine';
export { type FashionPublicStats, parseFashionPublicStats } from './publicStats';
export { FASHION_STATE_CODEC } from './state/codec';
export { parseFashionState } from './state/parseState';
export { FASHION_PUBLIC_STATE_CODEC, parseFashionPublicState } from './state/publicCodec';
export {
  FASHION_CROSS_EXAM_DURATION_MS,
  FASHION_EVENT_IDS,
  FASHION_EVIDENCE_IDS,
  FASHION_INITIAL_ACTION_TOKENS,
  FASHION_MAX_DISCUSSION_SPEAKS,
  FASHION_PLAYER_COUNT,
  FASHION_ROLE_IDS,
  FASHION_SECRET_IDS,
  type FashionConfig,
  type FashionCrossExamAward,
  type FashionEventId,
  type FashionEvidenceId,
  type FashionHumanSeat,
  type FashionInterrogation,
  type FashionInvestigationVote,
  type FashionInvestigationVoteRecord,
  type FashionPhase,
  type FashionProfileUpdate,
  type FashionRoleId,
  type FashionRound,
  type FashionSeatProfile,
  type FashionSecretId,
  type FashionState,
  isFashionEventId,
  isFashionEvidenceId,
  isFashionInvestigationVote,
  isFashionRoleId,
  isFashionRoomFull,
  isFashionSecretId,
} from './state/types';
export { FASHION_STATE_IDENTITY, FASHION_STATE_VERSION } from './state/version';
