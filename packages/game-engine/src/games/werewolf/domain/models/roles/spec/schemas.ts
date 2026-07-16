/**
 * Schemas Builder — builds the ActionSchema registry from ROLE_SPECS
 *
 * Each schema is derived from the role's nightSteps + abilities.
 * Exports the buildSchemas pure function; no service dependencies, no side effects or IO.
 */

import type { ActiveAbility, NightStepUi, TargetRule } from './ability.types';
import { isNightStepId, NIGHT_STEP_ORDER, type NightStepId } from './nightStepIds';
import type { NightStepDef, RoleSpec } from './roleSpec.types';
import type { ActionSchema, InlineSubStepSchema, RevealKind, SchemaUi } from './schema.types';
import { getAllRoleIds, getRoleSpec, type RoleId } from './specs';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Find the matching active ability for a night step by actionKind.
 * Returns undefined if no matching ability (e.g. groupConfirm reveal steps).
 */
function findMatchingAbility(
  spec: RoleSpec<RoleId>,
  step: NightStepDef,
): ActiveAbility<RoleId> | undefined {
  return spec.abilities.find(
    (ability): ability is ActiveAbility<RoleId> =>
      ability.type === 'active' && ability.actionKind === step.actionKind,
  );
}

function requireMatchingAbility(
  roleId: RoleId,
  step: NightStepDef,
  ability: ActiveAbility<RoleId> | undefined,
): ActiveAbility<RoleId> {
  if (!ability) {
    throw new Error(
      `[schemas] ${roleId}.${step.stepId} has no active ability for ${step.actionKind}`,
    );
  }
  return ability;
}

function requireTargetRule(
  roleId: RoleId,
  step: NightStepDef,
  ability: ActiveAbility<RoleId>,
): TargetRule {
  if (!ability.target) {
    throw new Error(`[schemas] ${roleId}.${step.stepId} requires a target rule`);
  }
  return ability.target;
}

function getRevealKind(roleId: RoleId): RevealKind | undefined {
  switch (roleId) {
    case 'seer':
    case 'mirrorSeer':
    case 'drunkSeer':
    case 'psychic':
    case 'gargoyle':
    case 'pureWhite':
    case 'wolfWitch':
    case 'wolfRobot':
      return roleId;
    default:
      return undefined;
  }
}

/**
 * Build SchemaUi from NightStepUi, adding revealKind when applicable.
 * NightStepUi is structurally assignable to SchemaUi (a superset of shared optional fields).
 */
function buildSchemaUi(
  roleId: RoleId,
  stepUi: NightStepUi,
  ability?: ActiveAbility<RoleId>,
): SchemaUi {
  const base: SchemaUi = { ...stepUi };
  const revealKind = getRevealKind(roleId);

  // Derive revealKind for check/learn effects
  if (revealKind && ability) {
    const hasRevealEffect = ability.effects.some((e) => e.kind === 'check' || e.kind === 'learn');
    if (hasRevealEffect) {
      return { ...base, revealKind };
    }
  }

  return base;
}

/**
 * Build an ActionSchema from a NightStepDef and its matching ability.
 */
