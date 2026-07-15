/**
 * ActionResult — Discriminated union for game action outcomes.
 *
 * Used across client (facade → hooks → UI) and server (handler → HTTP response).
 * Discriminant: `success`.
 * - success=true: reason is optional informational metadata (e.g. 'DEDUPLICATED')
 * - success=false: reason is guaranteed to exist (e.g. 'NOT_CONNECTED', 'TIMEOUT')
 */
export type ActionResult = { success: true; reason?: string } | { success: false; reason: string };
