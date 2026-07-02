/**
 * Handler Types - handler type definitions
 *
 * Handlers are responsible for:
 * 1. Validating Intent
 * 2. Calling Resolver (if needed)
 * 3. Returning a list of StateAction
 */

import type { SideEffect } from '../../protocol/common';
import type { StateAction } from '../reducer/types';
import type { WerewolfState } from '../store/types';

/**
 * Handler context
 * Provides dependencies required for handler execution
 *
 * Note: state and myUserId may be null (Facade does not validate; handler is responsible)
 */
export interface HandlerContext {
  /** Current state (read-only). null = DO uninitialized or read failure */
  readonly state: WerewolfState | null;

  /** Current user UID. null = system context (e.g., alarm callback) */
  readonly myUserId: string | null;

  /** Current user seat number. null = user not seated or system context (host-only operations) */
  readonly mySeat: number | null;
}

/**
 * Handler result — discriminated union
 *
 * Three result semantics:
 * - `success`: completed normally, has actions to apply + persist + broadcast
 * - `rejection`: business rejection (e.g., immune to attack), has actions (ACTION_REJECTED etc.) to persist + broadcast
 * - `error`: infrastructure/precondition failure (state missing, wrong status), no actions, returns HTTP error directly
 */
export type HandlerResult = HandlerSuccess | HandlerRejection | HandlerError;

export interface HandlerSuccess {
  readonly kind: 'success';
  readonly actions: StateAction[];
  readonly sideEffects?: readonly SideEffect[];
  /** Optional metadata (e.g., 'DEDUPLICATED'); does not affect success semantics, used by client toast */
  readonly reason?: string;
}

export interface HandlerRejection {
  readonly kind: 'rejection';
  readonly reason: string;
  readonly actions: StateAction[];
  readonly sideEffects?: readonly SideEffect[];
}

export interface HandlerError {
  readonly kind: 'error';
  readonly reason: string;
}

// ── Factory functions ───────────────────────────────────────────────────────

export function handlerSuccess(
  actions: StateAction[],
  sideEffects?: readonly SideEffect[],
  reason?: string,
): HandlerSuccess {
  return { kind: 'success', actions, sideEffects, reason };
}

export function handlerRejection(
  reason: string,
  actions: StateAction[],
  sideEffects?: readonly SideEffect[],
): HandlerRejection {
  return { kind: 'rejection', reason, actions, sideEffects };
}

export function handlerError(reason: string): HandlerError {
  return { kind: 'error', reason };
}

/**
 * Side effect types and STANDARD_SIDE_EFFECTS are game-agnostic and live in
 * `protocol/common.ts` so non-werewolf engines can reuse them. Werewolf handlers re-export
 * them because handler results use the shared side-effect contract.
 */
export type { SideEffect } from '../../protocol/common';
export { STANDARD_SIDE_EFFECTS } from '../../protocol/common';

/**
 * Non-null WerewolfState type (used after handler validation)
 */
export type NonNullState = NonNullable<HandlerContext['state']>;
