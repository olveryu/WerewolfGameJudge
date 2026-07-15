/** GitHub Issues adapter for feedback issue, comment, and state synchronization. */

import { z } from 'zod';

const GITHUB_REPO = 'olveryu/WerewolfGameJudge';
const GITHUB_API_VERSION = '2026-03-10';
const GITHUB_API_ROOT = `https://api.github.com/repos/${GITHUB_REPO}`;

const createdIssueSchema = z.object({ number: z.number().int().positive() });
const createdCommentSchema = z.object({ id: z.number().int().positive() });

type GitHubIssueState = 'open' | 'closed';

export interface GitHubFeedbackProvider {
  createIssue(input: {
    readonly title: string;
    readonly body: string;
    readonly labels: readonly string[];
  }): Promise<{ number: number }>;
  createComment(issueNumber: number, body: string): Promise<{ id: number }>;
  setIssueState(issueNumber: number, state: GitHubIssueState): Promise<void>;
}

function createHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'WerewolfGameJudge-Worker',
    'Content-Type': 'application/json',
  };
}

async function assertStatus(
  response: Response,
  expectedStatus: 200 | 201,
  operation: string,
): Promise<void> {
  if (response.status === expectedStatus) return;
  const detail = await response.text();
  throw new Error(`GitHub ${operation} failed (${response.status}): ${detail}`);
}

export function createGitHubFeedbackProvider(
  token: string,
  fetchImpl: typeof fetch = fetch,
): GitHubFeedbackProvider {
  const headers = createHeaders(token);

  return {
    async createIssue(input) {
      const response = await fetchImpl(`${GITHUB_API_ROOT}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      await assertStatus(response, 201, 'issue creation');
      return createdIssueSchema.parse(await response.json());
    },

    async createComment(issueNumber, body) {
      const response = await fetchImpl(`${GITHUB_API_ROOT}/issues/${issueNumber}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body }),
      });
      await assertStatus(response, 201, 'comment creation');
      return createdCommentSchema.parse(await response.json());
    },

    async setIssueState(issueNumber, state) {
      const response = await fetchImpl(`${GITHUB_API_ROOT}/issues/${issueNumber}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state }),
      });
      await assertStatus(response, 200, 'issue state update');
    },
  };
}
