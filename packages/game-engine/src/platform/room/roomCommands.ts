/**
 * Room Commands — the shared decide skeleton for the canonical
 * seated-room commands (E-1).
 *
 * Every roster game answers the same room commands — profile update,
 * seat take/leave, host config update, fill bots, kick, clear — and
 * the gate order is welded here so the engines cannot drift:
 *
 * 1. `room.profile.update` runs ahead of the lobby gate (a seated
 *    player may refresh their profile in any phase): uncontrolled
 *    user actor, seat resolution, display-name validation, then the
 *    game's profile landing. The seat comes from the human seat map,
 *    which excludes bots by construction, so no occupant check
 *    follows the resolution.
 * 2. The lobby gate: a ready-made rejection the caller computes from
 *    its own phase representation — per command, so a game whose
 *    gate differs per command (a fill-bots-only phase gate) computes
 *    that command's rejection at the call site. The phase
 *    representation and the reason vocabulary stay the game's own.
 * 3. `room.seat.take` / `room.seat.leave`: uncontrolled user actor,
 *    then — for take — the display-name validation ahead of the
 *    roster decide; roster rejections pass through untouched.
 * 4. The host gate: platform `requireHost` with the platform
 *    not-host code.
 * 5. The host switch: the game's config update through its resolved
 *    config facts (invalid → occupied → no-op → event), then
 *    fill-bots / kick / clear through the roster decides; anything
 *    else rejects with the game's phase reason — including a
 *    config-shaped command the game resolved no facts for.
 *
 * Seat changes commit through the game's own seats-changed event; an
 * accepted decide with zero changes (fill on a full room, clear on
 * an empty one, a no-op config) commits empty, never an empty
 * seats-changed event. The occupant a take creates is built here —
 * every game's human seat is exactly { seat, userId, profile } — so
 * no game injects a factory.
 *
 * What stays the game's own (injected): the seats-changed event form
 * and the commit, the reason vocabulary (phase / config / occupied),
 * the profile landing (a roster change folded into seats.changed, or
 * the game's own profile event — fibking/pictionary), and the config
 * facts (validator verdict, new seat count, no-op policy, event
 * builder). The config occupied gate reads the facts' new seat
 * count; a game whose config has no occupancy dimension (werewolf:
 * template roles only) omits it and the gate is skipped.
 */

import {
  type CommandContext,
  type Decision,
  type GameCommand,
  type GameEffect,
  type GameEvent,
  reject,
  requireHost,
  resolveUncontrolledUserActorId,
} from '../engine';
import type { RoomProfileUpdateCommand, RoomSeatCommand } from '../protocol/commands';
import { REASON_NOT_SEATED } from '../protocol/reasons';
import type { RoomProfileUpdate, RoomSeatProfile } from './roster';
import {
  decideRosterClearSeats,
  decideRosterFillBots,
  decideRosterKickSeat,
  decideRosterLeaveSeat,
  decideRosterTakeSeat,
  findSeatByUserId,
  getHumanSeatMap,
  hasOccupantAtOrBeyond,
  type RosterChange,
  type RosterMap,
  type SeatOccupant,
} from './seating';

/** The one human-seat shape every roster game uses: identity plus profile. */
export interface RoomSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

/** The roster facts the skeleton decides over, read off the game's state. */
export interface SeatRosterFacts {
  readonly roster: RosterMap<RoomSeat>;
  readonly seatCount: number;
  readonly hostUserId: string;
}

/**
 * How a profile update lands. `rosterChange` folds the merged profile
 * into a seats-changed roster change (the roster games and the
 * templates); `event` emits the game's own profile event built from
 * the seat and the raw update (fibking, pictionary).
 */
export type RoomProfileLanding<TEvent extends GameEvent> =
  | { readonly kind: 'rosterChange' }
  | {
      readonly kind: 'event';
      readonly buildEvent: (seat: number, profile: RoomProfileUpdate) => TEvent;
    };

