/**
 * Host Reveal — shared record for host-operated seat reveals.
 *
 * In face-to-face games the table decides offline and the host operates
 * the phone: undercover reveals an eliminated seat's identity, fibking
 * reveals the seat the guesser picked. Both record each reveal the same
 * way ({ seat, role, revealedAt }) and let the game supply its own end
 * predicate over the recorded reveals; these helpers are the single
 * implementation of the record keeping so hosts' reveal flows cannot
 * drift. Engines never reveal on their own — a reveal only lands
 * through the host's command.
 */

/** One host-operated reveal of a seat's secret role. */
export interface HostRevelation<TRole> {
  readonly seat: number;
  readonly role: TRole;
  readonly revealedAt: number;
}

/** Whether the seat already appears in the reveal record. */
export function hasBeenRevealed<TRole>(
  revelations: readonly HostRevelation<TRole>[],
  seat: number,
): boolean {
  return revelations.some((revelation) => revelation.seat === seat);
}

/** Appends one reveal; callers reject already-revealed seats beforehand. */
export function appendRevelation<TRole>(
  revelations: readonly HostRevelation<TRole>[],
  seat: number,
  role: TRole,
  revealedAt: number,
): readonly HostRevelation<TRole>[] {
  return [...revelations, { seat, role, revealedAt }];
}
