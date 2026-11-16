/** Search cost and evidence parsing contracts, without network access. */
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import { fibSubmissionAdapter } from '../../wordSubmissions';
import { extractFibWordEvidence, searchFibWordEvidence } from '../tavily';

describe('Tavily evidence', () => {
  it('uses one-credit basic search and returns source attribution', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        results: [
          { url: 'https://example.com/word', title: '词义', content: '射覆是一种古代游戏。' },
        ],
        usage: { credits: 1 },
      }),
    );
    expect(await searchFibWordEvidence('test-key', '射覆 词义', fetchImpl)).toEqual([
      {
        query: '射覆 词义',
        url: 'https://example.com/word',
        title: '词义',
        content: '射覆是一种古代游戏。',
      },
    ]);
    const init = fetchImpl.mock.calls[0]?.[1];
    if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body');
    expect(JSON.parse(init.body)).toMatchObject({
      search_depth: 'basic',
      auto_parameters: false,
      include_raw_content: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('does not retry a quota failure', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 432 }));
    await expect(searchFibWordEvidence('test-key', '词义', fetchImpl)).rejects.toThrow('432');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('extracts only discovered URLs at basic cost and reports partial source failures', async () => {
    const sources = ['first', 'second'].map((name) => ({
      query: '传统器物 术语 释义',
      url: `https://example.com/${name}`,
      title: name,
      content: '搜索摘要不是提取失败时的替代资料。',
    }));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        results: [{ url: 'https://example.com/first', raw_content: '射覆是一种古代游戏。' }],
        failed_results: [{ url: 'https://example.com/second', error: 'Unavailable' }],
        usage: { credits: 1 },
      }),
    );
    expect(await extractFibWordEvidence('test-key', sources, { fetchImpl })).toEqual({
      evidence: [{ ...sources[0], content: '射覆是一种古代游戏。' }],
      failedUrls: ['https://example.com/second'],
      failures: [{ sourceIndex: 1 }],
    });
    const init = fetchImpl.mock.calls[0]?.[1];
    if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body');
    expect(JSON.parse(init.body)).toMatchObject({
      urls: sources.map(({ url }) => url),
      extract_depth: 'basic',
      format: 'text',
      include_usage: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('redacts private source data and credentials from extraction failure diagnostics', async () => {
    const sources = [
      {
        query: '私密词 释义',
        url: 'https://example.com/private',
        title: '私密词',
        content: '私密词来源摘要',
      },
    ];
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        results: [],
        failed_results: [
          {
            url: sources[0]?.url,
            error: 'Failed to retrieve 私密词 at https://example.com/private using test-key',
          },
        ],
        usage: { credits: 1 },
      }),
    );
    const result = await extractFibWordEvidence('test-key', sources, {
      fetchImpl,
      privateValues: { word: '私密词' },
    });
    expect(result.failures[0]?.message).toContain('Failed to retrieve');
    expect(result.failures[0]?.message).not.toContain('私密词');
    expect(result.failures[0]?.message).not.toContain('example.com');
    expect(result.failures[0]?.message).not.toContain('test-key');
  });

  it.each([
    { results: [], failed_results: [] },
    {
      results: [{ url: 'https://example.com/word', raw_content: '独立来源正文' }],
      failed_results: [{ url: 'https://example.com/word', error: 'Unavailable' }],
    },
  ])('rejects an incomplete or contradictory extraction response', async (response) => {
    const sources = [
      {
        query: '词义',
        url: 'https://example.com/word',
        title: '词义',
        content: '摘要',
      },
    ];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ...response, usage: { credits: 1 } }));
    await expect(extractFibWordEvidence('test-key', sources, { fetchImpl })).rejects.toMatchObject({
      failureKind: 'invalidOutput',
    });
  });

  it('logs a correlated, redacted diagnostic when a submission source fails', async () => {
    const successUrl = 'https://dictionary.example/success';
    const failedUrl = 'https://dictionary.example/private';
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        if (input === 'https://api.tavily.com/search')
          return Response.json({
            results: [successUrl, failedUrl].map((url) => ({
              url,
              title: '独立词典',
              content: '菡萏是荷花的别称。',
            })),
            usage: { credits: 1 },
          });
        if (input === 'https://api.tavily.com/extract')
          return Response.json({
            results: [{ url: successUrl, raw_content: '菡萏是荷花的别称，常见于古典诗文。' }],
            failed_results: [
              {
                url: failedUrl,
                error: `Failed to retrieve 菡萏 from ${failedUrl} using ${env.TAVILY_API_KEY}`,
              },
            ],
            usage: { credits: 1 },
          });
        throw new Error('Unapproved provider URL');
      }),
    );
    try {
      if (fibSubmissionAdapter.prepareReview === undefined)
        throw new Error('Expected Fib preparation');
      const prepared = await fibSubmissionAdapter.prepareReview(
        env,
        {
          word: '菡萏',
          category: 'plants',
          references: [],
          definition: {
            coreMeaning: '荷花的别称，古人常在诗文中用来称呼荷花。',
            usageNote: '多见于古典诗文和书面描写，不是现代口语中的常用称呼。',
          },
        },
        async () => {},
        { workflowId: 'workflow-test', itemId: 'item-test' },
      );
      expect(prepared.evidence).toMatchObject([{ url: successUrl }]);
      expect(warning).toHaveBeenCalledOnce();
      const message = String(warning.mock.calls[0]?.[0]);
      expect(message).toContain('"workflowId":"workflow-test"');
      expect(message).toContain('"itemId":"item-test"');
      expect(message).toContain('"sourceIndex":1');
      expect(message).not.toContain('菡萏');
      expect(message).not.toContain('dictionary.example');
      expect(message).not.toContain(env.TAVILY_API_KEY);
    } finally {
      warning.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
