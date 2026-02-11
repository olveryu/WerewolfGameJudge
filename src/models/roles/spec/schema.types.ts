/**
 * Action Schema Types - 行动输入协议类型定义
 *
 * Declarative descriptions of role action inputs.
 * Pure data - no functions, no flow control.
 *
 * ✅ 允许：ActionSchema / CompoundSchema / SchemaUi 等类型定义、BLOCKED_UI_DEFAULTS 常量
 * ❌ 禁止：import service / 副作用 / 流程控制
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

  // === Witch cannot-save prompt (schema-first) ===
  /**
   * Prompt shown when witch is killed by wolves and cannot self-save.
   * Only used in witchAction save step (canSave=false, killedSeat >= 0).
   */
  readonly cannotSavePrompt?: string;

  // === WolfRobot Hunter Gate UI (wolfRobotLearn only) ===
  /**
   * Prompt text shown when hunter gate is active (after learning hunter).
   * Overrides the default schema.ui.prompt when wolfRobotReveal exists.
   */
  readonly hunterGatePrompt?: string;
  /**
   * Button text for the hunter status gate (wolfRobotLearn step).
   * This gate appears after wolfRobot learns hunter, before night advances.
   */
  readonly hunterGateButtonText?: string;
  /** Dialog title for hunter status gate. */
  readonly hunterGateDialogTitle?: string;
  /** Dialog message when wolfRobot can shoot as hunter. */
  readonly hunterGateCanShootText?: string;
  /** Dialog message when wolfRobot cannot shoot as hunter (poisoned). */
  readonly hunterGateCannotShootText?: string;

  // === Confirm Schema Status Dialog UI (hunterConfirm/darkWolfKingConfirm) ===
  /** Dialog title when showing trigger status. */
  readonly statusDialogTitle?: string;
  /** Dialog message when role can shoot/trigger. */
  readonly canShootText?: string;
  /** Dialog message when role cannot shoot/trigger. */
  readonly cannotShootText?: string;

  // === Wolf vote dialog templates (schema-driven) ===
  /** Wolf vote confirm dialog template. Placeholders: {wolf}, {seat}. */
  readonly voteConfirmTemplate?: string;
  /** Wolf vote empty knife confirm template. Placeholder: {wolf}. */
  readonly emptyVoteConfirmTemplate?: string;

  // === Magician first target dialog (schema-driven) ===
  /** Title for first-target selection alert. */
  readonly firstTargetTitle?: string;
  /** Body template for first-target alert. Placeholder: {seat}. */
  readonly firstTargetPromptTemplate?: string;

  // === Witch empty kill title (schema-driven) ===
  /** Title shown when no player was killed by wolves (killedSeat < 0). */
  readonly emptyKillTitle?: string;
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
  readonly canSkip: boolean;
}

/**
 * Confirm with fixed target (witch save - target is pre-determined by context)
 *
 * Unlike chooseSeat, the target is not selected by user but provided by context
 * (e.g., WITCH_CONTEXT.killedSeat). User only confirms whether to act on that target.
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

