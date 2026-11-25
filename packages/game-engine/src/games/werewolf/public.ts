/** Public pure API for the Werewolf game module. */

export type { AudioEffect } from '../../platform/audio';
export { getBotSeats, isBotOccupant, isBotSeat } from '../../platform/room/seating';
export type {
  WerewolfCommand,
  WerewolfInternalCommand,
  WerewolfMvpSelection,
  WerewolfProfileUpdate,
  WerewolfPublicCommand,
  WerewolfSeatProfile,
} from './commands/types';
export { getBottomCardCount } from './domain/models/BottomCards';
export { GameStatus } from './domain/models/GameStatus';
export {
  CAMP_ORDER,
  type CampBucket,
  doesRoleParticipateInWolfVote,
  Faction,
  getAllRoleIds,
  getRoleCamp,
  getRoleCard,
  getRoleDisplayAs,
  getRoleDisplayName,
  getRoleStructuredDescription,
  isValidRoleId,
  isWolfRole,
  type RoleAbilityTag,
  type RoleCard,
  type RoleDescription,
  type RoleId,
  Team,
} from './domain/models/roles';
export {
  createCustomTemplate,
  createTemplateFromRoles,
  findClosestPresetName,
  findMatchingPresetName,
  type GameRuleOverrides,
  type GameTemplate,
  getPlayerCount,
  PRESET_TEMPLATES,
  type PresetTemplate,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
  validateTemplateRoles,
  WEREWOLF_RULES_SCHEMA,
  type WerewolfRules,
} from './domain/models/Template';
export {
  readArmedDeadline,
  REASON_DEADLINE_NOT_REACHED,
  REASON_PHASE_NOT_EXPIRABLE,
} from './domain/phaseExpiry';
export { findSeatByRole, getWerewolfUserSeat } from './domain/playerHelpers';
export type {
  BoardNomination,
  GameState,
  Player,
  ResolvedWolfKillVerdict,
  SheriffElectionResult,
  SheriffElectionRoundResult,
  SheriffElectionState,
  SheriffSpeakingDirection,
} from './domain/protocol/types';
export {
  getWerewolfNightReview,
  type NightReviewDeath,
  type NightReviewDeathNote,
  type NightReviewIdentityEntry,
  type NightReviewLine,
  type WerewolfNightReview,
} from './domain/review/nightReview';
export {
  deriveSheriffRoundRecord,
  getSheriffCandidateRecords,
  getSheriffVoteProgress,
  type SheriffCandidateRecords,
  type SheriffRoundRecord,
  type SheriffVoteProgress,
} from './domain/review/sheriffElectionRecord';
export {
  deriveSheriffSection,
  type NightReviewSheriffRound,
  type NightReviewSheriffSection,
} from './domain/review/sheriffSection';
export {
  describeWerewolfStepConfirmation,
  getWerewolfNightProgress,
  type WerewolfNightProgress,
} from './domain/stepProjection';
export {
  getWerewolfViewModel,
  type WerewolfSeatView,
  type WerewolfViewer,
  type WerewolfViewModel,
} from './domain/visibility';
export { createWerewolfGameEndedEffect } from './effects/gameEnded';
export type {
  WerewolfDeadlinePhase,
  WerewolfEffect,
  WerewolfGameEndedEffect,
  WerewolfGameEndedParticipant,
  WerewolfSettleDueEffect,
} from './effects/types';
export {
  decideWerewolfCommand,
  getWerewolfLifecycle,
  type WerewolfConfig,
  type WerewolfEngine,
  werewolfEngine,
} from './engine';
export {
  parseWerewolfPublicStats,
  WEREWOLF_CAMP_ORDER,
  type WerewolfCampStats,
  type WerewolfPublicStats,
} from './publicStats';
export { WEREWOLF_STEP_AUDIO_DECLARATIONS, type WerewolfStepAudioDeclaration } from './roles';
export {
  getWerewolfDaytimeAnnouncements,
  type WerewolfDaytimeAnnouncement,
} from './roles/daytimeAnnouncements';
export type { DeathReason } from './roles/deathEffects';
export { isWerewolfStepId } from './roles/nightPlan';
export { isNightStepId, NIGHT_STEP_ORDER, type NightStepId } from './roles/nightStepOrder';
export type { WerewolfPersonalDaytimeView } from './roles/personalDaytimeViews';
export { WEREWOLF_STATE_CODEC } from './state/codec';
export { parseWerewolfState } from './state/parseState';
