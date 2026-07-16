/**
 * Handler Types - handler type definitions
 *
 * Handlers are responsible for:
 * 1. Validating Intent
 * 2. Calling Resolver (if needed)
 * 3. Returning a list of StateAction
 */

import type { CommandExecutionContext } from '../../../../platform/engine';
import type { GameState } from '../protocol/types';
import type { StateAction } from '../reducer/types';

export type HandlerExecutionContext = CommandExecutionContext;

/**
 * Handler context
 * Provides dependencies required for handler execution
 *
 * The platform command pipeline resolves an initialized room before entering a game handler.
 * Actor identity remains nullable because system commands and unseated users share this boundary.
 */
export interface HandlerContext {
  /** Current authoritative state (read-only). */
  readonly state: GameState;

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
 * - `error`: command precondition failure (for example, wrong status), no actions
 */
export type HandlerResult = HandlerSuccess | HandlerRejection | HandlerError;

export interface HandlerSuccess {
  readonly kind: 'success';
  readonly actions: StateAction[];
  /** Optional metadata (e.g., 'DEDUPLICATED'); does not affect success semantics, used by client toast */
  readonly reason?: string;
}

export interface HandlerRejection {
  readonly kind: 'rejection';
  readonly reason: string;
  readonly actions: StateAction[];
}

export interface HandlerError {
  readonly kind: 'error';
  readonly reason: string;
}

// ── Factory functions ───────────────────────────────────────────────────────

export function handlerSuccess(actions: StateAction[], reason?: string): HandlerSuccess {
  return { kind: 'success', actions, reason };
}

export function handlerRejection(reason: string, actions: StateAction[]): HandlerRejection {
  return { kind: 'rejection', reason, actions };
}

export function handlerError(reason: string): HandlerError {
  return { kind: 'error', reason };
}
