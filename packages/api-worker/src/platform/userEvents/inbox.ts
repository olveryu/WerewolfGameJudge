/** D1-backed at-least-once delivery inbox for authenticated user events. */

import type { userEventInbox } from './dbSchema';

type UserEventInboxInsert = typeof userEventInbox.$inferInsert;

interface RawUserEventRow {
  readonly event_id: unknown;
  readonly event_type: unknown;
  readonly payload_json: unknown;
}

export interface PublishUserEvent {
  readonly userId: string;
  readonly eventId: string;
  readonly message: object;
}

export interface PendingUserEvent {
  readonly eventId: string;
  readonly message: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function serializeMessage(input: PublishUserEvent): {
  readonly eventType: string;
  readonly payloadJson: string;
} {
  if (!isRecord(input.message)) throw new Error('User event message must be an object');
  if (input.message.eventId !== input.eventId) {
    throw new Error(`User event ${input.eventId} payload has a mismatched eventId`);
  }
  const eventType = requireNonEmptyString(input.message.type, 'User event type');
  const payloadJson = JSON.stringify(input.message);
  return { eventType, payloadJson };
}

function parsePendingUserEvent(row: RawUserEventRow): PendingUserEvent {
  const eventId = requireNonEmptyString(row.event_id, 'user_event_inbox.event_id');
  const eventType = requireNonEmptyString(row.event_type, 'user_event_inbox.event_type');
  const payloadJson = requireNonEmptyString(row.payload_json, 'user_event_inbox.payload_json');
  const message: unknown = JSON.parse(payloadJson);
  if (!isRecord(message)) {
    throw new Error(`User event ${eventId} payload must be an object`);
  }
  if (message.eventId !== eventId || message.type !== eventType) {
    throw new Error(`User event ${eventId} identity does not match its payload`);
  }
  return { eventId, message };
}

/** Insert once and verify that an existing event has the exact same identity and payload. */
export async function enqueueUserEvent(db: D1Database, input: PublishUserEvent): Promise<void> {
  requireNonEmptyString(input.userId, 'User event userId');
  requireNonEmptyString(input.eventId, 'User event eventId');
  const { eventType, payloadJson } = serializeMessage(input);
  const event: UserEventInboxInsert = {
    userId: input.userId,
    eventId: input.eventId,
    eventType,
    payloadJson,
    createdAt: new Date().toISOString(),
  };
  await db
    .prepare(
      `INSERT INTO user_event_inbox (
        user_id,
        event_id,
        event_type,
        payload_json,
        created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT (user_id, event_id) DO NOTHING`,
    )
    .bind(event.userId, event.eventId, event.eventType, event.payloadJson, event.createdAt)
    .run();

  const stored = await db
    .prepare(
      `SELECT event_id, event_type, payload_json
      FROM user_event_inbox
      WHERE user_id = ?1 AND event_id = ?2`,
    )
    .bind(input.userId, input.eventId)
    .first<RawUserEventRow>();
  if (stored === null) throw new Error(`User event ${input.eventId} was not persisted`);
  if (stored.event_type !== eventType || stored.payload_json !== payloadJson) {
    throw new Error(`User event ${input.eventId} changed across enqueue attempts`);
  }
}

/** Read the oldest unacknowledged event for one authenticated user. */
export async function readNextUserEvent(
  db: D1Database,
  userId: string,
): Promise<PendingUserEvent | null> {
  requireNonEmptyString(userId, 'User event userId');
  const row = await db
    .prepare(
      `SELECT event_id, event_type, payload_json
      FROM user_event_inbox
      WHERE user_id = ?1
      ORDER BY created_at, event_id
      LIMIT 1`,
    )
    .bind(userId)
    .first<RawUserEventRow>();
  return row === null ? null : parsePendingUserEvent(row);
}

/** Delete only an event owned by the authenticated socket user. */
export async function acknowledgeUserEvent(
  db: D1Database,
  userId: string,
  eventId: string,
): Promise<boolean> {
  requireNonEmptyString(userId, 'User event userId');
  requireNonEmptyString(eventId, 'User event eventId');
  const result = await db
    .prepare('DELETE FROM user_event_inbox WHERE user_id = ?1 AND event_id = ?2')
    .bind(userId, eventId)
    .run();
  return result.meta.changes === 1;
}
