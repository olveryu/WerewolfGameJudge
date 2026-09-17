/** GitHub feedback provider response and status contract tests. */

import { describe, expect, it } from 'vitest';

import { createGitHubFeedbackProvider } from '../github';

describe('GitHub feedback provider', () => {
  it('reconciles marked resources through paginated reads without creating again', async () => {
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      requests.push(url.toString());
      expect(init?.method).toBeUndefined();
      const entries =
        url.searchParams.get('page') === '1'
          ? Array.from({ length: 100 }, (_, index) => ({ number: index + 1, body: 'other' }))
          : [{ number: 142, body: '<!-- feedback:operation -->\nbody' }];
      return Response.json(entries);
    };
    const provider = createGitHubFeedbackProvider('token', fetchImpl);
    await expect(provider.findIssue('<!-- feedback:operation -->')).resolves.toBe(142);
    expect(requests).toHaveLength(2);
    expect(new URL(requests[1]).searchParams.get('state')).toBe('all');
    const comments = createGitHubFeedbackProvider('token', async () =>
      Response.json([{ id: 91, body: '<!-- feedback:reply -->\nbody' }]),
    );
    await expect(comments.findComment(142, '<!-- feedback:reply -->')).resolves.toBe(91);
  });
  it('creates an issue with the pinned API contract and parses its number', async () => {
    let requestHeaders = new Headers();
    let requestBody = '';
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body');
      requestBody = init.body;
      return new Response(JSON.stringify({ number: 42, ignored: true }), { status: 201 });
    };
    const provider = createGitHubFeedbackProvider('token', fetchImpl);

    await expect(
      provider.createIssue({ title: 'Title', body: 'Body', labels: ['user-feedback'] }),
    ).resolves.toEqual({ number: 42 });
    expect(requestHeaders.get('X-GitHub-Api-Version')).toBe('2026-03-10');
    expect(JSON.parse(requestBody)).toEqual({
      title: 'Title',
      body: 'Body',
      labels: ['user-feedback'],
    });
  });

  it('parses the created comment ID', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ id: 101 }), { status: 201 });
    const provider = createGitHubFeedbackProvider('token', fetchImpl);

    await expect(provider.createComment(42, 'Reply')).resolves.toEqual({ id: 101 });
  });

  it('rejects a successful response without the required provider fields', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ id: 'not-an-issue-number' }), { status: 201 });
    const provider = createGitHubFeedbackProvider('token', fetchImpl);

    await expect(
      provider.createIssue({ title: 'Title', body: 'Body', labels: [] }),
    ).rejects.toThrow();
  });

  it('fails when an issue state update does not return the documented status', async () => {
    const fetchImpl: typeof fetch = async () => new Response('forbidden', { status: 403 });
    const provider = createGitHubFeedbackProvider('token', fetchImpl);

    await expect(provider.setIssueState(42, 'closed')).rejects.toThrow(
      'GitHub issue state update failed (403): forbidden',
    );
  });
});
