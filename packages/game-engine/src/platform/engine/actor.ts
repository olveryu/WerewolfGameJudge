/** Game-neutral command actor authorization primitives. */

import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_NOT_HOST,
  REASON_SYSTEM_ACTOR_REQUIRED,
  REASON_USER_ACTOR_REQUIRED,
} from '../protocol/reasons';
import type { CommandContext } from './types';

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
