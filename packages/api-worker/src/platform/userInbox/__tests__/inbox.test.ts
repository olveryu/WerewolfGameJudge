/** Durable user-event inbox idempotency, ownership, and acknowledgement contracts. */

import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { acknowledgeUserEvents, enqueueUserEvent, readUserEvents } from '../inbox';
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM user_event_inbox').run();
  await env.DB.prepare("DELETE FROM users WHERE id IN ('event-user-1', 'event-user-2')").run();
  await env.DB.prepare("INSERT INTO users (id) VALUES ('event-user-1'), ('event-user-2')").run();
});

describe('user event inbox', () => {
  const message = {
    type: 'SETTLE_RESULT',
    eventId: 'event-1',
    settlementId: 'settlement-1',
  };

  it('enqueues an exact event idempotently and rejects changed payload', async () => {
    const input = { userId: 'event-user-1', eventId: 'event-1', message };

    await enqueueUserEvent(env.DB, input);
    await enqueueUserEvent(env.DB, input);

    expect(await readUserEvents(env.DB, 'event-user-1', 10)).toEqual({
      events: [{ eventId: 'event-1', message }],
      hasMore: false,
    });
    await expect(
      enqueueUserEvent(env.DB, {
        ...input,
        message: { ...message, settlementId: 'changed' },
      }),
    ).rejects.toThrow('User event event-1 changed across enqueue attempts');
  });

  it('pages oldest-first and reports whether more rows remain', async () => {
    for (const index of [3, 1, 2]) {
      await env.DB.prepare(
        `INSERT INTO user_event_inbox (user_id, event_id, event_type, payload_json, created_at)
         VALUES ('event-user-1', ?1, 'SETTLE_RESULT', ?2, ?3)`,
      )
        .bind(
          `event-${index}`,
          JSON.stringify({ type: 'SETTLE_RESULT', eventId: `event-${index}` }),
          `2026-10-28T00:00:0${index}.000Z`,
        )
        .run();
    }

    const firstPage = await readUserEvents(env.DB, 'event-user-1', 2);
    expect(firstPage.events.map((event) => event.eventId)).toEqual(['event-1', 'event-2']);
    expect(firstPage.hasMore).toBe(true);
    expect(await acknowledgeUserEvents(env.DB, 'event-user-1', ['event-1', 'event-2'])).toBe(2);
    expect(await readUserEvents(env.DB, 'event-user-1', 2)).toEqual({
      events: [{ eventId: 'event-3', message: { type: 'SETTLE_RESULT', eventId: 'event-3' } }],
      hasMore: false,
    });
  });

  it('acknowledges only events owned by that authenticated user', async () => {
    await enqueueUserEvent(env.DB, { userId: 'event-user-1', eventId: 'event-1', message });

    expect(await acknowledgeUserEvents(env.DB, 'event-user-2', ['event-1'])).toBe(0);
    expect((await readUserEvents(env.DB, 'event-user-1', 10)).events).toHaveLength(1);

    expect(await acknowledgeUserEvents(env.DB, 'event-user-1', ['event-1', 'unknown'])).toBe(1);
    expect((await readUserEvents(env.DB, 'event-user-1', 10)).events).toHaveLength(0);
  });

  it('rejects out-of-range batch sizes', async () => {
    await expect(readUserEvents(env.DB, 'event-user-1', 0)).rejects.toThrow('between 1 and');
    await expect(acknowledgeUserEvents(env.DB, 'event-user-1', [])).rejects.toThrow('1 to');
  });
});
