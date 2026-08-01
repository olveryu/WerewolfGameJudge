/** Public pure API for the Werewolf game module. */

export type {
  WerewolfActionInput,
  WerewolfCommand,
  WerewolfInternalCommand,
  WerewolfProfileUpdate,
  WerewolfPublicCommand,
  WerewolfSeatProfile,
} from './commands/types';
export { resolveSeerAudioKey } from './domain/audioKeyOverride';
export type { DeathReason } from './domain/DeathCalculator';
export {
  makeActionMagicianSwap,
  makeActionTarget,
  makeActionWitch,
  type RoleAction,
} from './domain/models/actions/RoleAction';
export {
  makeWitchNone,
  makeWitchPoison,
  makeWitchSave,
  type WitchAction,
} from './domain/models/actions/WitchAction';
export { getBottomCardCount } from './domain/models/BottomCards';
export { GameStatus } from './domain/models/GameStatus';
export {
  type ActionSchema,
  buildNightPlan,
  CAMP_ORDER,
  type CampBucket,
  canRoleSeeWolves,
  doesRoleParticipateInWolfVote,
  Faction,
  getAllRoleIds,
  getRoleCamp,
  getRoleDisplayAs,
  getRoleDisplayName,
  getRoleEmoji,
  getRoleSpec,
  getRoleStructuredDescription,
  getSchema,
  getWolfKillImmuneRoleIds,
  isValidRoleId,
  isWolfRole,
  type NightPlan,
  type RevealKind,
  ROLE_SPECS,
  type RoleAbilityTag,
  type RoleId,
  type SchemaId,
  SCHEMAS,
  Team,
} from './domain/models/roles';
export {
  BLOCKED_UI_DEFAULTS,
  type CompoundSchema,
  type InlineSubStepSchema,
  NIGHT_STEPS,
  TargetConstraint,
} from './domain/models/roles/spec';
export { getStepSpec } from './domain/models/roles/spec/nightSteps';
export type { RoleDescription, RoleSpec } from './domain/models/roles/spec/roleSpec.types';
export {
  type ChooseSeatSchema,
  type ConfirmSchema,
  WOLF_KILL_OVERRIDE_TEXTS,
} from './domain/models/roles/spec/schema.types';
export { getAllSchemaIds, isValidSchemaId } from './domain/models/roles/spec/schemas';
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
} from './domain/models/Template';
export {
  buildSeatRoleMap,
  findSeatByRole,
  forEachSeatedPlayer,
  getBottomCardEffectiveRole,
  isBottomCardWolfVoteExcluded,
} from './domain/playerHelpers';
export type {
  AudioEffect,
  BoardNomination,
  ConfirmStatus,
  FactionConfirmStatus,
  GameState,
  Player,
  ProtocolAction,
  ShootConfirmStatus,
} from './domain/protocol/types';
export { RESOLVERS } from './domain/resolvers';
export type { ActionInput, CurrentNightResults, ResolverContext } from './domain/resolvers/types';
export { createWerewolfGameEndedEffect } from './effects/gameEnded';
export type {
  WerewolfEffect,
  WerewolfGameEndedEffect,
  WerewolfGameEndedParticipant,
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
export { WEREWOLF_STATE_CODEC } from './state/codec';
export { parseWerewolfState } from './state/parseState';
export { WEREWOLF_STATE_IDENTITY, WEREWOLF_STATE_VERSION } from './state/version';
