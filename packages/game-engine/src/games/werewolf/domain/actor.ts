/** Authoritative Werewolf command actor resolution. */

import type { HandlerContext } from '../../../engine/handlers/types';
import type { CommandContext } from '../../../platform/engine';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_INVALID_SEAT,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
  REASON_SEAT_EMPTY,
  REASON_SYSTEM_ACTOR_REQUIRED,
  REASON_USER_ACTOR_REQUIRED,
} from '../../../platform/protocol/reasons';
import { findSeatByUserId } from '../../../platform/room/seating';
import type { GameState } from '../../../protocol/types';

export type ActorResolution<T> =
  | { readonly kind: 'resolved'; readonly value: T }
  | { readonly kind: 'rejected'; readonly reason: string };

export interface ResolvedUserActor {
  readonly userId: string;
  readonly handlerContext: HandlerContext;
}

export interface ResolvedSeatActor extends ResolvedUserActor {
  readonly seat: number;
}

function resolved<T>(value: T): ActorResolution<T> {
  return { kind: 'resolved', value };
}

function rejected<T>(reason: string): ActorResolution<T> {
  return { kind: 'rejected', reason };
}

function seatCount(state: GameState): number {
  return Object.keys(state.players).length;
}

export function resolveUserActor(
  state: GameState,
  context: CommandContext,
): ActorResolution<ResolvedUserActor> {
  if (context.actor.kind !== 'user') {
    return rejected(REASON_USER_ACTOR_REQUIRED);
  }

  const userId = context.actor.userId;
  const mySeat = findSeatByUserId(state.players, seatCount(state), userId);
  return resolved({
    userId,
    handlerContext: { state, myUserId: userId, mySeat },
  });
}

export function resolveUncontrolledUserActor(
  state: GameState,
  context: CommandContext,
): ActorResolution<ResolvedUserActor> {
  const actor = resolveUserActor(state, context);
  if (actor.kind === 'rejected') return actor;
  if (context.controlledSeat !== null) {
    return rejected(REASON_CONTROLLED_SEAT_NOT_ALLOWED);
  }
  return actor;
}

export function resolveHostActor(
  state: GameState,
  context: CommandContext,
): ActorResolution<ResolvedUserActor> {
  const actor = resolveUserActor(state, context);
  if (actor.kind === 'rejected') return actor;
  if (actor.value.userId !== state.hostUserId) {
    return rejected(REASON_NOT_HOST);
  }
  return actor;
}

export function resolveEffectiveSeatActor(
  state: GameState,
  context: CommandContext,
): ActorResolution<ResolvedSeatActor> {
  const actor = resolveUserActor(state, context);
  if (actor.kind === 'rejected') return actor;

  if (context.controlledSeat === null) {
    const seat = actor.value.handlerContext.mySeat;
    if (seat === null) return rejected(REASON_NOT_SEATED);
    return resolved({ ...actor.value, seat });
  }

  if (actor.value.userId !== state.hostUserId) {
    return rejected(REASON_NOT_HOST);
  }

  const controlledSeat = context.controlledSeat;
  if (!Number.isSafeInteger(controlledSeat) || !Object.hasOwn(state.players, controlledSeat)) {
    return rejected(REASON_INVALID_SEAT);
  }

  const controlledPlayer = state.players[controlledSeat];
  if (controlledPlayer == null) {
    return rejected(REASON_SEAT_EMPTY);
  }
  if (controlledPlayer.isBot !== true) {
    return rejected(REASON_CONTROLLED_SEAT_NOT_BOT);
  }

  return resolved({
    userId: actor.value.userId,
    seat: controlledSeat,
    handlerContext: {
      state,
      myUserId: actor.value.userId,
      mySeat: controlledSeat,
    },
  });
}

export function resolveSystemActor(
  state: GameState,
  context: CommandContext,
): ActorResolution<HandlerContext> {
  if (context.actor.kind !== 'system') {
    return rejected(REASON_SYSTEM_ACTOR_REQUIRED);
  }
  return resolved({ state, myUserId: null, mySeat: null });
}
