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

// Base types (standalone, no dependencies on v2/)
export * from './nightSteps.types';
export * from './plan.types';
export * from './schema.types';
export * from './types';

// Core (single source of truth for specs, schemas, nightSteps, nightPlan)
export * from './v2';