/**
 * The caller's resolution of its config-update command, computed
 * where the game's config type is known and handed in ready-made.
 * The skeleton runs the gates in welded order over the facts:
 * invalid, then the occupied gate, then the no-op policy, then the
 * event.
 */
export interface RoomConfigFacts<TEvent extends GameEvent> {
  /** The game's config rejection when the payload is invalid; null when valid. */
  readonly invalidReason: string | null;
  /**
   * Seat count after the update, read by the occupied gate. Omit
   * when the update cannot change the seat count — the gate is then
   * skipped (a config with no occupancy dimension).
   */
  readonly newSeatCount?: number;
  /** True when the update restates the current config: an empty commit. */
  readonly isNoop?: boolean;
  /** Builds the config-updated event; called only once every gate passes. */
  readonly buildEvent: () => TEvent;
}

/** Per-game injections for the shared room-command decide sequence. */
export interface DecideRoomCommandsOptions<
  TEvent extends GameEvent,
  TEffect extends GameEffect,
  TConfigCommand extends GameCommand,
> {
  /**
   * Ready-made lobby rejection, computed by the caller from its own
   * phase representation — per command, so per-command phase gates
   * are expressed at the call site; null admits the command.
   */
  readonly lobbyRejection: Decision<TEvent, TEffect> | null;
  /** The game's phase rejection code (non-lobby phases, unknown commands). */
  readonly phaseReason: string;
  /** The game's config rejection code (display-name validation). */
  readonly configReason: string;
  /** The game's occupied rejection code (config occupied gate). */
  readonly occupiedReason: string;
  /** How profile updates land (see RoomProfileLanding). */
  readonly profileLanding: RoomProfileLanding<TEvent>;
  /**
   * Resolves the game's config-update command to its facts (null
   * for any other command); omit when no config update is routed
   * here — config-shaped commands then reject with the phase reason
   * (the platform default).
   */
  readonly resolveConfigFacts?: (
    command: RoomCommandsCommand<TConfigCommand>,
  ) => RoomConfigFacts<TEvent> | null;
  /** Builds the game's seats-changed event from roster changes. */
  readonly buildSeatsChangedEvent: (changes: readonly RosterChange<RoomSeat>[]) => TEvent;
  /** The game's commit (its decision wrapper over the platform commit). */
  readonly commit: (events: readonly TEvent[]) => Decision<TEvent, TEffect>;
}

/** The commands the skeleton decides: the shared room commands plus the game's config update. */
export type RoomCommandsCommand<TConfigCommand extends GameCommand> =
  | RoomSeatCommand<RoomSeatProfile>
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | TConfigCommand;

type TakeSeatCommand = Extract<RoomSeatCommand<RoomSeatProfile>, { type: 'room.seat.take' }>;
type LeaveSeatCommand = Extract<RoomSeatCommand<RoomSeatProfile>, { type: 'room.seat.leave' }>;
type KickSeatCommand = Extract<RoomSeatCommand<RoomSeatProfile>, { type: 'room.seat.kick' }>;

// The branch payloads are read through discriminant guards: the
// game's config command rides the same union as an opaque generic
// member, which plain narrowing cannot see past. A command whose
// type is a shared room command type is that command — config
// commands are `<game>.config.update`, never `room.*`.
function isProfileUpdateCommand<TConfigCommand extends GameCommand>(
  command: RoomCommandsCommand<TConfigCommand>,
): command is RoomProfileUpdateCommand<RoomProfileUpdate> {
  return command.type === 'room.profile.update';
}

function isTakeSeatCommand<TConfigCommand extends GameCommand>(
  command: RoomCommandsCommand<TConfigCommand>,
): command is TakeSeatCommand {
  return command.type === 'room.seat.take';
}

function isLeaveSeatCommand<TConfigCommand extends GameCommand>(
  command: RoomCommandsCommand<TConfigCommand>,
): command is LeaveSeatCommand {
  return command.type === 'room.seat.leave';
}

