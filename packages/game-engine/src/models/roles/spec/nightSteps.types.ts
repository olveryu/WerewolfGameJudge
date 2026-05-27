/**
 * Night Steps Types - type definitions for the night steps table
 *
 * Defines the StepSpec interface, describing the structure of a single night step.
 * Contains only the StepSpec type definition; no service dependencies, no side effects.
 */

import type { SchemaId } from './schemas';
import type { RoleId } from './specs';

/**
 * Night step specification
 *
 * ⚠️ step.id equals schemaId (one-to-one mapping, no need for duplicate fields)
 */
export interface StepSpec {
  /** Step ID (also used as schemaId) */
  readonly id: SchemaId;
  /** Role that performs this step */
  readonly roleId: RoleId;
  /** Start audio filename (without path or extension) */
  readonly audioKey: string;
  /** End audio filename (optional; defaults to audioKey) */
  readonly audioEndKey?: string;
}
