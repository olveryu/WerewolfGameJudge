/**
 * V2 Ability System — ability / effect / immunity / recognition / resource type definitions
 *
 * Atomic building blocks for role behavior. Each AbilityEffect maps to one effect processor in genericResolver.
 * Types are designed to be pure JSON-serializable (no functions, no classes), storable in DB and transportable across Edge Functions.
 * Contains no business logic, side effects, or platform dependencies.
 *
 * Reuses V1's Faction / Team / TargetConstraint enums; no duplicate definitions.
 */

import type { ConfirmStatusUi } from './schema.types';
import { TargetConstraint } from './schema.types';

// Re-export TargetConstraint so V2 consumers can import from v2/
export { TargetConstraint };

// ---------------------------------------------------------------------------
// Target Rules
// ---------------------------------------------------------------------------

/** How many targets the ability requires */
export interface TargetCount {
  readonly min: number;
  readonly max: number;
}

export interface TargetRule {
  readonly count: TargetCount;
  readonly constraints: readonly TargetConstraint[];
}

// ---------------------------------------------------------------------------
// Effects (what an ability produces)
// ---------------------------------------------------------------------------

/**
 * Check effect — inspection: returns faction or role name
 *
 * `resultType`:
 * - 'faction': returns '好人'/'狼人' (seer family)
 * - 'identity': returns concrete role name (psychic, gargoyle, pureWhite, wolfWitch, wolfRobot)
 */
export interface CheckEffect {
  readonly kind: 'check';
  readonly resultType: 'faction' | 'identity';
  /**
   * Result transformer — transforms inspection result
   * - 'identity': returns as-is (seer, psychic, gargoyle...)
   * - 'invert': inverts good/wolf (mirrorSeer)
   * - 'random': 50% chance to invert (drunkSeer)
   */
  readonly transformer?: 'identity' | 'invert' | 'random';
}

/**
 * WriteSlot effect — write to a night-result slot
 *
 * Writes action result into a specific field of CurrentNightResults.
 * E.g. guard -> guardedSeat, dreamcatcher -> dreamingSeat
 */
export interface WriteSlotEffect {
  readonly kind: 'writeSlot';
  /** The field name in CurrentNightResults to write to */
  readonly slot: string;
}

/**
 * Block effect — blocks target's ability
 * Core effect of nightmare
 */
export interface BlockEffect {
  readonly kind: 'block';
  /** When blocking a wolf-team target, also disable wolf kill */
  readonly disablesWolfKillOnWolfTarget?: boolean;
}

/** Charm effect — charm target (wolfQueen) */
export interface CharmEffect {
  readonly kind: 'charm';
}

/** Swap effect — swap two targets' number tags (magician) */
export interface SwapEffect {
  readonly kind: 'swap';
}

/**
 * Learn effect — learn target's identity and ability (wolfRobot)
 */
export interface LearnEffect {
  readonly kind: 'learn';
  /** Role IDs that trigger a gate when learned */
  readonly gateTriggersOnRoles?: readonly string[];
}

/** ChooseIdol effect — choose an idol (slacker / wildChild) */
export interface ChooseIdolEffect {
  readonly kind: 'chooseIdol';
}

/**
 * Mimic effect — mimic target (shadow)
 */
export interface MimicEffect {
  readonly kind: 'mimic';
  /** When mimicking this roleId, triggers faction binding (shadow -> avenger) */
  readonly pairedRole?: string;
}

/** Hypnotize effect — hypnotize multiple targets (piper) */
export interface HypnotizeEffect {
  readonly kind: 'hypnotize';
}

/** Convert effect — convert target's faction (awakenedGargoyle) */
export interface ConvertEffect {
  readonly kind: 'convert';
}

/** GroupReveal effect — group-wide confirmation reveal (piperHypnotizedReveal / awakenedGargoyleConvertReveal) */
export interface GroupRevealEffect {
  readonly kind: 'groupReveal';
}

/** ChooseCard effect — choose an identity card from the deck (treasureMaster / thief) */
export interface ChooseCardEffect {
  readonly kind: 'chooseCard';
}

/** ChooseLovers effect — choose two players to become lovers (cupid) */
export interface ChooseLoversEffect {
  readonly kind: 'chooseLovers';
}

/**
 * Confirm effect — confirmation (view status)
 * hunter / darkWolfKing / avenger / hiddenWolf confirm
 */
export interface ConfirmEffect {
  readonly kind: 'confirm';
  readonly confirmType: 'shoot' | 'faction' | 'wolfTeammates';
}

/** All possible effects (discriminated by `kind`) */
export type AbilityEffect =
  | CheckEffect
  | WriteSlotEffect
  | BlockEffect
  | CharmEffect
  | SwapEffect
  | LearnEffect
  | ChooseIdolEffect
  | MimicEffect
  | HypnotizeEffect
  | ConvertEffect
  | GroupRevealEffect
  | ConfirmEffect
  | ChooseCardEffect
  | ChooseLoversEffect;

// ---------------------------------------------------------------------------
// Abilities (what a role can do)
// ---------------------------------------------------------------------------

/** When the ability activates */
export type AbilityTiming = 'night' | 'day' | 'onDeath' | 'onExile' | 'passive';

/** The action kind for UI / input handling */
export type ActionKind =
  | 'chooseSeat'
  | 'multiChooseSeat'
  | 'wolfVote'
  | 'compound'
  | 'swap'
  | 'confirm'
  | 'groupConfirm'
  | 'chooseCard';

/**
 * Active ability — requires player input
 *
 * Choose targets at night/day, produces effects
 */
