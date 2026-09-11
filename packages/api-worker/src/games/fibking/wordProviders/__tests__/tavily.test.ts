/** Search cost and evidence parsing contracts, without network access. */
import { describe, expect, it, vi } from 'vitest';

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
    expect(await extractFibWordEvidence('test-key', sources, fetchImpl)).toEqual({
      evidence: [{ ...sources[0], content: '射覆是一种古代游戏。' }],
      failedUrls: ['https://example.com/second'],
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
});
