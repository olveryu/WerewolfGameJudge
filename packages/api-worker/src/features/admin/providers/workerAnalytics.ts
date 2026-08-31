/** Cloudflare GraphQL adapter for platform-level Worker invocation totals. */

import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { Env } from '../../../env';
import { createLogger } from '../../../platform/observability/logger';

const log = createLogger('admin-worker-analytics');

const invocationRowSchema = z.strictObject({
  sum: z.strictObject({
    requests: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
    subrequests: z.number().int().nonnegative(),
  }),
});

const graphqlEnvelopeSchema = z.object({
  data: z.object({
    viewer: z.object({
      accounts: z.array(
        z.object({
          workersInvocationsAdaptive: z.array(invocationRowSchema),
        }),
      ),
    }),
  }),
  errors: z
    .array(z.object({ message: z.string() }))
    .nullable()
    .optional(),
});

export interface WorkerInvocationAnalytics {
  readonly requests: number;
  readonly errors: number;
  readonly subrequests: number;
}

const WORKER_INVOCATIONS_QUERY = `
  query WorkerInvocations(
    $accountTag: string!
    $scriptName: string!
    $datetimeStart: string!
    $datetimeEnd: string!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        workersInvocationsAdaptive(
          limit: 100
          filter: {
            scriptName: $scriptName
            datetime_geq: $datetimeStart
            datetime_lt: $datetimeEnd
          }
        ) {
          sum {
            requests
            errors
            subrequests
          }
        }
      }
    }
  }
`;

/** Query Cloudflare's platform invocation estimate for the configured Worker script. */
export async function queryWorkerInvocationAnalytics(
  env: Env,
  datetimeStart: string,
  datetimeEnd: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WorkerInvocationAnalytics> {
  let response: Response;
  try {
    response = await fetchImpl('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: WORKER_INVOCATIONS_QUERY,
        variables: {
          accountTag: env.CLOUDFLARE_ACCOUNT_ID,
          scriptName: env.CLOUDFLARE_WORKER_SCRIPT_NAME,
          datetimeStart,
          datetimeEnd,
        },
      }),
    });
  } catch (error: unknown) {
    log.error('Workers Analytics transport failed', { error });
    throw new HTTPException(502, { message: 'WORKER_ANALYTICS_QUERY_FAILED' });
  }

  if (!response.ok) {
    const detail = await response.text();
    log.error('Workers Analytics query failed', { status: response.status, detail });
    throw new HTTPException(502, { message: 'WORKER_ANALYTICS_QUERY_FAILED' });
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error: unknown) {
    log.error('Workers Analytics returned invalid JSON', { error });
    throw new HTTPException(502, { message: 'WORKER_ANALYTICS_QUERY_FAILED' });
  }

  const parsed = graphqlEnvelopeSchema.safeParse(responseBody);
  if (!parsed.success || (parsed.data.errors?.length ?? 0) > 0) {
    log.error('Workers Analytics response validation failed', {
      issues: parsed.success ? parsed.data.errors : parsed.error.issues,
    });
    throw new HTTPException(502, { message: 'WORKER_ANALYTICS_QUERY_FAILED' });
  }

  const account = parsed.data.data.viewer.accounts[0];
  if (account === undefined) {
    log.error('Workers Analytics response omitted the configured account');
    throw new HTTPException(502, { message: 'WORKER_ANALYTICS_QUERY_FAILED' });
  }

  return account.workersInvocationsAdaptive.reduce<WorkerInvocationAnalytics>(
    (total, row) => ({
      requests: total.requests + row.sum.requests,
      errors: total.errors + row.sum.errors,
      subrequests: total.subrequests + row.sum.subrequests,
    }),
    { requests: 0, errors: 0, subrequests: 0 },
  );
}
