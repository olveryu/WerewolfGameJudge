/** Client acknowledgement contract for durable user events. */

export interface UserEventAckMessage {
  readonly type: 'USER_EVENT_ACK';
  readonly eventId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createUserEventAckMessage(eventId: string): UserEventAckMessage {
  if (eventId.length === 0) throw new Error('User event ID must be non-empty');
  return { type: 'USER_EVENT_ACK', eventId };
}

export function parseUserEventAckMessage(value: unknown): UserEventAckMessage {
  if (!isRecord(value)) throw new Error('User event acknowledgement must be an object');
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes('type') || !keys.includes('eventId')) {
    throw new Error('User event acknowledgement has unsupported fields');
  }
  if (value.type !== 'USER_EVENT_ACK') {
    throw new Error(`Unsupported WebSocket client message: ${String(value.type)}`);
  }
  if (typeof value.eventId !== 'string' || value.eventId.length === 0) {
    throw new Error('User event acknowledgement eventId must be non-empty');
  }
  return { type: value.type, eventId: value.eventId };
}
