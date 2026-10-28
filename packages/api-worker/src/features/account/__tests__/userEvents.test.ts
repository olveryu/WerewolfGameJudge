/** Account inbox HTTP ownership and replay integration tests. */
import { env, SELF } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';

import { clearUploadTestState, createAnonymousSession } from '../../../../test/uploadTestSupport';
import { enqueueUserEvent } from '../../../platform/userInbox/inbox';

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
  const read = () => SELF.fetch('https://test.local/api/user/events?limit=10', { headers });
  const first = await read();
  expect(first.status).toBe(200);
  expect(first.headers.get('Cache-Control')).toBe('no-store');
  const pending = { events: [{ eventId: message.eventId, message }], hasMore: false };
  expect(await first.json()).toEqual(pending);
  expect(await (await read()).json()).toEqual(pending);
  const acknowledge = (accessToken: string) =>
    SELF.fetch('https://test.local/api/user/events/ack', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds: [message.eventId] }),
    });
  const otherAck = await acknowledge(other.access_token);
  expect(otherAck.status).toBe(200);
  expect(await otherAck.json()).toEqual({ acknowledged: 0 });
  expect(await (await read()).json()).toEqual(pending);
  const ownerAck = await acknowledge(owner.access_token);
  expect(await ownerAck.json()).toEqual({ acknowledged: 1 });
  expect(await (await acknowledge(owner.access_token)).json()).toEqual({ acknowledged: 0 });
  expect(await (await read()).json()).toEqual({ events: [], hasMore: false });
  expect((await SELF.fetch('https://test.local/api/user/events')).status).toBe(401);
  expect((await SELF.fetch('https://test.local/api/user/events?limit=0', { headers })).status).toBe(
    400,
  );
});

it('rejects anonymous guest accounts on GET /api/user/stats', async () => {
  const guest = await createAnonymousSession();
  const res = await SELF.fetch('https://test.local/api/user/stats', {
    headers: { Authorization: `Bearer ${guest.access_token}` },
  });
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ success: false, reason: 'ANONYMOUS_NOT_SUPPORTED' });
});
