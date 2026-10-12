/**
 * Pictionary test command binding (AU-44) — the one copy of the
 * seat-binding step every pictionary suite needs: public inputs
 * carry no seat, so they are bound through createPictionaryCommand
 * for the actor's seat before the engine decides them.
 */

import type { CommandContext, Decision } from '../../../platform/engine';
import {
  createPictionaryCommand,
  type PictionaryCommand,
  type PictionaryCommandInput,
  type PictionaryInternalCommand,
} from '../commands/types';
import type { PictionaryEvent } from '../domain/events';
import type { PictionaryEffect } from '../effects/types';
import { decidePictionaryCommand as decideBoundPictionaryCommand } from '../engine';
import { getPictionaryUserSeat, type PictionaryState } from '../state/types';

export type PictionaryInput = PictionaryCommandInput | PictionaryInternalCommand;

/** Binds an input to the actor's seat (drawing commits are already bound). */
export function bindPictionaryCommand(
  state: PictionaryState,
  input: PictionaryInput,
  context: CommandContext,
): PictionaryCommand {
  const seat =
    context.controlledSeat ??
    (context.actor.kind === 'user' ? getPictionaryUserSeat(state, context.actor.userId) : null) ??
    0;
  return input.type === 'pictionary.drawing.commit'
    ? input
    : createPictionaryCommand(state, input, seat);
}

/** Binds an input and runs it through the engine's decide. */
export function decidePictionaryInput(
  state: PictionaryState,
  input: PictionaryInput,
  context: CommandContext,
): Decision<PictionaryEvent, PictionaryEffect> {
  return decideBoundPictionaryCommand(state, bindPictionaryCommand(state, input, context), context);
}
