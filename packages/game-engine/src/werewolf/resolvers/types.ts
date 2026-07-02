/**
 * Resolver Types (SERVER-ONLY)
 *
 * Responsibility: defines the core types of the Resolver system (ResolverFn / ResolverContext / ResolverResult / CurrentNightResults)
 * plus pure-function utilities like resolveRoleForChecks. Exports type definitions and pure-function utilities.
 * Not imported by UI code (enforced by the import boundary test); carries no cross-night fields (previousActions / lastNightTarget, etc.).
 *
 * ⚠️ WARNING: These types and the resolver implementations MUST NOT be imported by UI code.
 * Use the import boundary test in __tests__/import-boundary.test.ts to enforce this.
 */

import type { RoleId, SchemaId } from '../models';
import type { WolfKillOverride } from '../models/roles/spec/schema.types';
import type { Team } from '../models/roles/spec/types';

/**
 * Current night's accumulated results.
 * Used to pass resolved results between steps (e.g., nightmare block -> wolf kill).
 */
export interface CurrentNightResults {
  /**
   * Wolf votes during the wolf meeting (seat -> target seat).
   *
   * This is the single source of truth for wolf vote tracking.
   * WerewolfState MUST include currentNightResults, so this data is public
   * and UI should filter by role.
   */
  readonly wolfVotesBySeat?: Readonly<Record<string, number>>;

  /** Seat blocked by nightmare (skill is disabled) */
  readonly blockedSeat?: number;

  /**
   * Self-contained wolf kill override (nightmare / poisoner).
   * Presence means wolf kill is disabled; ui field provides all display text.
   */
  readonly wolfKillOverride?: WolfKillOverride;

  /** Seat protected by guard */
  readonly guardedSeat?: number;

  /** Seat saved by witch */
  readonly savedSeat?: number;

  /** Seat poisoned by witch */
  readonly poisonedSeat?: number;

  /** Seat dreaming (protected by dreamcatcher) */
  readonly dreamingSeat?: number;

  /** Seat charmed by wolfQueen (link death if wolfQueen dies at night) */
  readonly charmedSeat?: number;

  /** Seats swapped by magician */
  readonly swappedSeats?: readonly [number, number];

  /** Seat silenced by silenceElder (cannot speak during day) */
  readonly silencedSeat?: number;

  /** Seat vote-banned by votebanElder (cannot vote during exile) */
  readonly votebannedSeat?: number;

  /** Seat cursed by crow (extra vote during exile) */
  readonly cursedSeat?: number;

  /** Seat sheltered by eclipseWolfQueen (good team skills targeting this seat redirect to caster) */
  readonly shelteredSeat?: number;

  /** Seats newly hypnotized by piper this night (1-2 seats) */
  readonly hypnotizedSeats?: readonly number[];

  /** Seat converted by awakenedGargoyle */
  readonly convertedSeat?: number;

  /** Seat chosen by shadow as mimicry target */
  readonly shadowMimicTarget?: number;

  /** Avenger's faction (computed by shadow resolver from mimicry target's team) */
  readonly avengerFaction?: Team;

  /** TreasureMaster: chosen card role ID */
  readonly treasureMasterChosenCard?: RoleId;

  /** TreasureMaster: effective team (derived from bottom card composition) */
  readonly effectiveTeam?: Team;

  /** TreasureMaster: bottom card roles revealed during step (for UI display) */
  readonly bottomCardStepRoles?: readonly RoleId[];

  /** Thief: chosen card role ID */
  readonly thiefChosenCard?: RoleId;

  /** Cupid: lover seat pair (sorted ascending) */
  readonly loverSeats?: readonly [number, number];
}

/** Context passed to resolvers */
export interface ResolverContext {
  /** Current player's seat (0-based) */
  readonly actorSeat: number;

  /** Player's role ID */
  readonly actorRoleId: RoleId;

  /** All players (seat -> roleId) */
  readonly players: ReadonlyMap<number, RoleId>;

  /** Current night's resolved results so far */
  readonly currentNightResults: CurrentNightResults;

  /** WolfRobot disguise context (if wolfRobot has learned) */
  readonly wolfRobotContext?: WolfRobotContext;

  /** Witch sub-context (only present when game includes witch role) */
  readonly witchState?: {
    readonly canSave: boolean;
    readonly canPoison: boolean;
  };

  /** Game state flags shared across all resolvers */
  readonly gameState: {
    readonly isNight1: boolean;
    /** Accumulated hypnotized seats (piper) — needed to reject already-hypnotized targets */
    readonly hypnotizedSeats?: readonly number[];
    /** Whether witch is allowed to save herself (house rule override) */
    readonly witchCanSelfHeal?: boolean;
  };

  /** Bottom-card context (only present when game includes treasureMaster or thief role) */
  readonly bottomCardContext?: BottomCardContext;
}

/** Action input from player */
export interface ActionInput {
  readonly schemaId: SchemaId;
  readonly target?: number; // For chooseSeat, wolfVote
  readonly targets?: readonly number[]; // For swap
  readonly stepResults?: Record<string, number | null>; // For compound
  readonly confirmed?: boolean; // For confirm
  readonly cardIndex?: number; // For chooseCard (treasureMaster bottom card index)
  /** Set by shelter redirect — target was rewritten from shelteredSeat to actorSeat */
  readonly shelterRedirected?: boolean;
}

/** Resolver result - role action outcome */
export interface ResolverResult {
  readonly valid: boolean;
  readonly rejectReason?: string;

  /**
   * Updates to CurrentNightResults after this action.
   * Server will merge these updates into the accumulated results.
   */
  readonly updates?: Partial<CurrentNightResults>;