function buildSchema(
  roleId: RoleId,
  step: NightStepDef,
  ability: ActiveAbility<RoleId> | undefined,
): ActionSchema {
  const ui = buildSchemaUi(roleId, step.ui, ability);

  switch (step.actionKind) {
    case 'chooseSeat': {
      const activeAbility = requireMatchingAbility(roleId, step, ability);
      const target = requireTargetRule(roleId, step, activeAbility);
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'chooseSeat',
        constraints: target.constraints,
        canSkip: activeAbility.canSkip,
        ui,
      };
    }

    case 'wolfVote': {
      const activeAbility = requireMatchingAbility(roleId, step, ability);
      const target = requireTargetRule(roleId, step, activeAbility);
      if (!step.meeting) {
        throw new Error(`[schemas] ${roleId}.${step.stepId} requires meeting configuration`);
      }
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'wolfVote',
        constraints: target.constraints,
        meeting: step.meeting,
        ui,
      };
    }

    case 'compound': {
      requireMatchingAbility(roleId, step, ability);
      if (!step.compoundSteps) {
        throw new Error(`[schemas] ${roleId}.${step.stepId} requires compound steps`);
      }
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'compound',
        ui,
        steps: step.compoundSteps.map(
          (sub): InlineSubStepSchema => ({
            key: sub.key,
            displayName: sub.displayName,
            kind: sub.kind,
            constraints: [...sub.constraints],
            canSkip: sub.canSkip,
            ui: sub.ui,
          }),
        ),
      };
    }

    case 'swap': {
      const activeAbility = requireMatchingAbility(roleId, step, ability);
      const target = requireTargetRule(roleId, step, activeAbility);
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'swap',
        constraints: target.constraints,
        canSkip: activeAbility.canSkip,
        ui,
      };
    }

    case 'confirm': {
      const activeAbility = requireMatchingAbility(roleId, step, ability);
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'confirm',
        canSkip: activeAbility.canSkip,
        ui,
      };
    }

    case 'multiChooseSeat': {
      const activeAbility = requireMatchingAbility(roleId, step, ability);
      const target = requireTargetRule(roleId, step, activeAbility);
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'multiChooseSeat',
        constraints: target.constraints,
        minTargets: target.count.min,
        maxTargets: target.count.max,
        canSkip: activeAbility.canSkip,
        ui,
      };
    }

    case 'groupConfirm':
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'groupConfirm',
        requireAllAcks: true,
        ui,
      };

    case 'chooseCard': {
      const activeAbility = requireMatchingAbility(roleId, step, ability);
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'chooseCard',
        canSkip: activeAbility.canSkip,
        ui,
      };
    }
  }
}

// =============================================================================
// Builder
// =============================================================================

/**
 * Build the complete SCHEMAS registry from ROLE_SPECS.
 *
 * Iterates all roles with nightSteps, matches each step to its active ability
 * for constraint/canSkip extraction, and produces the ActionSchema shape.
 */
export function buildSchemas(): Record<NightStepId, ActionSchema> {
  const result: Record<string, ActionSchema> = {};

  for (const roleId of getAllRoleIds()) {
    const spec = getRoleSpec(roleId);
    if (!spec.nightSteps) continue;

    for (const step of spec.nightSteps) {
      if (Object.hasOwn(result, step.stepId)) {
        throw new Error(`[schemas] Duplicate night step: ${step.stepId}`);
      }
      const ability = findMatchingAbility(spec, step);
      result[step.stepId] = buildSchema(roleId, step, ability);
    }
  }

  for (const stepId of NIGHT_STEP_ORDER) {
    if (!Object.hasOwn(result, stepId)) {
      throw new Error(`[schemas] Missing schema for night step: ${stepId}`);
    }
  }

  for (const schemaId of Object.keys(result)) {
    if (!isNightStepId(schemaId)) {
      throw new Error(`[schemas] Schema is not in the canonical night order: ${schemaId}`);
    }
  }

  return result;
}

// =============================================================================
// Cached Registry + Helpers
// =============================================================================

/** Build once at module init (deterministic, no side effects) */
const BUILT_SCHEMAS = buildSchemas();

/**
 * Complete action schema registry — derived from ROLE_SPECS.
 * Keyed by NightStepId (e.g. 'seerCheck', 'wolfKill', 'witchAction').
 */
export const SCHEMAS: Readonly<Record<NightStepId, ActionSchema>> = BUILT_SCHEMAS;

/** Schema ID type — alias for NightStepId. */
export type SchemaId = NightStepId;

/** Get schema by ID */
export function getSchema(id: SchemaId): ActionSchema {
  return SCHEMAS[id];
}

export function getSchemaOfKind<K extends ActionSchema['kind']>(
  id: SchemaId,
  kind: K,
): Extract<ActionSchema, { readonly kind: K }> {
  const schema = getSchema(id);
  if (!isSchemaKind(schema, kind)) {
    throw new Error(`[schemas] ${id} has kind ${schema.kind}; expected ${kind}`);
  }
  return schema;
}

function isSchemaKind<K extends ActionSchema['kind']>(
  schema: ActionSchema,
  kind: K,
): schema is Extract<ActionSchema, { readonly kind: K }> {
  return schema.kind === kind;
}

/** Check if a string is a valid SchemaId */
export function isValidSchemaId(id: string): id is SchemaId {
  return isNightStepId(id) && Object.hasOwn(SCHEMAS, id);
}

/** Get all schema IDs */
export function getAllSchemaIds(): SchemaId[] {
  return [...NIGHT_STEP_ORDER];
}
