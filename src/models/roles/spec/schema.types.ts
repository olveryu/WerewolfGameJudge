/**
 * Action Schema Types
 * 
 * Declarative descriptions of role action inputs.
 * Pure data - no functions, no flow control.
 */

import type { RoleId } from './specs';

/** Constraint types for target selection */
export type TargetConstraint =
  | 'notSelf';           // 不能选自己

export type RevealKind = 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot';

/**
 * UI-only metadata for RoomScreen orchestration.
 *
 * Red lines:
 * - Must NOT contain sensitive info (reveal result, identities, private payload contents).
 * - Host remains the authority; UI metadata is only for prompts/buttons.
 */
export interface SchemaUi {
  /** Top-of-screen prompt / action message (non-sensitive). */
  readonly prompt?: string;
  /** Confirm dialog title (UI-only). If omitted, RoomScreen may fall back to a generic title. */
  readonly confirmTitle?: string;
  /** Confirm dialog text for seat-based actions (non-sensitive). */
  readonly confirmText?: string;
  /** How chooseSeat intent should behave when it represents a reveal flow. */
  readonly revealKind?: RevealKind;
  /** Bottom action button text (skip / empty vote / blocked hint etc). */
  readonly bottomActionText?: string;
  /** Wolf vote "empty knife" button text (wolfVote only). */
  readonly emptyVoteText?: string;
}

/** Base schema interface */
interface BaseActionSchema {
  readonly id: string;
  readonly displayName: string;
  readonly ui?: SchemaUi;
}

/** Choose one seat (target) */
export interface ChooseSeatSchema extends BaseActionSchema {
  readonly kind: 'chooseSeat';
  readonly constraints: readonly TargetConstraint[];
  readonly canSkip: boolean;  // 是否可以不选
}

/** Wolf vote - special handling for wolf pack */
export interface WolfVoteSchema extends BaseActionSchema {
  readonly kind: 'wolfVote';
  readonly constraints: readonly TargetConstraint[];
  /**
   * Role IDs that cannot be targeted by wolf vote.
   * E.g., spiritKnight, wolfQueen - wolves cannot vote to kill these roles.
   * 
   * NOTE: This is target-based constraint, NOT actor-based.
   * Actor-specific rules (e.g., spiritKnight self-vote) are handled separately.
   * 
   * @see docs/architecture/unified-host-reject-and-wolf-rules.zh-CN.md
   */
  readonly forbiddenTargetRoleIds?: readonly RoleId[];
}

/** Compound action (e.g., witch: save OR poison) */
export interface CompoundSchema extends BaseActionSchema {
  readonly kind: 'compound';
  readonly steps: readonly CompoundStep[];
}

export interface CompoundStep {
  /** Migration: prefer schemaId-driven steps; will remove legacy per-step fields later. */
  readonly stepSchemaId: string;

  /** @deprecated TODO(remove by 2026-03-01) */
  readonly stepId?: string;
  /** @deprecated TODO(remove by 2026-03-01) */
  readonly displayName?: string;
  /** @deprecated TODO(remove by 2026-03-01) */
  readonly kind?: 'chooseSeat' | 'skip';
  /** @deprecated TODO(remove by 2026-03-01) */
  readonly constraints?: readonly TargetConstraint[];
  /** @deprecated TODO(remove by 2026-03-01) */
  readonly canSkip?: boolean;
}

/** Swap two players (magician) */
export interface SwapSchema extends BaseActionSchema {
  readonly kind: 'swap';
  readonly constraints: readonly TargetConstraint[];
  readonly canSkip: boolean;
}

/** Skip action (no selection needed) */
export interface SkipSchema extends BaseActionSchema {
  readonly kind: 'skip';
}

/** Confirm action (hunter/darkWolfKing - no target selection, just confirm status) */
export interface ConfirmSchema extends BaseActionSchema {
  readonly kind: 'confirm';
}

/** Union type for all schemas */
export type ActionSchema =
  | ChooseSeatSchema
  | WolfVoteSchema
  | CompoundSchema
  | SwapSchema
  | SkipSchema
  | ConfirmSchema;

/** Schema kind literal type */
export type SchemaKind = ActionSchema['kind'];
