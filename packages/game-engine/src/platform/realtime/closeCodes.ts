/**
 * Realtime close codes shared by the Worker gateway and room clients.
 *
 * Terminal codes stop client reconnection; every other code is retried.
 * 4xxx values are application-defined per RFC 6455 §7.4.2.
 */

export const REALTIME_CLOSE_CODE = {
  PROTOCOL_ERROR: 1002,
  ROOM_DELETED: 4000,
  ROOM_INSTANCE_MISMATCH: 4001,
  AUTH_REJECTED: 4002,
  STATE_UNAVAILABLE: 4003,
} as const;

export type RealtimeCloseCode = (typeof REALTIME_CLOSE_CODE)[keyof typeof REALTIME_CLOSE_CODE];

/** Client-facing reason for a terminal close. `released` is local (client called close()). */
export type RealtimeCloseReason =
  | 'protocol'
  | 'roomDeleted'
  | 'instanceMismatch'
  | 'authRejected'
  | 'stateUnavailable'
  | 'released';

const TERMINAL_CLOSE_REASONS: ReadonlyMap<number, RealtimeCloseReason> = new Map<
  number,
  RealtimeCloseReason
>([
  [REALTIME_CLOSE_CODE.PROTOCOL_ERROR, 'protocol'],
  [REALTIME_CLOSE_CODE.ROOM_DELETED, 'roomDeleted'],
  [REALTIME_CLOSE_CODE.ROOM_INSTANCE_MISMATCH, 'instanceMismatch'],
  [REALTIME_CLOSE_CODE.AUTH_REJECTED, 'authRejected'],
  [REALTIME_CLOSE_CODE.STATE_UNAVAILABLE, 'stateUnavailable'],
]);

/** Map a socket close code to its terminal reason, or null when the client should reconnect. */
export function readTerminalCloseReason(code: number): RealtimeCloseReason | null {
  return TERMINAL_CLOSE_REASONS.get(code) ?? null;
}
