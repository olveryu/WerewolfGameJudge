/**
 * Role Spec Module — Core Public API
 *
 * Re-exports all types, registries, and helpers.
 */

// Ability system types
export type {
  Ability,
  AbilityEffect,
  AbilityTiming,
  ActionKind,
  ActiveAbility,
  BlockEffect,
  CharmEffect,
  CheckEffect,
  ChooseIdolEffect,
  CompoundSubStepDef,
  ConfirmEffect,
  ConvertEffect,
  GroupRevealEffect,
  HypnotizeEffect,
  Immunity,
  ImmunityKind,
  LearnEffect,
  MeetingConfig,
  MimicEffect,
  NightStepUi,
  PassiveAbility,
  PassiveEffectKind,
  RecognitionConfig,
  Resource,
  ResourceKind,
  SwapEffect,
  TargetCount,
  TargetRule,
  TriggerCondition,
  TriggeredAbility,
  TriggeredEffectKind,
  WriteSlotEffect,
} from './ability.types';
export { TargetConstraint } from './ability.types';

// Role spec types
export type { DeathCalcRole, NightStepDef, RoleDescription, RoleSpec } from './roleSpec.types';

// Specs registry + helpers
export {
  getAllRoleIds,
  getRoleDisplayAs,
  getRoleEmoji,
  getRoleSpec,
  getRoleStructuredDescription,
  isValidRoleId,
  ROLE_SPECS,
  type RoleId,
} from './specs';

// Night plan builder
export { buildNightPlan, NIGHT_STEP_ORDER, type NightStepId } from './nightPlan';

// Schemas builder + registry + helpers
export {
  buildSchemas,
  getAllSchemaIds,
  getSchema,
  isValidSchemaId,
  type SchemaId,
  SCHEMAS,
} from './schemas';

// Night steps registry + helpers
export {
  getAllStepIds,
  getStepsByRole,
  getStepsByRoleStrict,
  getStepSpec,
  getStepSpecStrict,
  NIGHT_STEPS,
} from './nightSteps';
