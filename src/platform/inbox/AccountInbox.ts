/**
 * AccountInbox — trigger-driven consumer of the authenticated user's event inbox.
 *
 * Reads `GET /api/user/events` in batches, hands each batch to `deliver`, then acknowledges it
 * with `POST /api/user/events/ack`. There is no polling: a drain runs only on a trigger —
 * authentication change, the app becoming visible, or a wake from a room link (`live` or an
 * `INBOX_HINT` frame). Triggers during a drain coalesce into exactly one follow-up drain.
 *
 * Boundary constraints:
 * - One instance per app; `start()` once, `stop()` on teardown.
 * - A session change aborts the in-flight drain so events are never delivered to another user.
 * - An undecodable event is `deliver`'s responsibility (dead-letter + still acknowledge).
 */

import { z } from 'zod';

import type { PlatformEnvironment } from '@/platform/env/PlatformEnvironment';
import type { ApiClient } from '@/platform/http/ApiClient';
import type { AuthSession } from '@/services/types/IAuthService';

import type { InboxWakeSignal } from './inboxWake';

const ACCOUNT_INBOX_BATCH_SIZE = 50;

const inboxBatchSchema = z.strictObject({
  events: z.array(z.strictObject({ eventId: z.string().min(1), message: z.unknown() })),
  hasMore: z.boolean(),
});
const inboxAckSchema = z.strictObject({ acknowledged: z.number().int().nonnegative() });

export type AccountInboxEvent = z.infer<typeof inboxBatchSchema>['events'][number];

export interface AccountInboxAuth {
  getAuthSession(): AuthSession | null;
  subscribeAuth(listener: () => void): () => void;
}

export interface AccountInboxDeps {
  readonly api: ApiClient;
  readonly environment: PlatformEnvironment;
  readonly wakes: InboxWakeSignal;
  readonly auth: AccountInboxAuth;
  /** Deliver one batch for `session`; resolves before the batch is acknowledged. */
  readonly deliver: (
    session: AuthSession,
    events: readonly AccountInboxEvent[],
    signal: AbortSignal,
  ) => Promise<void>;
  /** Drain failure after `deliver`/HTTP; the next trigger retries. */
  readonly onError: (error: unknown) => void;
}

export class AccountInbox {
  readonly #deps: AccountInboxDeps;
  #disposers: Array<() => void> = [];
  #controller: AbortController | null = null;
  #drainingFor: AuthSession | null = null;
  #rerunRequested = false;
  #wasVisible: boolean;

  constructor(deps: AccountInboxDeps) {
    this.#deps = deps;
    this.#wasVisible = deps.environment.getSnapshot().visible;
  }

  start(): void {
    if (this.#disposers.length > 0) throw new Error('[FAIL-FAST] AccountInbox already started');
    const { auth, environment, wakes } = this.#deps;
    this.#disposers = [
      auth.subscribeAuth(() => this.#onAuthChanged()),
      environment.subscribe(() => this.#onEnvironment()),
      wakes.subscribe(() => this.drain()),
    ];
    this.drain();
  }

  stop(): void {
    for (const dispose of this.#disposers) dispose();
    this.#disposers = [];
    this.#abort();
  }

  /** Run one drain now (coalesced if one is already running). */
  drain(): void {
    const session = this.#deps.auth.getAuthSession();
    if (session === null || !this.#deps.environment.getSnapshot().visible) return;
    if (this.#drainingFor !== null) {
      this.#rerunRequested = true;
      return;
    }
    const controller = new AbortController();
    this.#controller = controller;
    this.#drainingFor = session;
    void this.#run(session, controller.signal).finally(() => {
      if (this.#controller === controller) this.#controller = null;
      this.#drainingFor = null;
      if (this.#rerunRequested) {
        this.#rerunRequested = false;
        this.drain();
      }
    });
  }

  #onAuthChanged(): void {
    if (this.#drainingFor !== null && this.#drainingFor !== this.#deps.auth.getAuthSession()) {
      this.#abort();
    }
    this.drain();
  }

  #onEnvironment(): void {
    const { visible } = this.#deps.environment.getSnapshot();
    const becameVisible = visible && !this.#wasVisible;
    this.#wasVisible = visible;
    if (becameVisible) this.drain();
  }

  #abort(): void {
    this.#controller?.abort();
    this.#controller = null;
    this.#rerunRequested = false;
  }

  async #run(session: AuthSession, signal: AbortSignal): Promise<void> {
    try {
      let hasMore = true;
      while (hasMore && !signal.aborted) {
        const batch = await this.#deps.api.json({
          method: 'GET',
          path: `/api/user/events?limit=${ACCOUNT_INBOX_BATCH_SIZE}`,
          auth: 'required',
          idempotent: true,
          decode: (value) => inboxBatchSchema.parse(value),
          signal,
        });
        if (batch.events.length === 0) return;
        await this.#deps.deliver(session, batch.events, signal);
        if (signal.aborted) return;
        await this.#deps.api.json({
          method: 'POST',
          path: '/api/user/events/ack',
          auth: 'required',
          idempotent: true,
          body: { eventIds: batch.events.map((event) => event.eventId) },
          decode: (value) => inboxAckSchema.parse(value),
          signal,
        });
        hasMore = batch.hasMore;
      }
    } catch (error) {
      if (signal.aborted) return;
      this.#deps.onError(error);
    }
  }
}