  /** Computed results (role-specific, for feedback to server/UI) */
  readonly result?: {
    readonly checkResult?: '好人' | '狼人'; // seer
    readonly identityResult?: RoleId; // psychic, gargoyle, wolfRobot (display only)
    readonly savedTarget?: number; // witch save
    readonly poisonedTarget?: number; // witch poison
    readonly guardedTarget?: number; // guard
    readonly blockedTarget?: number; // nightmare
    readonly dreamTarget?: number; // dreamcatcher
    readonly charmTarget?: number; // wolfQueen
    readonly swapTargets?: readonly [number, number]; // magician
    readonly learnTarget?: number; // wolfRobot - target seat
    readonly learnedRoleId?: RoleId; // wolfRobot - learned role (see WolfRobotLearnSuccessResult for strong typing)
    readonly canShootAsHunter?: boolean; // wolfRobot - can shoot as hunter (only set when learned hunter)
    readonly idolTarget?: number; // slacker
    readonly silenceTarget?: number; // silenceElder
    readonly votebanTarget?: number; // votebanElder
    readonly hypnotizedTargets?: readonly number[]; // piper - newly hypnotized seats this night
    readonly convertTarget?: number; // awakenedGargoyle - converted seat
    readonly curseTarget?: number; // crow - cursed seat
    readonly shelterTarget?: number; // eclipseWolfQueen - sheltered seat
  };
}

// =============================================================================
// WolfRobot Resolver dedicated types (compile-time strong type guarantee)
// =============================================================================

/**
 * Dedicated return type for the WolfRobot Resolver.
 *
 * Test harnesses inspect the optional fields directly, so this type extends ResolverResult
 * with optional wolfRobot-specific fields.
 *
 * Real compile-time type safety is guaranteed by overloads inside the resolver.
 */
export interface WolfRobotResolverResult extends ResolverResult {
  // Extends ResolverResult with wolfRobot-specific optional fields.
  // Compile-time guarantee implemented inside the resolver
}

/** Resolver function signature */
export type ResolverFn = (context: ResolverContext, input: ActionInput) => ResolverResult;

/** Resolver registry type */
export type ResolverRegistry = Partial<Record<SchemaId, ResolverFn>>;

// =============================================================================
// Magician Swap Helpers (SERVER-ONLY)
// =============================================================================

/**
 * Get the effective role at a seat after magician swap.
 *
 * If magician swapped seats A and B, checking seat A returns B's role and vice versa.
 * Used by resolvers (check/reveal actions) AND death calculation (buildRoleSeatMap)
 * for unified identity resolution after magician swap.
 *
 * @param seat - The seat to check
 * @param players - Original seat->roleId map
 * @param swappedSeats - [seatA, seatB] if magician swapped, undefined otherwise
 * @returns The role at the effective seat (after swap if applicable)
 */
export function getRoleAfterSwap(
  seat: number,
  players: ReadonlyMap<number, RoleId>,
  swappedSeats?: readonly [number, number],
): RoleId | undefined {
  if (!swappedSeats) {
    return players.get(seat);
  }

  const [a, b] = swappedSeats;
  if (seat === a) {
    return players.get(b);
  }
  if (seat === b) {
    return players.get(a);
  }
  return players.get(seat);
}

// =============================================================================
// WolfRobot Disguise Context (for resolveRoleForChecks)
// =============================================================================

/**
 * WolfRobot disguise context from WerewolfState.
 * Passed to resolvers for disguise-aware identity checks.
 */
interface WolfRobotContext {
  readonly learnedSeat: number;
  readonly disguisedRole: RoleId;
}

/**
 * Bottom-card context from WerewolfState.
 * Passed to the treasureMaster / thief resolver for card selection.
 */
export interface BottomCardContext {
  readonly bottomCards: readonly RoleId[];
  readonly actorSeat: number;
}

// =============================================================================
// Unified Role Resolution for Checks (SERVER-ONLY, Single Source of Truth)
// =============================================================================

/**
 * Resolve the effective role at a seat for check/reveal actions.
 *
 * This is the SINGLE SOURCE OF TRUTH for identity resolution during checks.
 * All resolvers (seer, psychic, gargoyle) MUST use this function.
 *
 * Resolution order:
 * 1. Apply magician swap (if any)
 * 2. If the effective role is 'wolfRobot' AND wolfRobotContext.disguisedRole exists,
 *    return the disguised role instead.
 * 3. If the seat is the treasureMaster seat AND treasureMasterChosenCard exists,
 *    return the chosen card's role instead.
 * 4. Otherwise return the effective role.
 *
 * @param context - The resolver context (contains players, currentNightResults, wolfRobotContext, bottomCardContext)
 * @param seat - The seat to check
 * @returns The role to use for checks (after swap, disguise, and card selection)
 */
export function resolveRoleForChecks(context: ResolverContext, seat: number): RoleId | undefined {
  const { players, currentNightResults, wolfRobotContext, bottomCardContext } = context;

  // Step 1: Get role after magician swap
  const effectiveRole = getRoleAfterSwap(seat, players, currentNightResults.swappedSeats);
  if (!effectiveRole) {
    return undefined;
  }

  // Step 2: Apply wolfRobot disguise if applicable
  if (wolfRobotContext && effectiveRole === 'wolfRobot') {
    return wolfRobotContext.disguisedRole;
  }

  // Step 3: Apply treasureMaster identity masquerade if applicable
  if (
    bottomCardContext &&
    effectiveRole === 'treasureMaster' &&
    currentNightResults.treasureMasterChosenCard
  ) {
    return currentNightResults.treasureMasterChosenCard;
  }

  // Step 4: Apply thief identity masquerade if applicable
  if (effectiveRole === 'thief' && currentNightResults.thiefChosenCard) {
    return currentNightResults.thiefChosenCard;
  }

  return effectiveRole;
}
