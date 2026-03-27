/**
 * Action Schemas Registry — 行动输入协议表（V2 派生）
 *
 * 从 ROLE_SPECS_V2 的 nightSteps + abilities 动态构建。
 * 导出 SCHEMAS / SchemaId / getSchema / isValidSchemaId / getAllSchemaIds。
 * 不依赖 service、不含副作用或 resolver 逻辑。
 */

import type { ActionSchema } from './schema.types';
import type { NightStepId } from './v2/nightPlan';
import { buildSchemasFromV2 } from './v2/schemas';

// Build once at module init (deterministic, no side effects)
const _SCHEMAS: Record<string, ActionSchema> = buildSchemasFromV2();

/**
 * Complete action schema registry — derived from ROLE_SPECS_V2.
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
