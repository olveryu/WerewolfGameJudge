/**
 * WebSocket attachment stored on room sockets for hibernation resume and targeted sends.
 */

export interface WebSocketAttachment {
  readonly userId: string;
  readonly roomCode: string;
  /** Date.now() at WS accept (epoch ms). */
  readonly connectedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWebSocketAttachment(value: unknown): value is WebSocketAttachment {
  if (!isRecord(value)) return false;
  return (
    typeof value.userId === 'string' &&
    typeof value.roomCode === 'string' &&
    typeof value.connectedAt === 'number'
  );
}
