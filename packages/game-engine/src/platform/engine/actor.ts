/** Game-neutral command actor authorization primitives. */

import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_NOT_HOST,
  REASON_SYSTEM_ACTOR_REQUIRED,
  REASON_USER_ACTOR_REQUIRED,
} from '../protocol/reasons';
import { reject } from './decision';
import type { CommandContext, Decision, GameEffect, GameEvent } from './types';

export type ActorResolution<T> =
  | { readonly kind: 'resolved'; readonly value: T }
  | { readonly kind: 'rejected'; readonly reason: string };

function resolved<T>(value: T): ActorResolution<T> {
  return { kind: 'resolved', value };
}

function rejected<T>(reason: string): ActorResolution<T> {
  return { kind: 'rejected', reason };
}

export function resolveUserActorId(context: CommandContext): ActorResolution<string> {
  return context.actor.kind === 'user'
    ? resolved(context.actor.userId)
    : rejected(REASON_USER_ACTOR_REQUIRED);
}

export function resolveUncontrolledUserActorId(context: CommandContext): ActorResolution<string> {
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return actor;
  return context.controlledSeat === null ? actor : rejected(REASON_CONTROLLED_SEAT_NOT_ALLOWED);
}

export function resolveHostActorId(
  context: CommandContext,
  hostUserId: string,
): ActorResolution<string> {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return actor;
  return actor.value === hostUserId ? actor : rejected(REASON_NOT_HOST);
}

export function resolveSystemActorEffectId(context: CommandContext): ActorResolution<string> {
  return context.actor.kind === 'system'
    ? resolved(context.actor.effectId)
    : rejected(REASON_SYSTEM_ACTOR_REQUIRED);
}

/**
 * The host gate every host-only command runs: an uncontrolled user
 * actor who is the room's host. Returns the rejection to propagate,
 * or null when the gate passes. Only the not-host outcome may be
 * re-labelled with a game-supplied reason (`notHostReason`, default
 * the platform code); the user-required and controlled-seat outcomes
 * pass through with their platform reasons (D-1), so a host acting
 * through a bot takeover is rejected as a takeover, not as a
 * non-host.
 */
export function requireHost<TEvent extends GameEvent, TEffect extends GameEffect>(
  context: CommandContext,
  hostUserId: string,
  notHostReason: string = REASON_NOT_HOST,
): Decision<TEvent, TEffect> | null {
  const actor = resolveHostActorId(context, hostUserId);
  if (actor.kind === 'resolved') return null;
  return reject(actor.reason === REASON_NOT_HOST ? notHostReason : actor.reason);
}
