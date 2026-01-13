/**
 * Resolver Types (HOST-ONLY)
 * 
 * Pure functions for validating and computing action results.
 * 
 * ⚠️ WARNING: These types and the resolver implementations MUST NOT be imported by UI code.
 * Use the import boundary test in __tests__/import-boundary.test.ts to enforce this.
 */

import type { RoleId } from '../../../models/roles/spec/specs';
import type { SchemaId } from '../../../models/roles/spec/schemas';

/** 
 * Current night's accumulated results.
 * Used to pass resolved results between steps (e.g., nightmare block → wolf kill).
 */
export interface CurrentNightResults {
  /** Target seat of wolf kill (before save/guard resolution) */
  readonly wolfKillTarget?: number;
  
  /** Seat blocked by nightmare (skill is disabled) */
  readonly blockedSeat?: number;
  
  /** 
   * Whether wolf kill is disabled for this night.
   * Set to true if nightmare blocks a wolf.
   */
  readonly wolfKillDisabled?: boolean;
  
  /** Seat protected by guard */
  readonly guardedSeat?: number;
  
  /** Seat saved by witch */
  readonly savedSeat?: number;
  
  /** Seat poisoned by witch */
  readonly poisonedSeat?: number;
  
  /** Seat dreaming (protected by dreamcatcher) */
  readonly dreamingSeat?: number;
  
  /** Seats swapped by magician */
  readonly swappedSeats?: readonly [number, number];
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
  
  /** Game state flags */
  readonly gameState?: {
    readonly witchHasAntidote?: boolean;
    readonly witchHasPoison?: boolean;
    readonly isNight1?: boolean;
  };
}

/** Action input from player */
export interface ActionInput {
  readonly schemaId: SchemaId;
  readonly target?: number;  // For chooseSeat, wolfVote
  readonly targets?: readonly number[];  // For swap
  readonly stepResults?: Record<string, number | null>;  // For compound
  readonly confirmed?: boolean;  // For confirm
}

/** Resolver result - role action outcome */
export interface ResolverResult {
  readonly valid: boolean;
  readonly rejectReason?: string;
  
  /** 
   * Updates to CurrentNightResults after this action.
   * Host will merge these updates into the accumulated results.
   */
  readonly updates?: Partial<CurrentNightResults>;
  
  /** Computed results (role-specific, for feedback to Host/UI) */
  readonly result?: {
    readonly checkResult?: '好人' | '狼人';  // seer
    readonly identityResult?: RoleId;  // psychic, gargoyle, wolfRobot
    readonly savedTarget?: number;  // witch save
    readonly poisonedTarget?: number;  // witch poison
    readonly guardedTarget?: number;  // guard
    readonly blockedTarget?: number;  // nightmare
    readonly dreamTarget?: number;  // dreamcatcher
    readonly charmTarget?: number;  // wolfQueen
    readonly swapTargets?: readonly [number, number];  // magician
    readonly learnTarget?: number;  // wolfRobot
    readonly wolfKillTarget?: number;  // wolf pack
    readonly idolTarget?: number;  // slacker
  };
}

/** Resolver function signature */
export type ResolverFn = (
  context: ResolverContext,
  input: ActionInput,
) => ResolverResult;

/** Resolver registry type */
export type ResolverRegistry = Partial<Record<SchemaId, ResolverFn>>;
