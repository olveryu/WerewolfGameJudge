/**
 * Role Spec Module - Public API
 *
 * This module exports the declarative role specification system:
 * - Types: Faction, Team, RoleSpec, ActionSchema, NightPlan
 * - Registries: ROLE_SPECS, SCHEMAS
 * - Builders: buildNightPlan, buildSchemas
 * - Utils: isValidRoleId, isValidSchemaId, getSeerCheckResultForTeam
 *
 * IMPORTANT: This module does NOT export resolvers.
 * Resolvers are SERVER-ONLY and located in src/resolvers/.
 */

// Base types
export * from './types';

// Schema types and registry
export * from './schema.types';
export * from './schemas';

// Spec registry
export * from './specs';

// Night steps types and registry
export * from './nightSteps';
export * from './nightSteps.types';

// Night plan types and builder
export * from './plan';
export * from './plan.types';

// V2 core re-exports (NIGHT_STEP_ORDER, NightStepId, buildSchemas, ability types)
export { buildSchemas, NIGHT_STEP_ORDER, type NightStepId } from './v2';
