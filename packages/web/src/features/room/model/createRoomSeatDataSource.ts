/**
 * Seat data source factory — the single assembly site for the shared
 * seat-board source shape.
 *
 * Every roster game used to hand-write the same getSeat skeleton:
 * index guard, human/bot player assembly, self/highlight derivation,
 * the lobby-only level/decoration flags and the locked-seat reason.
 * Only three fields genuinely differ per game — statusBadge,
 * secondaryLabel and showReadyBadge — so games inject those and the
 * skeleton lives exactly once. The wording is shared too: the
 * locked-seat reason and the out-of-range message have one default,
 * overridable only where a game's copy genuinely differs.
 */

import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';

import type {
  RoomSeatDataSource,
  RoomSeatHighlight,
  RoomSeatIndicators,
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
  /** Game name for the default out-of-range fail-fast message. */
  readonly gameName: string;
  /** Overrides the default out-of-range fail-fast message. */
  readonly outOfRangeError?: (seat: number) => string;
  /** Overrides the default wording for tapping an empty seat after the lobby. */
  readonly lockedSeatReason?: string;
  readonly resolveSecondaryLabel?: (seat: number, player: RoomSeatPlayer | null) => string | null;
  readonly resolveStatusBadge?: (
    seat: number,
    player: RoomSeatPlayer | null,
  ) => RoomSeatStatusBadge | null;
  readonly resolveShowReadyBadge?: (seat: number) => boolean;
  readonly resolveIndicators?: (seat: number) => RoomSeatIndicators | null;
  readonly resolveIsStatusEmphasized?: (seat: number) => boolean;
  /** Return undefined to fall back to the controlled-seat highlight. */
  readonly resolveHighlight?: (seat: number) => RoomSeatHighlight | undefined;
  /** Overrides the locked-seat reason computation when provided. */
  readonly resolveDisabledReason?: (
    seat: number,
    player: RoomSeatPlayer | null,
  ) => string | undefined;
}

const ROOM_SEAT_LOCKED_REASON = '游戏进行中不能入座';

/** Assemble the shared seat-board data source for a roster game. */
export function createRoomSeatDataSource(input: CreateRoomSeatDataSourceInput): RoomSeatDataSource {
  const { seatCount, roster, viewerUserId, controlledSeat, isLobby } = input;
  const outOfRangeError =
    input.outOfRangeError ?? ((seat: number) => `${input.gameName} seat out of range: ${seat}`);
  const lockedSeatReason = input.lockedSeatReason ?? ROOM_SEAT_LOCKED_REASON;
  return {
    count: seatCount,
    revision: input.revisionKey ?? `${input.revision}:${controlledSeat ?? 'self'}`,
    getSeat(seat) {
      if (!Number.isSafeInteger(seat) || seat < 0 || seat >= seatCount) {
        throw new Error(outOfRangeError(seat));
      }
      const occupant = roster[seat];
      const human = occupant != null && !isBotOccupant(occupant) ? occupant : undefined;
      const player =
        human !== undefined
          ? toRoomSeatPlayer({
              occupant: { kind: 'human', userId: human.userId },
              ...human.profile,
            })
          : occupant != null && isBotOccupant(occupant)
            ? toRoomSeatPlayer({
                occupant: { kind: 'bot', seat },
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
          (player === null && !isLobby ? lockedSeatReason : undefined),
        showReadyBadge: input.resolveShowReadyBadge?.(seat) ?? false,
        statusBadge: input.resolveStatusBadge?.(seat, player) ?? null,
        indicators: input.resolveIndicators?.(seat) ?? null,
        isStatusEmphasized: input.resolveIsStatusEmphasized?.(seat) ?? false,
        showLevel: isLobby,
        decorationsEnabled: isLobby,
      };
    },
  };
}
