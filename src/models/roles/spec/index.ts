/**
 * Role Spec Module - Public API
 *
 * This module exports the declarative role specification system:
 * - Types: Faction, Team, RoleSpec, ActionSchema, NightPlan
 * - Registries: ROLE_SPECS, SCHEMAS
 * - Builders: buildNightPlan
 * - Utils: isValidRoleId, isValidSchemaId, getSeerCheckResultForTeam
 *
 * IMPORTANT: This module does NOT export resolvers.
 * Resolvers are HOST-ONLY and located in src/services/night/resolvers.
 */

// Base types
export * from './types';

// Schema types and registry
export * from './schema.types';
export * from './schemas';

// Spec types and registry
export * from './spec.types';
export * from './specs';

// Night steps types and registry
export * from './nightSteps.types';
export * from './nightSteps';

// Night plan types and builder
export * from './plan.types';
export * from './plan';
