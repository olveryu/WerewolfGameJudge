/**
 * V2 Role Spec Module — Public API
 *
 * Re-exports all V2 types and the ROLE_SPECS_V2 registry.
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
export type { DeathCalcRole, NightStepDef, RoleDescription, RoleSpecV2 } from './roleSpec.types';

// Specs registry
export type { RoleIdV2 } from './specs';
export { ROLE_SPECS_V2 } from './specs';
