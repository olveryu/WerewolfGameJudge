/**
 * Action Schema Types
 *
 * Declarative descriptions of role action inputs.
 * Pure data - no functions, no flow control.
 */

/**
 * Default UI text for nightmare-blocked actions.
 *
 * All roles share the same blocked UX by default.
 * Individual schemas can override via SchemaUi.blocked* fields.
 */
export const BLOCKED_UI_DEFAULTS = {
  title: '技能被封锁',
  message: '你被梦魇封锁了，本回合无法行动',
  skipButtonText: '跳过（技能被封锁）',
  dismissButtonText: '知道了',
} as const;

/** Constraint types for target selection */
export type TargetConstraint = 'notSelf'; // 不能选自己

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

  // === Nightmare block overrides (optional, defaults from BLOCKED_UI_DEFAULTS) ===
  /** Override blocked dialog title. */
  readonly blockedTitle?: string;
  /** Override blocked dialog message. */
  readonly blockedMessage?: string;
  /** Override blocked skip button text. */
  readonly blockedSkipButtonText?: string;

  // === Template support for dynamic prompts ===
  /**
   * Template string with {seat} placeholder for dynamic prompts.
   * Used when prompt needs runtime context (e.g., witch save showing killed seat).
   * Example: "{seat}号被狼人杀了，是否使用解药？"
   */
  readonly promptTemplate?: string;
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
  readonly canSkip: boolean; // 是否可以不选
}

/** Wolf vote - special handling for wolf pack */
export interface WolfVoteSchema extends BaseActionSchema {
  readonly kind: 'wolfVote';
  readonly constraints: readonly TargetConstraint[];
  /** Meeting configuration for multi-player collaborative voting */
  readonly meeting: MeetingConfig;
  // NOTE: Wolf vote target restrictions (immuneToWolfKill) are defined in
  // ROLE_SPECS.flags.immuneToWolfKill, not here. This keeps wolfKill schema neutral.
}

/**
 * Meeting configuration for multi-player collaborative actions.
 *
 * Defines how a group of players coordinate on a single action (e.g., wolf kill).
 * This is schema-level metadata; actual participant list comes from ROLE_SPECS.wolfMeeting.
 */
export interface MeetingConfig {
  /**
   * Whether participants can see each other's identities during the meeting.
   * - true: participants see each other (e.g., wolf pack sees teammates)
   * - false: participants act blindly (not used in current game rules)
   */
  readonly canSeeEachOther: boolean;

  /**
   * How the final target is determined from individual votes.
   * - 'majority': most voted target wins (ties may result in no action)
   * - 'firstVote': first vote wins (used for wolf kill in this app)
   */
  readonly resolution: 'majority' | 'firstVote';

  /**
   * Whether an empty vote (no target) is allowed.
   * - true: wolves can choose to "空刀"
   * - false: must select a target
   */
  readonly allowEmptyVote: boolean;
}

/**
 * Inline sub-step schema for compound actions.
 *
 * This is a self-contained schema embedded within a compound action.
 * Not a top-level SchemaId - only exists inside CompoundSchema.steps.
 *
 * Supports:
 * - 'chooseSeat': user selects a target seat (e.g., witch poison)
 * - 'confirmTarget': target is pre-determined, user only confirms (e.g., witch save)
 */
export interface InlineSubStepSchema {
  /** Internal key (not a SchemaId) */
  readonly key: string;
  readonly displayName: string;
  readonly kind: 'chooseSeat' | 'confirmTarget';
  readonly constraints: readonly TargetConstraint[];
  readonly canSkip: boolean;
  readonly ui?: SchemaUi;
}

/** Compound action (e.g., witch: save OR poison) */
export interface CompoundSchema extends BaseActionSchema {
  readonly kind: 'compound';
  /** Inline sub-steps (each is a self-contained action definition) */
  readonly steps: readonly InlineSubStepSchema[];
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

/**
 * Confirm with fixed target (witch save - target is pre-determined by context)
 *
 * Unlike chooseSeat, the target is not selected by user but provided by context
 * (e.g., WITCH_CONTEXT.killedIndex). User only confirms whether to act on that target.
 */
export interface ConfirmTargetSchema extends BaseActionSchema {
  readonly kind: 'confirmTarget';
  readonly canSkip: boolean;
}

/** Union type for all schemas */
export type ActionSchema =
  | ChooseSeatSchema
  | WolfVoteSchema
  | CompoundSchema
  | SwapSchema
  | SkipSchema
  | ConfirmSchema
  | ConfirmTargetSchema;

/** Schema kind literal type */
export type SchemaKind = ActionSchema['kind'];
