/** Real Workflows/D1 checkpoints; only external model steps are replaced. */
import { env, introspectWorkflowInstance } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM drawguess_word_candidates'),
    env.DB.prepare('DELETE FROM drawguess_word_packs'),
    env.DB.prepare('DELETE FROM drawguess_words'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

describe('DrawGuess supply workflow', () => {
  it('stores actual generation material and publishes independently reviewed words', async () => {
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    const candidate = {
      word: '大熊猫',
      category: 'animals',
      difficulty: 'easy',
      potentialIssues: [],
    };
    const review = {
      word: candidate.word,
      qualityChecks: {
        isConcreteAndDrawable: true,
        isSimplifiedChinese: true,
        isLengthValid: true,
        isCategoryAccurate: true,
        isAppropriate: true,
        isUnambiguous: true,
      },
      reason: '常见动物，外形特征明确，好画好猜。',
    };
    await using instance = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'generate-0' }, { candidates: [candidate] });
      await modifier.mockStepResult({ name: 'review-0' }, [review]);
      await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
    });
    await env.DRAWGUESS_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'paused' });
    expect(
      await env.DB.prepare('SELECT status, generation_json FROM drawguess_word_packs').first(),
    ).toEqual({
      status: 'published',
      generation_json: JSON.stringify({ candidates: [candidate] }),
    });
    expect(
      await env.DB.prepare('SELECT word, pinyin_initials, status FROM drawguess_words').first(),
    ).toEqual({ word: '大熊猫', pinyin_initials: 'd x m', status: 'active' });
  });

  it('records failed generation without publishing or automatically repeating the operation', async () => {
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepError({ name: 'generate-0' }, new Error('Provider unavailable'));
    });
    await env.DRAWGUESS_WORD_SUPPLY.create({
      id,
      params: { day: new Date().toISOString().slice(0, 10) },
    });
    await instance.waitForStatus('errored');
    expect(
      await env.DB.prepare('SELECT status, failure_reason FROM drawguess_word_packs').first(),
    ).toEqual({ status: 'failed', failure_reason: 'generation' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
  });
});
