/**
 * V2 Role Spec Module — Public API
 *
 * Re-exports all types and the ROLE_SPECS registry.
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

// Specs registry
export type { RoleId } from './specs';
export { ROLE_SPECS } from './specs';

// Night plan builder
export { buildNightPlan, NIGHT_STEP_ORDER, type NightStepId } from './nightPlan';

// Schemas builder
export { buildSchemas } from './schemas';
