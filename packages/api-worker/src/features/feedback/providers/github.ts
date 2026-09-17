/** GitHub Issues adapter for feedback issue, comment, and state synchronization. */

import { z } from 'zod';

const GITHUB_REPO = 'olveryu/WerewolfGameJudge';
const GITHUB_API_VERSION = '2026-03-10';
const GITHUB_API_ROOT = `https://api.github.com/repos/${GITHUB_REPO}`;
const GITHUB_TIMEOUT_MS = 10_000;
const RECONCILIATION_PAGE_SIZE = 100;
const RECONCILIATION_MAX_PAGES = 20;

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
  findIssue(marker: string): Promise<number | null>;
  findComment(issueNumber: number, marker: string): Promise<number | null>;
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

  async function findMarkedResource(resource: string, marker: string, idField: 'number' | 'id') {
    const schema = z.array(
      z.object({
        [idField]: z.number().int().positive(),
        body: z.string().nullable(),
      }),
    );
    const signal = AbortSignal.timeout(GITHUB_TIMEOUT_MS);
    let remoteId: number | null = null;
    for (let page = 1; page <= RECONCILIATION_MAX_PAGES; page++) {
      const url = new URL(`${GITHUB_API_ROOT}/${resource}`);
      url.searchParams.set('per_page', String(RECONCILIATION_PAGE_SIZE));
      url.searchParams.set('page', String(page));
      if (idField === 'number') url.searchParams.set('state', 'all');
      const response = await fetchImpl(url, { headers, signal });
      await assertStatus(response, 200, 'reconciliation');
      const entries = schema.parse(await response.json());
      for (const entry of entries) {
        if (typeof entry.body !== 'string' || !entry.body.startsWith(`${marker}\n`)) continue;
        const matchedId = z.number().int().positive().parse(entry[idField]);
        if (remoteId !== null && remoteId !== matchedId)
          throw new Error('Multiple GitHub resources match feedback delivery');
        remoteId = matchedId;
      }
      if (entries.length < RECONCILIATION_PAGE_SIZE) return remoteId;
    }
    throw new Error('GitHub reconciliation page limit reached; manual verification required');
  }

  return {
    findIssue: (marker) => findMarkedResource('issues', marker, 'number'),
    findComment: (issueNumber, marker) =>
      findMarkedResource(`issues/${issueNumber}/comments`, marker, 'id'),
    async createIssue(input) {
      const response = await fetchImpl(`${GITHUB_API_ROOT}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });
      await assertStatus(response, 201, 'issue creation');
      return createdIssueSchema.parse(await response.json());
    },

    async createComment(issueNumber, body) {
      const response = await fetchImpl(`${GITHUB_API_ROOT}/issues/${issueNumber}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body }),
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });
      await assertStatus(response, 201, 'comment creation');
      return createdCommentSchema.parse(await response.json());
    },

    async setIssueState(issueNumber, state) {
      const response = await fetchImpl(`${GITHUB_API_ROOT}/issues/${issueNumber}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state }),
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });
      await assertStatus(response, 200, 'issue state update');
    },
  };
}