function isKickSeatCommand<TConfigCommand extends GameCommand>(
  command: RoomCommandsCommand<TConfigCommand>,
): command is KickSeatCommand {
  return command.type === 'room.seat.kick';
}

export function decideRoomCommands<
  TEvent extends GameEvent,
  TEffect extends GameEffect,
  TConfigCommand extends GameCommand,
>(input: {
  readonly facts: SeatRosterFacts;
  readonly command: RoomCommandsCommand<TConfigCommand>;
  readonly context: CommandContext;
  readonly options: DecideRoomCommandsOptions<TEvent, TEffect, TConfigCommand>;
}): Decision<TEvent, TEffect> {
  const { facts, command, context, options } = input;
  const commitSeats = (changes: readonly RosterChange<RoomSeat>[]): Decision<TEvent, TEffect> =>
    changes.length === 0
      ? options.commit([])
      : options.commit([options.buildSeatsChangedEvent(changes)]);

  if (isProfileUpdateCommand(command)) {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    const humans = getHumanSeatMap(facts.roster, facts.seatCount);
    const seat = findSeatByUserId(humans, facts.seatCount, actor.value);
    if (seat === null) return reject(REASON_NOT_SEATED);
    if (
      command.profile.displayName !== undefined &&
      command.profile.displayName.trim().length === 0
    )
      return reject(options.configReason);
    if (options.profileLanding.kind === 'event')
      return options.commit([options.profileLanding.buildEvent(seat, command.profile)]);
    // The seat was resolved out of this very map, so its occupant is present.
    const occupant = humans[seat]!;
    return commitSeats([
      {
        seat,
        previous: occupant,
        next: { ...occupant, profile: { ...occupant.profile, ...command.profile } },
      },
    ]);
  }
  if (options.lobbyRejection !== null) return options.lobbyRejection;
  if (isTakeSeatCommand(command) || isLeaveSeatCommand(command)) {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    if (isTakeSeatCommand(command) && command.profile.displayName.trim().length === 0)
      return reject(options.configReason);
    const result = isTakeSeatCommand(command)
      ? decideRosterTakeSeat(facts.roster, facts.seatCount, command.seat, actor.value, (seat) => ({
          seat,
          userId: actor.value,
          profile: { ...command.profile },
        }))
      : decideRosterLeaveSeat(facts.roster, facts.seatCount, actor.value);
    if (result.kind === 'rejected') return reject(result.reason);
    return commitSeats(result.changes);
  }
  const hostRejection = requireHost<TEvent, TEffect>(context, facts.hostUserId);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'room.seat.fillBots': {
      const result = decideRosterFillBots(facts.roster, facts.seatCount);
      return result.kind === 'rejected' ? reject(result.reason) : commitSeats(result.changes);
    }
    case 'room.seat.kick': {
      if (!isKickSeatCommand(command)) return reject(options.phaseReason);
      const result = decideRosterKickSeat(facts.roster, facts.seatCount, command.seat);
      return result.kind === 'rejected' ? reject(result.reason) : commitSeats(result.changes);
    }
    case 'room.seat.clear': {
      const result = decideRosterClearSeats(facts.roster, facts.seatCount);
      return result.kind === 'rejected' ? reject(result.reason) : commitSeats(result.changes);
    }
    default: {
      if (options.resolveConfigFacts === undefined) return reject(options.phaseReason);
      const configFacts = options.resolveConfigFacts(command);
      if (configFacts === null) return reject(options.phaseReason);
      if (configFacts.invalidReason !== null) return reject(configFacts.invalidReason);
      if (
        configFacts.newSeatCount !== undefined &&
        hasOccupantAtOrBeyond(facts.roster, configFacts.newSeatCount)
      )
        return reject(options.occupiedReason);
      if (configFacts.isNoop === true) return options.commit([]);
      return options.commit([configFacts.buildEvent()]);
    }
  }
}
