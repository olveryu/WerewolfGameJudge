/** Versioned external-submission and administrator contracts; submissions never imply publication. */
import * as z from 'zod/mini';

import { GAME_WORD_GAMES } from './games';

export const WORD_SUBMISSION_SCHEMA_VERSION = 1;
export const WORD_SUBMISSION_ITEM_LIMIT = 30;
export const WORD_SUBMISSION_BODY_LIMIT = 128 * 1024;
export const WORD_SUBMISSION_PENDING_LIMIT = 5000;
export const WORD_SUBMISSION_DAILY_LIMIT = 1000;

const identifier = z.string().check(z.regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/));
export const wordSubmissionGameSchema = z.enum(GAME_WORD_GAMES);
export const wordSubmissionStatusSchema = z.enum([
  'pending',
  'reviewing',
  'passed',
  'rejected',
  'failed',
  'published',
  'dismissed',
  'unpublished',
  'duplicate',
]);
export const wordSubmissionInputSchema = z.strictObject({
  schemaVersion: z.literal(WORD_SUBMISSION_SCHEMA_VERSION),
  game: wordSubmissionGameSchema,
  items: z
    .array(z.strictObject({ clientItemId: identifier, content: z.record(z.string(), z.unknown()) }))
    .check(
      z.minLength(1),
      z.maxLength(WORD_SUBMISSION_ITEM_LIMIT),
      z.refine(
        (items) => new Set(items.map((item) => item.clientItemId)).size === items.length,
        'clientItemId must be unique within a batch',
      ),
    ),
});
export type WordSubmissionInput = z.output<typeof wordSubmissionInputSchema>;

export const wordSubmissionAgentInputSchema = z.strictObject({
  name: z.string().check(z.trim(), z.minLength(1), z.maxLength(80)),
  description: z.string().check(z.trim(), z.maxLength(300)),
  games: z
    .array(wordSubmissionGameSchema)
    .check(z.minLength(1), z.maxLength(GAME_WORD_GAMES.length)),
  dailyQuota: z.int().check(z.minimum(1), z.maximum(1000)),
  pendingQuota: z.int().check(z.minimum(1), z.maximum(1000)),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]),
});
export type WordSubmissionAgentInput = z.output<typeof wordSubmissionAgentInputSchema>;
export const wordSubmissionAgentSchema = z.extend(
  z.omit(wordSubmissionAgentInputSchema, { expiresInDays: true }),
  {
    id: z.uuid(),
    status: z.enum(['active', 'paused', 'revoked']),
    pending: z.int().check(z.nonnegative()),
    submittedToday: z.int().check(z.nonnegative()),
    createdAt: z.iso.datetime(),
    credential: z.nullable(
      z.strictObject({
        id: z.uuid(),
        prefix: z.string(),
        expiresAt: z.iso.datetime(),
        revokedAt: z.nullable(z.iso.datetime()),
      }),
    ),
  },
);
export type WordSubmissionAgent = z.output<typeof wordSubmissionAgentSchema>;
export const wordSubmissionIssuedCredentialSchema = z.strictObject({
  agent: wordSubmissionAgentSchema,
  token: z.string(),
});

export const wordSubmissionReviewSchema = z.strictObject({
  passed: z.boolean(),
  canOverride: z.boolean(),
  reason: z.string(),
  checks: z.record(z.string(), z.boolean()),
  details: z.record(z.string(), z.unknown()),
});
export type WordSubmissionReview = z.output<typeof wordSubmissionReviewSchema>;
export const wordSubmissionItemSchema = z.strictObject({
  id: z.uuid(),
  clientItemId: identifier,
  identity: z.string(),
  contentHash: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
  title: z.string(),
  category: z.string(),
  content: z.record(z.string(), z.unknown()),
  status: wordSubmissionStatusSchema,
  duplicateOf: z.nullable(z.string()),
  reviewId: z.nullable(z.uuid()),
  reviewVersion: z.nullable(z.string()),
  reviewModel: z.nullable(z.string()),
  review: z.nullable(wordSubmissionReviewSchema),
  failure: z.nullable(z.string()),
  approvalReason: z.nullable(z.string()),
  revision: z.int().check(z.nonnegative()),
});
export type WordSubmissionItem = z.output<typeof wordSubmissionItemSchema>;
export const wordSubmissionBatchHeaderSchema = z.strictObject({
  id: z.uuid(),
  game: wordSubmissionGameSchema,
  agentId: z.uuid(),
  agentName: z.string(),
  createdAt: z.iso.datetime(),
});
export const wordSubmissionBatchSchema = z.extend(wordSubmissionBatchHeaderSchema, {
  items: z.array(wordSubmissionItemSchema).check(z.maxLength(WORD_SUBMISSION_ITEM_LIMIT)),
});
export type WordSubmissionBatch = z.output<typeof wordSubmissionBatchSchema>;

export const wordSubmissionValidationSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      clientItemId: identifier,
      status: z.enum(['valid', 'duplicate', 'invalid']),
      reason: z.nullable(z.string()),
    }),
  ),
});
export type WordSubmissionValidation = z.output<typeof wordSubmissionValidationSchema>;

export const wordSubmissionActionSchema = z.strictObject({
  id: z.uuid(),
  action: z.enum(['review', 'publish', 'dismiss', 'approve', 'unpublish']),
  reason: z.string().check(z.trim(), z.maxLength(1000)),
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        contentHash: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
        revision: z.int().check(z.nonnegative()),
      }),
    )
    .check(
      z.minLength(1),
      z.maxLength(WORD_SUBMISSION_ITEM_LIMIT),
      z.refine((items) => new Set(items.map((item) => item.id)).size === items.length),
    ),
});
export type WordSubmissionAction = z.output<typeof wordSubmissionActionSchema>;
export const wordSubmissionActionResultSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(['queued', 'complete', 'failed']),
});
export const wordSubmissionAuditSchema = z.strictObject({
  id: z.int().check(z.positive()),
  actionId: z.uuid(),
  itemId: z.nullable(z.uuid()),
  action: z.string(),
  actor: z.enum(['shared-admin', 'review-workflow']),
  reason: z.string(),
  createdAt: z.iso.datetime(),
});
export const wordSubmissionListSchema = z.strictObject({
  batches: z.array(
    z.extend(wordSubmissionBatchHeaderSchema, {
      counts: z.partialRecord(wordSubmissionStatusSchema, z.int().check(z.nonnegative())),
    }),
  ),
  nextCursor: z.nullable(z.string()),
});
export const wordSubmissionAgentsSchema = z.strictObject({
  agents: z.array(wordSubmissionAgentSchema),
});

export const wordSubmissionSettingsSchema = z.strictObject({
  accepting: z.boolean(),
  pending: z.int().check(z.nonnegative()),
  pendingLimit: z.int().check(z.positive()),
  awaitingReview: z.int().check(z.nonnegative()),
  awaitingPublication: z.int().check(z.nonnegative()),
  failed: z.int().check(z.nonnegative()),
  published: z.int().check(z.nonnegative()),
  submittedToday: z.int().check(z.nonnegative()),
  dailyLimit: z.int().check(z.positive()),
  modelBudget: z.strictObject({
    dailyUsed: z.int().check(z.nonnegative()),
    dailyLimit: z.int().check(z.positive()),
    monthlyUsed: z.int().check(z.nonnegative()),
    monthlyLimit: z.int().check(z.positive()),
  }),
});
export type WordSubmissionSettings = z.output<typeof wordSubmissionSettingsSchema>;
