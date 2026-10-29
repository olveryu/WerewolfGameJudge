/**
 * The room Durable Object has exactly one alarm shared by every wake source (outbox delivery,
 * delivery watchdog, presence sweep). A source may only pull the alarm earlier; the full recompute
 * that may push it later lives in `GameRoomRuntime.#scheduleAlarm()` at the end of `alarm()`.
 */

/** Arm the alarm at `atMs` unless an earlier (or equal) alarm is already armed. */
export async function requestWakeNoLaterThan(
  storage: DurableObjectStorage,
  atMs: number,
): Promise<void> {
  const armed = await storage.getAlarm();
  if (armed === null || atMs < armed) await storage.setAlarm(atMs);
}
