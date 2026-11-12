import * as Sentry from '@sentry/cloudflare';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { createSentryOptions } from '../sentryOptions';

describe('Sentry v11 compatibility', () => {
  it.each([false, true])(
    'preserves request collection and repeated errors with user collection %s',
    async (collectUserInfo) => {
      const events: Sentry.Event[] = [];
      const envelopeTypes: string[] = [];
      const options = createSentryOptions(
        { SENTRY_DSN: 'https://test@example.com/1', ENVIRONMENT: 'test' },
        collectUserInfo,
      );
      const handler = Sentry.withSentry(
        () => ({
          ...options,
          beforeSend(event) {
            events.push(event);
            return event;
          },
          transport: () => ({
            send: async (envelope) => {
              for (const [headers] of envelope[1]) {
                envelopeTypes.push(headers.type);
              }
              return { statusCode: 200 };
            },
            flush: async () => true,
          }),
        }),
        {
          async fetch(request: Request, _env: Record<string, never>, _ctx: ExecutionContext) {
            await request.text();
            Sentry.startNewTrace(() => {
              Sentry.startSpan({ name: 'compatibility request', op: 'test' }, () => {
                Sentry.captureException(new Error('repeated request failure'));
              });
            });
            return new Response('ok');
          },
        },
      );

      for (let invocation = 0; invocation < 2; invocation++) {
        const context = createExecutionContext();
        await handler.fetch(
          new Request('https://worker.test/collect?ordinary=value', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CF-Connecting-IP': '192.0.2.1',
              Cookie: 'session=test-cookie',
            },
            body: JSON.stringify({ message: 'private request body' }),
          }),
          {},
          context,
        );
        await waitOnExecutionContext(context);
      }

      expect(events).toHaveLength(2);
      expect(envelopeTypes).toContain('transaction');
      expect(envelopeTypes).not.toContain('span');
      for (const event of events) {
        expect(event.request?.cookies).toBeUndefined();
        expect(event.request?.data).toBeUndefined();
        if (collectUserInfo) {
          expect(event.user?.ip_address).toBe('192.0.2.1');
        } else {
          expect(event.user?.ip_address).toBeUndefined();
          expect(event.request?.headers?.['cf-connecting-ip']).toBeUndefined();
        }
      }
    },
  );
});
