/** Typed editorial reads and commands reuse the administrator transport and response validation. */
import {
  type WordSubmissionAction,
  wordSubmissionActionResultSchema,
  type WordSubmissionAgentInput,
  wordSubmissionAgentSchema,
  wordSubmissionAgentsSchema,
  wordSubmissionAuditSchema,
  wordSubmissionBatchSchema,
  wordSubmissionIssuedCredentialSchema,
  wordSubmissionListSchema,
  wordSubmissionSettingsSchema,
} from '@game-judge/game-engine/product/wordSupply';
import * as z from 'zod/mini';

import { adminFetch } from './adminApi';

const ROOT = '/admin/word-submissions';
const auditSchema = z.strictObject({
  events: z.array(wordSubmissionAuditSchema),
  statuses: z.array(z.string()),
});
export const wordSubmissionsApi = {
  settings: (signal: AbortSignal) =>
    adminFetch(
      `${ROOT}/settings`,
      (value) => wordSubmissionSettingsSchema.parse(value),
      undefined,
      signal,
    ),
  setAccepting: (accepting: boolean) =>
    adminFetch(
      `${ROOT}/settings`,
      (value) => wordSubmissionSettingsSchema.parse(value),
      undefined,
      undefined,
      { accepting },
    ),
  agents: (signal: AbortSignal) =>
    adminFetch(
      `${ROOT}/agents`,
      (value) => wordSubmissionAgentsSchema.parse(value),
      undefined,
      signal,
    ),
  createAgent: (input: WordSubmissionAgentInput) =>
    adminFetch(
      `${ROOT}/agents`,
      (value) => wordSubmissionIssuedCredentialSchema.parse(value),
      undefined,
      undefined,
      input,
    ),
  rotate: (id: string, expiresInDays: 30 | 90 | 365) =>
    adminFetch(
      `${ROOT}/agents/${id}/rotate`,
      (value) => wordSubmissionIssuedCredentialSchema.parse(value),
      undefined,
      undefined,
      { expiresInDays },
    ),
  setAgentStatus: (id: string, status: 'active' | 'paused' | 'revoked') =>
    adminFetch(
      `${ROOT}/agents/${id}/status`,
      (value) => wordSubmissionAgentSchema.parse(value),
      undefined,
      undefined,
      { status },
    ),
  batches: (filter: Record<string, string>, signal: AbortSignal) =>
    adminFetch(`${ROOT}/batches`, (value) => wordSubmissionListSchema.parse(value), filter, signal),
  batch: (id: string, signal: AbortSignal) =>
    adminFetch(
      `${ROOT}/batches/${id}`,
      (value) => wordSubmissionBatchSchema.parse(value),
      undefined,
      signal,
    ),
  audit: (id: string, signal: AbortSignal) =>
    adminFetch(
      `${ROOT}/batches/${id}/audit`,
      (value) => auditSchema.parse(value),
      undefined,
      signal,
    ),
  action: (batchId: string, input: WordSubmissionAction) =>
    adminFetch(
      `${ROOT}/batches/${batchId}/actions`,
      (value) => wordSubmissionActionResultSchema.parse(value),
      undefined,
      undefined,
      input,
    ),
  dispatch: (batchId: string, actionId: string) =>
    adminFetch(
      `${ROOT}/batches/${batchId}/dispatch`,
      (value) => z.strictObject({ success: z.literal(true) }).parse(value),
      undefined,
      undefined,
      { actionId },
    ),
};
