/** Account inbox HTTP ownership and replay integration tests. */
import { env, SELF } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';

import { clearUploadTestState, createAnonymousSession } from '../../../../test/uploadTestSupport';
import { enqueueUserEvent } from '../../../platform/userEvents/inbox';

beforeEach(async () => {
  await env.DB.exec('DELETE FROM user_event_inbox');
  await clearUploadTestState();
});

it('replays without a room and only lets the authenticated owner acknowledge', async () => {
  const owner = await createAnonymousSession();
  const other = await createAnonymousSession();
  const headers = { Authorization: `Bearer ${owner.access_token}` };
  const message = { type: 'SETTLE_RESULT', eventId: 'account-event' };
  await enqueueUserEvent(env.DB, { userId: owner.user.id, eventId: message.eventId, message });
  const read = () => SELF.fetch('https://test.local/api/user/events/next', { headers });
  const first = await read();
  expect(first.status).toBe(200);
  expect(first.headers.get('Cache-Control')).toBe('no-store');
  expect(await first.json()).toEqual({ event: { eventId: message.eventId, message } });
  expect(await (await read()).json()).toEqual({ event: { eventId: message.eventId, message } });
  const acknowledge = (accessToken: string) =>
    SELF.fetch(`https://test.local/api/user/events/${message.eventId}/ack`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  expect((await acknowledge(other.access_token)).status).toBe(200);
  expect(await (await read()).json()).toEqual({ event: { eventId: message.eventId, message } });
  expect((await acknowledge(owner.access_token)).status).toBe(200);
  expect((await acknowledge(owner.access_token)).status).toBe(200);
  expect(await (await read()).json()).toEqual({ event: null });
  expect((await SELF.fetch('https://test.local/api/user/events/next')).status).toBe(401);
});
