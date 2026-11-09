/**
 * seatPicking - Shared seat-board picking resolution (pure).
 *
 * One copy of the tap arithmetic for every mode-based seat pick in the
 * room: multi-select toggles (avalon nomination draft), single-seat
 * replace (undercover revelation), and one-shot triggers that open a
 * confirmation (avalon lady / assassin, fibking guess). Games supply
 * the eligible set and their mode; what a tap means is decided here and
 * nowhere else.
 *
 * Eligibility is the caller's contract (each game's policy produces the
 * set); this module never derives it. Storage of the selection (local
 * state vs the server-side room draft) is the hook's concern, not this
 * function's: it only maps (selection, tap) to the next step.
 */

export type SeatPickMode = 'toggle' | 'replace' | 'trigger';

/** What happens to a tap on a seat outside the eligible set. */
export type SeatPickIneligibleTap = 'fallthrough' | 'swallow';

export interface ResolveSeatPickTapInput {
  readonly seat: number;
  /** Seats that may be picked right now (produced by the game's policy). */
  readonly eligibleSeats: readonly number[];
  readonly mode: SeatPickMode;
  /** Current selection (toggle / replace modes). Ignored for trigger. */
  readonly selection: readonly number[];
  /** Toggle cap: at the cap, tapping an unselected seat is a silent no-op. */
  readonly maxSize?: number;
  readonly ineligibleTap: SeatPickIneligibleTap;
}

export type SeatPickTapResult =
  /** The tap changed the selection; the caller stores nextSelection. */
  | { readonly kind: 'consumed'; readonly nextSelection: readonly number[] }
  /** Trigger mode: the tap picked this seat (confirmation etc. is the caller's). */
  | { readonly kind: 'pick'; readonly seat: number }
  /** The tap was consumed but changed nothing (e.g. toggle at the cap). */
  | { readonly kind: 'ignored' }
  /** Not a picking tap: the caller runs its default seat behavior. */
  | { readonly kind: 'fallthrough' };

export function resolveSeatPickTap(input: ResolveSeatPickTapInput): SeatPickTapResult {
  const { seat, eligibleSeats, mode, selection, maxSize, ineligibleTap } = input;
  if (!eligibleSeats.includes(seat)) {
    return ineligibleTap === 'swallow' ? { kind: 'ignored' } : { kind: 'fallthrough' };
  }
  switch (mode) {
    case 'trigger':
      return { kind: 'pick', seat };
    case 'replace':
      return { kind: 'consumed', nextSelection: [seat] };
    case 'toggle': {
      if (selection.includes(seat)) {
        return { kind: 'consumed', nextSelection: selection.filter((entry) => entry !== seat) };
      }
      if (maxSize !== undefined && selection.length >= maxSize) return { kind: 'ignored' };
      return { kind: 'consumed', nextSelection: [...selection, seat] };
    }
  }
}
