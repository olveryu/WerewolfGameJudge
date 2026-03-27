/**
 * Action Schemas Registry — re-export layer (to be removed in P9-C)
 */

import type { ActionSchema } from './schema.types';
import type { NightStepId } from './v2/nightPlan';
import { buildSchemas } from './v2/schemas';

// Build once at module init (deterministic, no side effects)
const _SCHEMAS: Record<string, ActionSchema> = buildSchemas();

/**
 * Complete action schema registry — derived from ROLE_SPECS.
 *
 * Keyed by NightStepId (e.g. 'seerCheck', 'wolfKill', 'witchAction').
 */
export const SCHEMAS = _SCHEMAS as Record<NightStepId, ActionSchema>;

/** Schema ID type — derived from V2 NightStepId. */
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

// Re-export types
export * from './schema.types';
