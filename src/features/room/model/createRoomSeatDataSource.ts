/**
 * Seat data source factory — the single assembly site for the shared
 * seat-board source shape.
 *
 * Every roster game used to hand-write the same getSeat skeleton:
 * index guard, human/bot player assembly, self/highlight derivation,
 * the lobby-only level/decoration flags and the locked-seat reason.
 * Only three fields genuinely differ per game — statusBadge,
 * secondaryLabel and showReadyBadge — so games inject those (plus
 * their wording and bot-id format) and the skeleton lives exactly
 * once. Werewolf does not use this factory: its source consumes
 * pre-built seat view models, a different input model (AU-39 line).
 */

import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';

import type {
  RoomSeatDataSource,
  RoomSeatHighlight,
  RoomSeatPlayer,
  RoomSeatStatusBadge,
} from './RoomSeatDataSource';
import { toRoomSeatPlayer } from './toRoomSeatPlayer';

/** A human roster occupant as the factory reads it (mirrors the engine roster occupant). */
export interface RoomSeatSourceHuman {
  readonly userId: string;
  readonly profile: RoomSeatProfile;
}

/** A bot roster occupant: a marker carrying no identity of its own. */
export interface RoomSeatSourceBot {
  readonly kind: 'bot';
}

export type RoomSeatSourceOccupant = RoomSeatSourceHuman | RoomSeatSourceBot;

function isBotOccupant(occupant: RoomSeatSourceOccupant): occupant is RoomSeatSourceBot {
  return 'kind' in occupant && occupant.kind === 'bot';
}

export interface CreateRoomSeatDataSourceInput {
  readonly seatCount: number;
  /** State revision the board re-renders on. */
  readonly revision: number;
  /**
   * Full revision key override. The standard key is
   * `${revision}:${controlledSeat ?? 'self'}`; a game whose source
   * also tracks interaction state (e.g. a seat selection) composes
   * its own key here instead.
   */
  readonly revisionKey?: string;
  readonly roster: Readonly<Record<number, RoomSeatSourceOccupant | null | undefined>>;
  readonly viewerUserId: string;
  readonly controlledSeat: number | null;
  /** The game's own lobby test, in its phase vocabulary. */
  readonly isLobby: boolean;
  /** The game's bot user-id format (the id formats stay game-owned). */
  readonly botUserId: (seat: number) => string;
  /** The game's fail-fast message for an out-of-range seat index. */
  readonly outOfRangeError: (seat: number) => string;
  /** The game's wording for tapping an empty seat after the lobby. */
  readonly lockedSeatReason: string;
  readonly resolveSecondaryLabel?: (seat: number, player: RoomSeatPlayer | null) => string | null;
  readonly resolveStatusBadge?: (
    seat: number,
    player: RoomSeatPlayer | null,
  ) => RoomSeatStatusBadge | null;
  readonly resolveShowReadyBadge?: (seat: number) => boolean;
  readonly resolveIsStatusEmphasized?: (seat: number) => boolean;
  /** Return undefined to fall back to the controlled-seat highlight. */
  readonly resolveHighlight?: (seat: number) => RoomSeatHighlight | undefined;
  /** Overrides the locked-seat reason computation when provided. */
  readonly resolveDisabledReason?: (
    seat: number,
    player: RoomSeatPlayer | null,
  ) => string | undefined;
}

/** Assemble the shared seat-board data source for a roster game. */
export function createRoomSeatDataSource(input: CreateRoomSeatDataSourceInput): RoomSeatDataSource {
  const { seatCount, roster, viewerUserId, controlledSeat, isLobby } = input;
  return {
    count: seatCount,
    revision: input.revisionKey ?? `${input.revision}:${controlledSeat ?? 'self'}`,
    getSeat(seat) {
      if (!Number.isSafeInteger(seat) || seat < 0 || seat >= seatCount) {
        throw new Error(input.outOfRangeError(seat));
      }
      const occupant = roster[seat];
      const human = occupant != null && !isBotOccupant(occupant) ? occupant : undefined;
      const player =
        human !== undefined
          ? toRoomSeatPlayer({ kind: 'human', userId: human.userId, ...human.profile })
          : occupant != null && isBotOccupant(occupant)
            ? toRoomSeatPlayer({
                kind: 'bot',
                userId: input.botUserId(seat),
                displayName: getBotDisplayName(seat),
              })
            : null;
      return {
        seat,
        player,
        isSelf: human?.userId === viewerUserId,
        highlight:
          input.resolveHighlight?.(seat) ?? (controlledSeat === seat ? 'controlled' : 'none'),
        secondaryLabel: input.resolveSecondaryLabel?.(seat, player) ?? null,
        disabledReason:
          input.resolveDisabledReason?.(seat, player) ??
          (player === null && !isLobby ? input.lockedSeatReason : undefined),
        showReadyBadge: input.resolveShowReadyBadge?.(seat) ?? false,
        statusBadge: input.resolveStatusBadge?.(seat, player) ?? null,
        isStatusEmphasized: input.resolveIsStatusEmphasized?.(seat) ?? false,
        showLevel: isLobby,
        decorationsEnabled: isLobby,
      };
    },
  };
}
