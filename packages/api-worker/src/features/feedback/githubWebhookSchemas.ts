/** Permissive schemas for GitHub-owned webhook payloads. */

import { z } from 'zod';

const githubUserSchema = z.object({
  login: z.string(),
  type: z.string(),
});

const githubLabelSchema = z.object({
  name: z.string(),
});

const githubIssueSchema = z.object({
  number: z.number(),
  state: z.string(),
  labels: z.array(githubLabelSchema),
});

/** GitHub `issue_comment` payload; unrelated provider fields are ignored. */
export const githubIssueCommentPayloadSchema = z.object({
  action: z.string(),
  issue: githubIssueSchema,
  comment: z.object({
    id: z.number(),
    body: z.string(),
    user: githubUserSchema,
  }),
});

/** GitHub `issues` payload; unrelated provider fields are ignored. */
export const githubIssuesPayloadSchema = z.object({
  action: z.string(),
  issue: githubIssueSchema,
});
