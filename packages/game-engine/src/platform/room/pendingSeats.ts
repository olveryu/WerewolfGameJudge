/**
 * Pending seats — the seats in an eligible set that have not submitted yet.
 *
 * One derivation for every "who has not submitted" list in the app
 * (sheriff election votes, avalon team votes, avalon quest plays):
 * the eligible set minus the keys of the submission record. Only the
 * keys are read, never the values, so the result names who has not
 * submitted and can never leak what anyone submitted.
 *
 * Seats are 0-based engine seats, as in the submission records;
 * callers format them for display with `formatSeat`.
 */

/** Eligible seats minus submitted seats, ascending. Empty when all have submitted. */
export function getPendingSeats(
  eligibleSeats: readonly number[],
  submitted: Readonly<Record<number, unknown>>,
): readonly number[] {
  const submittedSeats = new Set(Object.keys(submitted).map((key) => Number(key)));
  return eligibleSeats.filter((seat) => !submittedSeats.has(seat)).sort((a, b) => a - b);
}
