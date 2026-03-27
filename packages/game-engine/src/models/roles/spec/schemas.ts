/**
 * Schemas Builder — 从 ROLE_SPECS 构建 ActionSchema 注册表
 *
 * 每个 schema 从角色的 nightSteps + abilities 推导。
 * 导出 buildSchemas 纯函数，不依赖 service、不含副作用或 IO。
 */

import type { ActiveAbility, NightStepUi } from './ability.types';
import type { NightStepDef, RoleSpec } from './roleSpec.types';
import type { ActionSchema, InlineSubStepSchema, RevealKind, SchemaUi } from './schema.types';
import { ROLE_SPECS } from './specs';

// =============================================================================
// Helpers
// =============================================================================

type SpecRoleId = keyof typeof ROLE_SPECS;

/** Roles whose check/learn effects produce a revealKind in the schema UI. */
const REVEAL_ROLE_IDS = new Set<string>([
  'seer',
  'mirrorSeer',
  'drunkSeer',
  'psychic',
  'gargoyle',
  'pureWhite',
  'wolfWitch',
  'wolfRobot',
]);

/**
 * Find the matching active ability for a night step by actionKind.
 * Returns undefined if no matching ability (e.g. groupConfirm reveal steps).
 */
function findMatchingAbility(spec: RoleSpec, step: NightStepDef): ActiveAbility | undefined {
  return spec.abilities.find(
    (a): a is ActiveAbility => a.type === 'active' && a.actionKind === step.actionKind,
  );
}

/**
 * Build SchemaUi from NightStepUi, adding revealKind when applicable.
 * NightStepUi is structurally assignable to SchemaUi (a superset of shared optional fields).
 */
function buildSchemaUi(roleId: string, stepUi: NightStepUi, ability?: ActiveAbility): SchemaUi {
  const base = stepUi as SchemaUi;

  // Derive revealKind for check/learn effects
  if (REVEAL_ROLE_IDS.has(roleId) && ability) {
    const hasRevealEffect = ability.effects.some((e) => e.kind === 'check' || e.kind === 'learn');
    if (hasRevealEffect) {
      return { ...base, revealKind: roleId as RevealKind };
    }
  }

  return base;
}

/**
 * Build an ActionSchema from a NightStepDef and its matching ability.
 */
function buildSchema(
  roleId: string,
  step: NightStepDef,
  ability: ActiveAbility | undefined,
): ActionSchema {
  const ui = buildSchemaUi(roleId, step.ui, ability);

  switch (step.actionKind) {
    case 'chooseSeat':
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'chooseSeat',
        constraints: ability?.target?.constraints ?? [],
        canSkip: ability?.canSkip ?? true,
        ui,
      };

    case 'wolfVote':
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'wolfVote',
        constraints: ability?.target?.constraints ?? [],
        meeting: step.meeting!,
        ui,
      };

    case 'compound':
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'compound',
        ui,
        steps: (step.compoundSteps ?? []).map(
          (sub): InlineSubStepSchema => ({
            key: sub.key,
            displayName: sub.displayName,
            kind: sub.kind,
            constraints: [...sub.constraints],
            canSkip: sub.canSkip,
            ui: sub.ui as SchemaUi | undefined,
          }),
        ),
      };

    case 'swap':
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'swap',
        constraints: ability?.target?.constraints ?? [],
        canSkip: ability?.canSkip ?? true,
        ui,
      };

    case 'confirm':
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'confirm',
        canSkip: ability?.canSkip ?? true,
        ui,
      };

    case 'multiChooseSeat':
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'multiChooseSeat',
        constraints: ability?.target?.constraints ?? [],
        minTargets: ability?.target?.count.min ?? 1,
        maxTargets: ability?.target?.count.max ?? 2,
        canSkip: ability?.canSkip ?? true,
        ui,
      };

    case 'groupConfirm':
      return {
        id: step.stepId,
        displayName: step.displayName,
        kind: 'groupConfirm',
        requireAllAcks: true,
        ui,
      };
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
export function buildSchemas(): Record<string, ActionSchema> {
  const result: Record<string, ActionSchema> = {};

  for (const roleId of Object.keys(ROLE_SPECS) as SpecRoleId[]) {
    const spec: RoleSpec = ROLE_SPECS[roleId];
    if (!spec.nightSteps) continue;

    for (const step of spec.nightSteps) {
      const ability = findMatchingAbility(spec, step);
      result[step.stepId] = buildSchema(roleId, step, ability);
    }
  }

  return result;
}

// =============================================================================
// Cached Registry + Helpers
// =============================================================================

import type { NightStepId } from './plan';

/** Build once at module init (deterministic, no side effects) */
const _SCHEMAS: Record<string, ActionSchema> = buildSchemas();

/**
 * Complete action schema registry — derived from ROLE_SPECS.
 * Keyed by NightStepId (e.g. 'seerCheck', 'wolfKill', 'witchAction').
 */
export const SCHEMAS = _SCHEMAS as Record<NightStepId, ActionSchema>;

/** Schema ID type — alias for NightStepId. */
export type SchemaId = NightStepId;

/** Get schema by ID */
export function getSchema(id: SchemaId): ActionSchema {
  return SCHEMAS[id];
}

/** Check if a string is a valid SchemaId */
export function isValidSchemaId(id: string): id is SchemaId {
  return id in SCHEMAS;
}

/** Get all schema IDs */
export function getAllSchemaIds(): SchemaId[] {
  return Object.keys(SCHEMAS) as SchemaId[];
}
