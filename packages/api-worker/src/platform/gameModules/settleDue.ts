/**
 * Shared Worker delivery for scheduled settle.due effects.
 *
 * A game whose stage deadline is armed by a settle.due effect parks
 * the effect in the outbox until the pinned deadline; delivery then
 * dispatches one internal settle command if the pinned arming is
 * still the room's current one. That delivery chain is written once
 * here: the outbox business key and the delivery time derive from
 * the pin, and the handler no-ops a stale delivery before going
 * through the shared effect dispatch.
 *
 * The business key is the outbox dedupe identity: its segment order
 * (namespace, game sequence, phase, round, deadline) is fixed and
 * must never change — a different string is a different arming and
 * would break exactly-once settlement.
 *
 * Per-game residue stays in the game module: the zod effect schema
 * and the staleness predicate (`isCurrent`), whose compared fields
 * are the settle-pinning variant the game registered in the
 * game-engine phase-deadline variants contract.
 */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import { dispatchEffectCommand } from './effectDispatch';
import type { WorkerEffectContext } from './workerModule';

/**
 * The arming a settle.due payload pins, in the field shape the
 * engine's `SettleDuePin` defines: the game sequence, the deadline,
 * and the game's optional phase-identity extension fields.
 */
export interface SettleDuePinShape {
  readonly gameSequence: number;
  readonly deadlineAt: number;
  readonly phase?: string;
  readonly round?: number;
}

/**
 * Outbox business key for one settle.due effect: the namespace, then
 * the pin segments in their fixed order (absent extension fields
 * contribute no segment).
 */
export function settleDueBusinessKey(namespace: string, pin: SettleDuePinShape): string {
  const segments: (string | number)[] = [pin.gameSequence];
  if (pin.phase !== undefined) segments.push(pin.phase);
  if (pin.round !== undefined) segments.push(pin.round);
  segments.push(pin.deadlineAt);
  return `${namespace}:${segments.join(':')}`;
}

/** Outbox delivery time for one settle.due effect: park it until its pinned deadline. */
export function settleDueDeliveryAt(pin: SettleDuePinShape): number {
  return pin.deadlineAt;
}

/** Per-game injections for the shared settle.due delivery handler. */
export interface SettleDueHandlerOptions<
  TState extends BaseGameState<string>,
  TPayload extends SettleDuePinShape,
  TInternalCommand,
> {
  /** Command-id namespace for the settle dispatch (the business-key prefix). */
  readonly namespace: string;
  /** Error-message label for the settle dispatch. */
  readonly label: string;
  /** The internal settle command a current delivery dispatches. */
  readonly command: TInternalCommand;
  /**
   * Staleness gate: whether the arming pinned in the payload is
   * still the room's current one. A stale delivery is a no-op —
   * it must never settle whatever phase happens to be current.
   */
  readonly isCurrent: (state: TState, payload: TPayload) => boolean;
  /**
   * Rejection reasons that mean the arming was superseded while the
   * delivery was in flight (a client timeout or the host settled
   * first): the delivery is done, not failed.
   */
  readonly supersededReasons: readonly string[];
}

/**
 * Builds one game's settle.due effect handler: no-op a delivery
 * whose pinned arming is no longer current, otherwise dispatch the
 * internal settle command through the shared effect dispatch.
 */
export function createSettleDueHandler<
  TState extends BaseGameState<string>,
  TPayload extends SettleDuePinShape,
  TInternalCommand,
>(
  options: SettleDueHandlerOptions<TState, TPayload, TInternalCommand>,
): (
  effect: { readonly payload: TPayload },
  context: WorkerEffectContext<TState, TInternalCommand>,
) => Promise<void> {
  return async (effect, context) => {
    if (!options.isCurrent(context.state, effect.payload)) return;
    await dispatchEffectCommand(context, options.command, {
      namespace: options.namespace,
      supersededReasons: options.supersededReasons,
      label: options.label,
    });
  };
}
