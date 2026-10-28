/** D1-backed at-least-once delivery inbox for authenticated user events; batch read and ack. */

import type { userEventInbox } from './dbSchema';

type UserEventInboxInsert = typeof userEventInbox.$inferInsert;

/** Upper bound for one batch read; the client pages with `hasMore`. */
export const USER_INBOX_MAX_BATCH = 50;

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

export interface UserInboxBatch {
  readonly events: readonly PendingUserEvent[];
  readonly hasMore: boolean;
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

/** Read the oldest unacknowledged events for one authenticated user, oldest first. */
export async function readUserEvents(
  db: D1Database,
  userId: string,
  limit: number,
): Promise<UserInboxBatch> {
  requireNonEmptyString(userId, 'User event userId');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > USER_INBOX_MAX_BATCH) {
    throw new Error(`User inbox batch limit must be between 1 and ${USER_INBOX_MAX_BATCH}`);
  }
  const { results } = await db
    .prepare(
      `SELECT event_id, event_type, payload_json
      FROM user_event_inbox
      WHERE user_id = ?1
      ORDER BY created_at, event_id
      LIMIT ?2`,
    )
    .bind(userId, limit + 1)
    .all<RawUserEventRow>();
  const hasMore = results.length > limit;
  return {
    events: results.slice(0, limit).map(parsePendingUserEvent),
    hasMore,
  };
}

/** Delete only events owned by the authenticated account; returns how many rows were removed. */
export async function acknowledgeUserEvents(
  db: D1Database,
  userId: string,
  eventIds: readonly string[],
): Promise<number> {
  requireNonEmptyString(userId, 'User event userId');
  if (eventIds.length === 0 || eventIds.length > USER_INBOX_MAX_BATCH) {
    throw new Error(`User inbox ack batch must contain 1 to ${USER_INBOX_MAX_BATCH} event IDs`);
  }
  for (const eventId of eventIds) requireNonEmptyString(eventId, 'User event eventId');
  const placeholders = eventIds.map((_, index) => `?${index + 2}`).join(', ');
  const result = await db
    .prepare(`DELETE FROM user_event_inbox WHERE user_id = ?1 AND event_id IN (${placeholders})`)
    .bind(userId, ...eventIds)
    .run();
  return result.meta.changes;
}
