/** Client request strictness and GitHub provider payload compatibility. */

import { describe, expect, it } from 'vitest';

import {
  githubIssueCommentPayloadSchema,
  githubIssuesPayloadSchema,
} from '../githubWebhookSchemas';
import {
  feedbackMarkReadSchema,
  feedbackReplySchema,
  feedbackResolveSchema,
  feedbackSchema,
} from '../schemas';

describe('feedback request schemas', () => {
  it.each([
    [feedbackSchema, { content: 'feedback', appVersion: '1.0.0', unexpected: true }],
    [feedbackReplySchema, { content: 'reply', unexpected: true }],
    [feedbackMarkReadSchema, { feedbackId: 'feedback-id', unexpected: true }],
    [feedbackResolveSchema, { action: 'resolve', unexpected: true }],
  ] as const)('rejects unknown client-controlled fields', (schema, input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });
});

describe('GitHub webhook schemas', () => {
  const issue = {
    number: 1,
    state: 'open',
    labels: [{ name: 'feedback', color: 'ffffff' }],
    providerOwnedField: true,
  };

  it('accepts unrelated fields in issue_comment payloads', () => {
    expect(
      githubIssueCommentPayloadSchema.safeParse({
        action: 'created',
        issue,
        comment: {
          id: 2,
          body: 'reply',
          user: { login: 'admin', type: 'User', avatar_url: 'https://example.com/avatar' },
          html_url: 'https://example.com/comment',
        },
        repository: { id: 3 },
      }).success,
    ).toBe(true);
  });

  it('accepts unrelated fields in issues payloads', () => {
    expect(
      githubIssuesPayloadSchema.safeParse({
        action: 'closed',
        issue,
        repository: { id: 3 },
      }).success,
    ).toBe(true);
  });
});
