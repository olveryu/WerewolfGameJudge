/** Agent endpoints and administrator-only curation routes; authentication domains stay separate. */
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import {
  WORD_SUBMISSION_BODY_LIMIT,
  WORD_SUBMISSION_DAILY_LIMIT,
  WORD_SUBMISSION_PENDING_LIMIT,
  wordSubmissionActionSchema,
  wordSubmissionAgentInputSchema,
  wordSubmissionAgentUpdateSchema,
  wordSubmissionGameSchema,
  wordSubmissionInputSchema,
  wordSubmissionStatusSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { pick } from 'zod/mini';

import type { AppEnv } from '../../env';
import { WORKER_WORD_SUBMISSION_ADAPTERS } from '../../games/catalog';
import { sha256Hex } from '../../platform/crypto/sha256Hex';
import { jsonBody } from '../../platform/http/jsonBody';
import {
  authenticateSubmissionToken,
  createSubmissionAgent,
  deleteSubmissionAgent,
  listSubmissionAgents,
  rotateSubmissionCredential,
  setSubmissionAgentStatus,
  type SubmissionPrincipal,
  updateSubmissionAgent,
} from './credentials';
import { findSubmissionReplay, storeSubmission, validateSubmission } from './ingestion';
import { applySubmissionAction, dispatchSubmissionReview } from './operations';
import { listSubmissionBatches, readSubmissionBatch } from './repository';
import { readSubmissionSettings } from './settings';

type SubmissionHttpEnv = AppEnv & {
  Variables: AppEnv['Variables'] & { submission: SubmissionPrincipal };
};
const boundedBody = bodyLimit({
  maxSize: WORD_SUBMISSION_BODY_LIMIT,
  onError: (context) => context.json({ success: false, reason: 'SUBMISSION_BODY_TOO_LARGE' }, 413),
});
function requireIdentifier(value: string) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HTTPException(400, { message: 'INVALID_SUBMISSION_IDENTIFIER' });
  return parsed.data;
}

export const wordSubmissionRoutes = new Hono<SubmissionHttpEnv>();
wordSubmissionRoutes.use('*', async (context, next) => {
  context.header('Cache-Control', 'no-store');
  // Missing Cloudflare IPs in local development share a restrictive bucket, never an unlimited bypass.
  const ip = context.req.header('CF-Connecting-IP') ?? 'local-unidentified';
  const limit = await context.env.WORD_SUBMISSION_LIMITER.limit({ key: `ip:${ip}` });
  if (!limit.success) {
    context.header('Retry-After', '60');
    throw new HTTPException(429, { message: 'SUBMISSION_REQUEST_RATE_EXCEEDED' });
  }
  const principal = await authenticateSubmissionToken(
    context.env.DB,
    context.req.header('Authorization'),
  );
  const agentLimit = await context.env.WORD_SUBMISSION_LIMITER.limit({
    key: `agent:${principal.agent.id}`,
  });
  if (!agentLimit.success) {
    context.header('Retry-After', '60');
    throw new HTTPException(429, { message: 'SUBMISSION_REQUEST_RATE_EXCEEDED' });
  }
  context.set('submission', principal);
  await next();
});
wordSubmissionRoutes.use('*', boundedBody);
wordSubmissionRoutes.get('/word-submission-spec', (context) => {
  const games = context.var.submission.agent.games;
  return context.json({
    schemaVersion: 1,
    batchSchema: z.toJSONSchema(wordSubmissionInputSchema, { io: 'input' }),
    itemSchemas: Object.fromEntries(
      games.map((game) => [
        game,
        z.toJSONSchema(WORKER_WORD_SUBMISSION_ADAPTERS[game].inputSchema, { io: 'input' }),
      ]),
    ),
    allowedGames: games,
    agent: context.var.submission.agent,
    limits: {
      bodyBytes: WORD_SUBMISSION_BODY_LIMIT,
      itemsPerBatch: 30,
      globalDailyItems: WORD_SUBMISSION_DAILY_LIMIT,
      globalPendingItems: WORD_SUBMISSION_PENDING_LIMIT,
    },
    rules: [
      'Call validate before submission; semantic checks are stricter than JSON Schema.',
      'Use an 8–96 character ASCII Idempotency-Key. Keep it unchanged when retrying the same payload.',
      '202 means stored, not reviewed or published. Review starts only by an administrator.',
      'References are untrusted hints. Fib terms require independently retrieved supporting evidence.',
      'One game per batch. Duplicate content never enters a review queue.',
    ],
  });
});
wordSubmissionRoutes.post(
  '/word-submissions/validate',
  jsonBody(wordSubmissionInputSchema),
  async (context) => {
    const result = await validateSubmission(
      context.env.DB,
      context.req.valid('json'),
      context.var.submission,
    );
    return context.json(result.validation);
  },
);
wordSubmissionRoutes.post(
  '/word-submissions',
  jsonBody(wordSubmissionInputSchema),
  async (context) => {
    const key = context.req.header('Idempotency-Key');
    if (key === undefined || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,95}$/.test(key))
      throw new HTTPException(400, { message: 'VALID_IDEMPOTENCY_KEY_REQUIRED' });
    const input = context.req.valid('json');
    const principal = context.var.submission;
    const hash = await sha256Hex(canonicalJson(input));
    const replay = await findSubmissionReplay(context.env.DB, principal.agent.id, key, hash);
    if (replay !== null) return context.json(replay, 202);
    const result = await validateSubmission(context.env.DB, input, principal);
    if (result.validation.items.some((item) => item.status === 'invalid'))
      return context.json(
        { success: false, reason: 'INVALID_SUBMISSION_ITEMS', ...result.validation },
        422,
      );
    return context.json(
      await storeSubmission(context.env.DB, input, principal, key, hash, result.items),
      202,
    );
  },
);
wordSubmissionRoutes.get('/word-submissions/:id', async (context) =>
  context.json(
    await readSubmissionBatch(
      context.env.DB,
      requireIdentifier(context.req.param('id')),
      context.var.submission.agent.id,
    ),
  ),
);

