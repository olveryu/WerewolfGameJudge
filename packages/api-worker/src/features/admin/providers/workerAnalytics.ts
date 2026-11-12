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
  const responseBody = await fetchAnalyticsGraphql(
    env,
    WORKER_INVOCATIONS_QUERY,
    {
      accountTag: env.CLOUDFLARE_ACCOUNT_ID,
      scriptName: env.CLOUDFLARE_WORKER_SCRIPT_NAME,
      datetimeStart,
      datetimeEnd,
    },
    fetchImpl,
  );
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

async function fetchAnalyticsGraphql(
  env: Env,
  query: string,
  variables: Record<string, string>,
  fetchImpl: typeof fetch,
  failureReason = 'WORKER_ANALYTICS_QUERY_FAILED',
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });
  } catch (error: unknown) {
    log.error('Cloudflare Analytics transport failed', { error });
    throw new HTTPException(502, { message: failureReason });
  }

  if (!response.ok) {
    const detail = await response.text();
    log.error('Cloudflare Analytics query failed', { status: response.status, detail });
    throw new HTTPException(502, { message: failureReason });
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error: unknown) {
    log.error('Cloudflare Analytics returned invalid JSON', { error });
    throw new HTTPException(502, { message: failureReason });
  }

  return responseBody;
}

const d1EnvelopeSchema = z.object({
  data: z.object({
    viewer: z.object({
      accounts: z.array(
        z.object({
          d1AnalyticsAdaptiveGroups: z.array(
            z.object({
              sum: z.object({
                rowsRead: z.number().int().nonnegative(),
                rowsWritten: z.number().int().nonnegative(),
              }),
            }),
          ),
        }),
      ),
    }),
  }),
  errors: z
    .array(z.object({ message: z.string() }))
    .nullable()
    .optional(),
});

/** Read today's account-wide D1 usage from analytics, without touching D1 itself. */
export async function queryD1UsageAnalytics(
  env: Env,
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
) {
  const day = now.toISOString().slice(0, 10);
  const responseBody = await fetchAnalyticsGraphql(
    env,
    `
    query D1Usage($accountTag: string!, $day: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          d1AnalyticsAdaptiveGroups(limit: 1, filter: { date_geq: $day, date_leq: $day }) {
            sum { rowsRead rowsWritten }
          }
        }
      }
    }
  `,
    { accountTag: env.CLOUDFLARE_ACCOUNT_ID, day },
    fetchImpl,
    'D1_ANALYTICS_QUERY_FAILED',
  );
  const parsed = d1EnvelopeSchema.safeParse(responseBody);
  if (!parsed.success || (parsed.data.errors?.length ?? 0) > 0) {
    log.error('D1 Analytics response validation failed', {
      issues: parsed.success ? parsed.data.errors : parsed.error.issues,
    });
    throw new HTTPException(502, { message: 'D1_ANALYTICS_QUERY_FAILED' });
  }

  const account = parsed.data.data.viewer.accounts[0];
  if (account === undefined) {
    log.error('D1 Analytics response omitted the configured account');
    throw new HTTPException(502, { message: 'D1_ANALYTICS_QUERY_FAILED' });
  }

  const usage = account.d1AnalyticsAdaptiveGroups.reduce(
    (total, row) => ({
      rowsRead: total.rowsRead + row.sum.rowsRead,
      rowsWritten: total.rowsWritten + row.sum.rowsWritten,
    }),
    { rowsRead: 0, rowsWritten: 0 },
  );
  return {
    day,
    ...usage,
    rowsReadLimit: 5_000_000,
    rowsWrittenLimit: 100_000,
    generatedAt: now.toISOString(),
  };
}
