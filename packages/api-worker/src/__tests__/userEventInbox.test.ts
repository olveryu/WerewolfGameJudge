/** Durable user-event inbox idempotency, ownership, and acknowledgement contracts. */

import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  acknowledgeUserEvent,
  enqueueUserEvent,
  readNextUserEvent,
} from '../platform/userEvents/inbox';
import { bootstrapTestSchema } from './testSchemaBootstrap';

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

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

    expect(await readNextUserEvent(env.DB, 'event-user-1')).toEqual({
      eventId: 'event-1',
      message,
    });
    await expect(
      enqueueUserEvent(env.DB, {
        ...input,
        message: { ...message, settlementId: 'changed' },
      }),
    ).rejects.toThrow('User event event-1 changed across enqueue attempts');
  });

  it('acknowledges only the event owned by that authenticated user', async () => {
    await enqueueUserEvent(env.DB, {
      userId: 'event-user-1',
      eventId: 'event-1',
      message,
    });

    await expect(acknowledgeUserEvent(env.DB, 'event-user-2', 'event-1')).resolves.toBe(false);
    expect(await readNextUserEvent(env.DB, 'event-user-1')).not.toBeNull();

    await expect(acknowledgeUserEvent(env.DB, 'event-user-1', 'event-1')).resolves.toBe(true);
    expect(await readNextUserEvent(env.DB, 'event-user-1')).toBeNull();
  });
});