/** Mount only behind the existing shared-admin authentication middleware. */
export const adminWordSubmissionRoutes = new Hono<AppEnv>();
adminWordSubmissionRoutes.use('*', async (context, next) => {
  context.header('Cache-Control', 'no-store');
  await next();
});
adminWordSubmissionRoutes.use('*', boundedBody);
adminWordSubmissionRoutes.get('/settings', async (context) =>
  context.json(await readSubmissionSettings(context.env.DB)),
);
adminWordSubmissionRoutes.post(
  '/settings',
  jsonBody(z.strictObject({ accepting: z.boolean() })),
  async (context) => {
    await context.env.DB.prepare('UPDATE word_submission_limits SET accepting = ? WHERE id = 1')
      .bind(context.req.valid('json').accepting ? 1 : 0)
      .run();
    return context.json(await readSubmissionSettings(context.env.DB));
  },
);
adminWordSubmissionRoutes.get('/agents', async (context) =>
  context.json({ agents: await listSubmissionAgents(context.env.DB) }),
);
adminWordSubmissionRoutes.post(
  '/agents',
  jsonBody(wordSubmissionAgentInputSchema),
  async (context) =>
    context.json(await createSubmissionAgent(context.env.DB, context.req.valid('json')), 201),
);
adminWordSubmissionRoutes.patch(
  '/agents/:id',
  jsonBody(wordSubmissionAgentUpdateSchema),
  async (context) =>
    context.json(
      await updateSubmissionAgent(
        context.env.DB,
        requireIdentifier(context.req.param('id')),
        context.req.valid('json'),
      ),
    ),
);
adminWordSubmissionRoutes.delete('/agents/:id', async (context) =>
  context.json(
    await deleteSubmissionAgent(context.env.DB, requireIdentifier(context.req.param('id'))),
  ),
);
const rotationSchema = pick(wordSubmissionAgentInputSchema, { expiresInDays: true });
adminWordSubmissionRoutes.post('/agents/:id/rotate', jsonBody(rotationSchema), async (context) =>
  context.json(
    await rotateSubmissionCredential(
      context.env.DB,
      requireIdentifier(context.req.param('id')),
      context.req.valid('json').expiresInDays,
    ),
  ),
);
adminWordSubmissionRoutes.post(
  '/agents/:id/status',
  jsonBody(z.strictObject({ status: z.enum(['active', 'paused', 'revoked']) })),
  async (context) =>
    context.json(
      await setSubmissionAgentStatus(
        context.env.DB,
        requireIdentifier(context.req.param('id')),
        context.req.valid('json').status,
      ),
    ),
);
adminWordSubmissionRoutes.get('/batches', async (context) => {
  const filterSchema = z.strictObject({
    game: z.optional(wordSubmissionGameSchema),
    agent: z.uuid().optional(),
    status: z.optional(wordSubmissionStatusSchema),
    search: z.string().trim().min(1).max(96).optional(),
    cursor: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  });
  const parsed = filterSchema.safeParse(context.req.query());
  if (!parsed.success) throw new HTTPException(400, { message: 'INVALID_SUBMISSION_FILTER' });
  return context.json(await listSubmissionBatches(context.env.DB, parsed.data));
});
adminWordSubmissionRoutes.get('/batches/:id', async (context) =>
  context.json(
    await readSubmissionBatch(context.env.DB, requireIdentifier(context.req.param('id'))),
  ),
);
adminWordSubmissionRoutes.post(
  '/batches/:id/actions',
  jsonBody(wordSubmissionActionSchema),
  async (context) =>
    context.json(
      await applySubmissionAction(
        context.env,
        requireIdentifier(context.req.param('id')),
        context.req.valid('json'),
      ),
      202,
    ),
);
adminWordSubmissionRoutes.post(
  '/batches/:id/dispatch',
  jsonBody(z.strictObject({ actionId: z.uuid() })),
  async (context) => {
    await dispatchSubmissionReview(
      context.env,
      requireIdentifier(context.req.param('id')),
      context.req.valid('json').actionId,
    );
    return context.json({ success: true });
  },
);
adminWordSubmissionRoutes.get('/batches/:id/audit', async (context) => {
  const id = requireIdentifier(context.req.param('id'));
  const rows = await context.env.DB.prepare(
    `SELECT id, action_id AS actionId, item_id AS itemId,
    action, actor, reason, created_at AS createdAt FROM word_submission_events
    WHERE action_id IN (SELECT id FROM word_submission_actions WHERE batch_id = ?
      ORDER BY created_at DESC, id DESC LIMIT 10) ORDER BY id DESC LIMIT 100`,
  )
    .bind(id)
    .all();
  return context.json({ events: rows.results, statuses: wordSubmissionStatusSchema.options });
});