export interface ActiveAbility {
  readonly type: 'active';
  readonly timing: AbilityTiming;
  /** Action kind for UI dispatch */
  readonly actionKind: ActionKind;
  /** Target selection rules (undefined = no target needed, e.g. confirm) */
  readonly target?: TargetRule;
  /** Can the player skip this ability? */
  readonly canSkip: boolean;
  /** Effects produced when ability is used */
  readonly effects: readonly AbilityEffect[];
  /** Night-1 specific: is this ability active during night 1? */
  readonly activeOnNight1: boolean;
  /**
   * Reference to custom resolver (only for abilities that cannot be
   * expressed purely declaratively). Engine falls back to generic
   * processor when undefined.
   */
  readonly customResolver?: string;
}

/**
 * Passive ability — always active, no input required
 *
 * Modifies inspection results / damage calculation / death determination, etc.
 */
export interface PassiveAbility {
  readonly type: 'passive';
  readonly effect: PassiveEffectKind;
}

export type PassiveEffectKind =
  | 'immuneToWolfKill'
  | 'immuneToPoison'
  | 'immuneToNightDamage'
  | 'reflectsDamage'
  | 'disguiseAsSeer'
  | 'silentWolfKillImmune';

/**
 * Triggered ability — event-driven
 *
 * onDeath / onExile / onChecked, etc.
 */
export interface TriggeredAbility {
  readonly type: 'triggered';
  readonly trigger: TriggerCondition;
  readonly effect: TriggeredEffectKind;
}

export type TriggerCondition =
  | 'onDeath'
  | 'onExile'
  | 'onDayExile'
  | 'onCheckedByNonWolf'
  | 'onPoisoned'
  | 'onSelfDeath'
  | 'afterFirstExileVote';

export type TriggeredEffectKind =
  | 'shoot'
  | 'linkDeath'
  | 'linkDreamDeath'
  | 'flipCard'
  | 'selfDestruct'
  | 'reflectDamage'
  | 'stab'
  | 'reverseVote';

export type Ability = ActiveAbility | PassiveAbility | TriggeredAbility;

// ---------------------------------------------------------------------------
// Immunities
// ---------------------------------------------------------------------------

export type ImmunityKind = 'wolfAttack' | 'poison' | 'nightDamage' | 'seerCheck';

export interface Immunity {
  readonly kind: ImmunityKind;
  /** Conditional immunity (e.g., dancer immune only when in dance pool) */
  readonly condition?: string;
}

// ---------------------------------------------------------------------------
// Recognition (mutual recognition)
// ---------------------------------------------------------------------------

export interface RecognitionConfig {
  /** Can this role see other wolves during wolf meeting? */
  readonly canSeeWolves: boolean;
  /** Does this role participate in the wolf kill vote? */
  readonly participatesInWolfVote: boolean;
  /** Acts solo during nightmare phase (cannot see wolf teammates) */
  readonly actsSolo?: boolean;
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export type ResourceKind = 'antidote' | 'poison' | 'bullet' | 'mask' | 'flipChance';

export interface Resource {
  readonly kind: ResourceKind;
  /** Total uses (-1 = unlimited) */
  readonly uses: number;
  /** Refreshes each night? */
  readonly refreshPerNight: boolean;
}

// ---------------------------------------------------------------------------
// Night Step UI
// ---------------------------------------------------------------------------

/**
 * UI metadata for a night step's action.
 *
 * Mirrors V1 SchemaUi fields relevant to night actions.
 * Separated from behavior to keep spec JSON-serializable.
 */
export interface NightStepUi {
  readonly prompt?: string;
  readonly confirmTitle?: string;
  readonly confirmText?: string;
  readonly bottomActionText?: string;
  readonly revealTitlePrefix?: string;
  readonly revealResultFormat?: 'factionCheck' | 'roleName';
  readonly emptyVoteText?: string;
  readonly voteConfirmTemplate?: string;
  readonly emptyVoteConfirmTemplate?: string;
  readonly firstTargetTitle?: string;
  readonly firstTargetPromptTemplate?: string;
  readonly emptyKillTitle?: string;
  readonly confirmStatusUi?: ConfirmStatusUi;
  readonly hypnotizedText?: string;
  readonly notHypnotizedText?: string;
  readonly confirmButtonText?: string;
  readonly hunterGatePrompt?: string;
  readonly hunterGateButtonText?: string;
  readonly hunterGateDialogTitle?: string;
  readonly hunterGateCanShootText?: string;
  readonly hunterGateCannotShootText?: string;
  readonly cannotSavePrompt?: string;
  readonly promptTemplate?: string;
  readonly blockedTitle?: string;
  readonly blockedMessage?: string;
  readonly blockedSkipButtonText?: string;
  /** Cupid lovers reveal: text shown to a lover (use {seat} placeholder for partner seat) */
  readonly loverText?: string;
  /** Cupid lovers reveal: text shown to a non-lover */
  readonly notLoverText?: string;
}

// ---------------------------------------------------------------------------
// Meeting Config
// ---------------------------------------------------------------------------

export interface MeetingConfig {
  readonly canSeeEachOther: boolean;
  readonly resolution: 'majority' | 'firstVote';
  readonly allowEmptyVote: boolean;
}

// ---------------------------------------------------------------------------
// Compound Sub-Step (for witch-style compound actions)
// ---------------------------------------------------------------------------

/**
 * Sub-step definition within a compound night action (e.g. witch save/poison).
 *
 * Mirrors V1's InlineSubStepSchema. Only used by compound actionKind steps.
 */
export interface CompoundSubStepDef {
  readonly key: string;
  readonly displayName: string;
  readonly kind: 'chooseSeat' | 'confirmTarget';
  readonly constraints: readonly TargetConstraint[];
  readonly canSkip: boolean;
  readonly ui?: NightStepUi;
}
