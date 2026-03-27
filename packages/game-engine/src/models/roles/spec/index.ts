/**
 * Role Spec Module - Public API
 *
 * This module exports the declarative role specification system:
 * - Types: Faction, Team, RoleSpec, ActionSchema, NightPlan, StepSpec
 * - Registries: ROLE_SPECS, SCHEMAS, NIGHT_STEPS
 * - Builders: buildNightPlan, buildSchemas
 * - Utils: isValidRoleId, isValidSchemaId, getSeerCheckResultForTeam
 *
 * IMPORTANT: This module does NOT export resolvers.
 * Resolvers are SERVER-ONLY and located in src/resolvers/.
 */

// Base types (standalone, no cross-module dependencies)
export * from './nightSteps.types';
export * from './plan.types';
export * from './schema.types';
export * from './types';

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
export { buildNightPlan, NIGHT_STEP_ORDER, type NightStepId } from './plan';

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
