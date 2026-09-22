/** Real Workflows/D1 checkpoints; only external model steps are replaced. */
import { env, introspectWorkflowInstance } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM undercover_round_word_selections'),
    env.DB.prepare('DELETE FROM undercover_word_candidates'),
    env.DB.prepare('DELETE FROM undercover_word_packs'),
    env.DB.prepare('DELETE FROM undercover_word_pairs'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

describe('Undercover supply workflow', () => {
  it('stores actual generation material and publishes independently reviewed pairs', async () => {
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    const candidate = {
      wordA: '熬夜',
      wordB: '赖床',
      category: 'actions',
      commonTraits: ['作息习惯', '感觉困倦'],
      differences: ['发生时间', '是否入睡'],
      potentialIssues: [],
    };
    const review = {
      wordA: candidate.wordA,
      wordB: candidate.wordB,
      commonTraits: ['影响精神', '影响作息'],
      differences: ['早上晚上', '睡醒睡前'],
      reason: '两词常见，有自然共性及可描述差异。',
      qualityChecks: {
        isFamiliar: true,
        hasSimilarFamiliarity: true,
        hasSharedDescriptions: true,
        hasDistinctDescriptions: true,
        isNotSynonymOrSubset: true,
        isPlayableBothWays: true,
        isCategoryAccurate: true,
        isAppropriate: true,
        isFactuallyCertain: true,
      },
    };
    await using instance = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'generate-0' }, { candidates: [candidate] });
      await modifier.mockStepResult({ name: 'review-0' }, [review]);
      await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
    });
    await env.UNDERCOVER_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'paused' });
    expect(
      await env.DB.prepare('SELECT status, generation_json FROM undercover_word_packs').first(),
    ).toEqual({
      status: 'published',
      generation_json: JSON.stringify({ candidates: [candidate] }),
    });
    expect(
      await env.DB.prepare('SELECT word_a, word_b, status FROM undercover_word_pairs').first(),
    ).toEqual({ word_a: '熬夜', word_b: '赖床', status: 'active' });
  });

  it('records failed generation without publishing or automatically repeating the operation', async () => {
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepError({ name: 'generate-0' }, new Error('Provider unavailable'));
    });
    await env.UNDERCOVER_WORD_SUPPLY.create({
      id,
      params: { day: new Date().toISOString().slice(0, 10) },
    });
    await instance.waitForStatus('errored');
    expect(
      await env.DB.prepare('SELECT status, failure_reason FROM undercover_word_packs').first(),
    ).toEqual({ status: 'failed', failure_reason: 'generation' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM undercover_word_pairs').first(),
    ).toEqual({ count: 0 });
  });
});
