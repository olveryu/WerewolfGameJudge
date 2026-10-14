/** Authoritative Werewolf command actor resolution. */

import {
  type ActorResolution,
  type CommandContext,
  resolveHostActorId,
  resolveSystemActorEffectId,
  resolveUncontrolledUserActorId,
  resolveUserActorId,
} from '../../../platform/engine';
import { REASON_INVALID_SEAT, REASON_SEAT_EMPTY } from '../../../platform/protocol/reasons';
import { resolveActingSeat } from '../../../platform/room/actingSeat';
import { findRosterSeatByUserId } from '../../../platform/room/seating';
import type { HandlerContext } from './handlers/types';
import type { GameState } from './protocol/types';

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
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return actor;
  const userId = actor.value;
  const mySeat = findRosterSeatByUserId(state.roster, seatCount(state), userId);
  return resolved({
    userId,
    handlerContext: { state, myUserId: userId, mySeat },
  });
}

export function resolveUncontrolledUserActor(
  state: GameState,
  context: CommandContext,
): ActorResolution<ResolvedUserActor> {
  const actorId = resolveUncontrolledUserActorId(context);
  if (actorId.kind === 'rejected') return actorId;
  return resolveUserActor(state, context);
}

export function resolveHostActor(
  state: GameState,
  context: CommandContext,
): ActorResolution<ResolvedUserActor> {
  const actorId = resolveHostActorId(context, state.hostUserId);
  if (actorId.kind === 'rejected') return actorId;
  return resolveUserActor(state, context);
}

export function resolveEffectiveSeatActor(
  state: GameState,
  context: CommandContext,
): ActorResolution<ResolvedSeatActor> {
  const actor = resolveUserActor(state, context);
  if (actor.kind === 'rejected') return actor;

  const controlledSeat = context.controlledSeat;
  if (controlledSeat !== null && actor.value.userId === state.hostUserId) {
    // Werewolf-only state-model gates: with the players/profiles dual
    // structure, a controlled seat outside the game is invalid and a
    // seat with no roster occupant is empty. Both precede the shared
    // bot gate, which cannot distinguish them.
    if (!Number.isSafeInteger(controlledSeat) || !Object.hasOwn(state.players, controlledSeat)) {
      return rejected(REASON_INVALID_SEAT);
    }
    if (state.roster[controlledSeat] == null) {
      return rejected(REASON_SEAT_EMPTY);
    }
  }

  const acting = resolveActingSeat(state, seatCount(state), context);
  if (acting.kind === 'rejected') return acting;
  const seat = acting.value;
  return resolved({
    userId: actor.value.userId,
    seat,
    handlerContext: { state, myUserId: actor.value.userId, mySeat: seat },
  });
}

export function resolveSystemActor(
  state: GameState,
  context: CommandContext,
): ActorResolution<HandlerContext> {
  const actor = resolveSystemActorEffectId(context);
  if (actor.kind === 'rejected') return actor;
  return resolved({ state, myUserId: null, mySeat: null });
}
