// Public pure API for the Fashion Shadow game module.

export type { FashionCommand, FashionInternalCommand, FashionPublicCommand } from './commands/types';
export {
  FASHION_ROLE_BY_ID,
  FASHION_ROUND_BY_NUMBER,
  getFashionRoleDefinition,
  type FashionRoleDefinition,
  type FashionRoundDefinition,
} from './domain/content';
export {
  REASON_FASHION_ACTION_TOKEN_REQUIRED,
  REASON_FASHION_ALREADY_VOTED,
  REASON_FASHION_BOTS_NOT_SUPPORTED,
  REASON_FASHION_CROSS_EXAM_NOT_FINISHED,
  REASON_FASHION_DISCUSSION_LIMIT_REACHED,
  REASON_FASHION_PHASE_INVALID,
  REASON_FASHION_ROLE_ALREADY_CONFIRMED,
  REASON_FASHION_ROLE_NOT_ASSIGNED,
  REASON_FASHION_ROLES_NOT_CONFIRMED,
  REASON_FASHION_ROOM_NOT_FULL,
  REASON_FASHION_VOTES_INCOMPLETE,
} from './domain/reasons';
export { assignFashionRoles, type FashionAssignments } from './domain/roles';
export {
  getFashionPublicState,
  getFashionUserSeat,
  type FashionPrivateIdentityView,
  type FashionPublicState,
} from './domain/visibility';
export type { FashionEffect } from './effects/types';
export { decideFashionCommand, fashionEngine, getFashionLifecycle, type FashionEngine } from './engine';
export { parseFashionPublicStats, type FashionPublicStats } from './publicStats';
export { FASHION_STATE_CODEC } from './state/codec';
export {
  FASHION_PUBLIC_STATE_CODEC,
  parseFashionPublicState,
} from './state/publicCodec';
export { parseFashionState } from './state/parseState';
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
  type FashionEvidenceId,
  type FashionEventId,
  type FashionHumanSeat,
  type FashionInterrogation,
  type FashionInvestigationVote,
  type FashionPhase,
  type FashionProfileUpdate,
  type FashionRoleId,
  type FashionRound,
  type FashionSeatProfile,
  type FashionSecretId,
  type FashionState,
  isFashionEvidenceId,
  isFashionEventId,
  isFashionInvestigationVote,
  isFashionRoleId,
  isFashionRoomFull,
  isFashionSecretId,
} from './state/types';
export { FASHION_STATE_IDENTITY, FASHION_STATE_VERSION } from './state/version';
