/** AccountInbox drains only on triggers, acknowledges after delivery, and respects auth changes. */
import { z } from 'zod';

import { AccountInbox, type AccountInboxEvent } from '@/platform/inbox/AccountInbox';
import { createInboxWakeSignal } from '@/platform/inbox/inboxWake';
import type { AuthSession } from '@/services/types/IAuthService';
import {
  createTestApiClient,
  createUnsignedAccessToken,
  jsonResponse,
  requestJson,
} from '@/test-utils/httpClient';
import { createFakeEnvironment } from '@/test-utils/roomLink';

const ackBodySchema = z.strictObject({ eventIds: z.array(z.string()) });

const OWNER: AuthSession = { userId: 'owner', initialUser: null };

function event(eventId: string): AccountInboxEvent {
  return { eventId, message: { type: 'SETTLE_RESULT', eventId } };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

function createHarness(options?: { readonly visible?: boolean }) {
  const env = createFakeEnvironment({ online: true, visible: options?.visible ?? true });
  const wakes = createInboxWakeSignal();
  const { client, tokens, network } = createTestApiClient();
  let session: AuthSession | null = OWNER;
  const authListeners = new Set<() => void>();
  const signIn = (next: AuthSession | null) => {
    session = next;
    if (next !== null) {
      tokens.saveTokens(
        createUnsignedAccessToken(next.userId, Math.floor(Date.now() / 1000) + 3600),
        'r',
      );
    }
    tokens.setSession(next);
    for (const listener of authListeners) listener();
  };
  signIn(OWNER);
  const delivered: Array<{ readonly userId: string; readonly eventIds: readonly string[] }> = [];
  const errors: unknown[] = [];
  let deliverGate: (() => void) | null = null;
  const inbox = new AccountInbox({
    api: client,
    environment: env.environment,
    wakes,
    auth: {
      getAuthSession: () => session,
      subscribeAuth: (listener) => {
        authListeners.add(listener);
        return () => authListeners.delete(listener);
      },
    },
    deliver: async (deliverySession, events) => {
      delivered.push({ userId: deliverySession.userId, eventIds: events.map((e) => e.eventId) });
      if (deliverGate !== null) await new Promise<void>((resolve) => (deliverGate = resolve));
    },
    onError: (error) => errors.push(error),
  });
  const queueBatch = (events: AccountInboxEvent[], hasMore = false) =>
    network.respond(() => jsonResponse(200, { events, hasMore }));
  const queueAck = () =>
    network.respond((request) => {
      const body = ackBodySchema.parse(requestJson(request));
      return jsonResponse(200, { acknowledged: body.eventIds.length });
    });
  return {
    inbox,
    env,
    wakes,
    network,
    delivered,
    errors,
    signIn,
    queueBatch,
    queueAck,
    holdDelivery: () => {
      deliverGate = () => undefined;
    },
    releaseDelivery: () => {
      deliverGate?.();
      deliverGate = null;
    },
  };
}

describe('AccountInbox', () => {
  it('drains on start and acknowledges each batch after delivery until hasMore is false', async () => {
    const h = createHarness();
    h.queueBatch([event('e1'), event('e2')], true);
    h.queueAck();
    h.queueBatch([event('e3')], false);
    h.queueAck();
    h.inbox.start();
    await settle();
    expect(h.delivered).toEqual([
      { userId: 'owner', eventIds: ['e1', 'e2'] },
      { userId: 'owner', eventIds: ['e3'] },
    ]);
    const urls = h.network.requests.map((r) => `${r.method} ${r.url}`);
    expect(urls).toEqual([
      'GET https://api.test/api/user/events?limit=50',
      'POST https://api.test/api/user/events/ack',
      'GET https://api.test/api/user/events?limit=50',
      'POST https://api.test/api/user/events/ack',
    ]);
    expect(requestJson(h.network.requests[1])).toEqual({ eventIds: ['e1', 'e2'] });
    expect(h.errors).toEqual([]);
    h.inbox.stop();
  });

  it('does not read while hidden and drains once the app becomes visible', async () => {
    const h = createHarness({ visible: false });
    h.inbox.start();
    await settle();
    expect(h.network.requests).toHaveLength(0);
    h.queueBatch([], false);
    h.env.set({ visible: true });
    await settle();
    expect(h.network.requests).toHaveLength(1);
    h.inbox.stop();
  });

  it('drains on a room link wake and coalesces wakes that arrive mid-drain', async () => {
    const h = createHarness();
    h.queueBatch([], false);
    h.inbox.start();
    await settle();
    expect(h.network.requests).toHaveLength(1);

    h.holdDelivery();
    h.queueBatch([event('e1')], false);
    h.wakes.emit('live');
    await settle();
    expect(h.delivered).toHaveLength(1);
    h.wakes.emit('hint');
    h.wakes.emit('hint');
    h.queueAck();
    h.queueBatch([], false);
    h.releaseDelivery();
    await settle();
    // One ack for the held batch, then exactly one follow-up read for the two coalesced wakes.
    expect(h.network.requests.map((r) => r.method)).toEqual(['GET', 'GET', 'POST', 'GET']);
    expect(h.errors).toEqual([]);
    h.inbox.stop();
  });

  it('aborts an in-flight drain when the session changes and never acknowledges for the new user', async () => {
    const h = createHarness();
    h.holdDelivery();
    h.queueBatch([event('e1')], false);
    h.inbox.start();
    await settle();
    expect(h.delivered).toEqual([{ userId: 'owner', eventIds: ['e1'] }]);

    h.queueBatch([], false);
    h.signIn({ userId: 'other', initialUser: null });
    h.releaseDelivery();
    await settle();
    expect(h.network.requests.map((r) => r.method)).toEqual(['GET', 'GET']);
    expect(h.errors).toEqual([]);
    h.inbox.stop();
  });

  it('reports a failed read through onError and retries on the next trigger', async () => {
    const h = createHarness();
    h.network.respond(() => jsonResponse(500, { success: false, reason: 'DOWN' }));
    h.inbox.start();
    await settle();
    expect(h.errors).toHaveLength(1);
    h.queueBatch([], false);
    h.wakes.emit('hint');
    await settle();
    expect(h.network.requests).toHaveLength(2);
    h.inbox.stop();
  });
});
