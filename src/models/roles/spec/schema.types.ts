/**
 * Action Schema Types
 * 
 * Declarative descriptions of role action inputs.
 * Pure data - no functions, no flow control.
 */

/** Constraint types for target selection */
export type TargetConstraint =
  | 'notSelf';           // 不能选自己

/** Base schema interface */
interface BaseActionSchema {
  readonly id: string;
  readonly displayName: string;
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
}

/** Compound action (e.g., witch: save OR poison) */
export interface CompoundSchema extends BaseActionSchema {
  readonly kind: 'compound';
  readonly steps: readonly CompoundStep[];
}

export interface CompoundStep {
  readonly stepId: string;
  readonly displayName: string;
  readonly kind: 'chooseSeat' | 'skip';
  readonly constraints: readonly TargetConstraint[];
  readonly canSkip: boolean;
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
