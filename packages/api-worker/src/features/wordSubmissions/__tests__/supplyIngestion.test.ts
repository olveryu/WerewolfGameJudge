/** Supply writes submissions: system agent, pending items, duplicate marking. */
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { storeSupplySubmissions, SUPPLY_AGENT_ID, SUPPLY_AGENT_NAME } from '../ingestion';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM word_submission_events'),
    env.DB.prepare('DELETE FROM word_submission_actions'),
    env.DB.prepare('DELETE FROM word_submission_control_events'),
    // The system agent points at its credential: clear the reference before
    // deleting credentials, or the FK blocks the cleanup.
    env.DB.prepare('UPDATE word_submission_agents SET current_credential_id = NULL'),
    env.DB.prepare('DELETE FROM word_submission_credentials'),
    // The FTS search row is keyed by the batch rowid: batches are deleted
    // below, so the next store reuses the rowid and must not collide with
    // the leftover search row.
    env.DB.prepare('DELETE FROM word_submission_search'),
    env.DB.prepare('DELETE FROM word_submission_items'),
    env.DB.prepare('DELETE FROM word_submission_batches'),
    // Daily usage rows reference agents; delete them before the agents.
    env.DB.prepare('DELETE FROM word_submission_daily_usage'),
    env.DB.prepare('DELETE FROM word_submission_agents'),
  ]);
});

const fibWord = {
  word: '菡萏',
  definition: {
    coreMeaning: '荷花的别称，古人常在诗文中用来称呼荷花。',
    usageNote: '多见于古典诗文和书面描写，不是现代口语中的常用称呼。',
  },
  category: 'literary',
  topic: 'plants',
  references: [{ url: 'https://example.test/source', note: '菡萏：荷花的别称。' }],
};

describe('storeSupplySubmissions', () => {
  it('ensures the system agent row and stores generated words as pending submissions', async () => {
    const runId = crypto.randomUUID();
    const batch = await storeSupplySubmissions(env.DB, 'fibking', runId, [
      { clientItemId: 'pack-1:0', content: fibWord },
    ]);
    // One batch per supply run, id = run id.
    expect(batch.id).toBe(runId);
    expect(batch.game).toBe('fibking');
    expect(batch.agentName).toBe(SUPPLY_AGENT_NAME);
    expect(batch.items).toHaveLength(1);
    expect(batch.items[0]).toMatchObject({
      title: '菡萏',
      category: 'literary',
      status: 'pending',
      duplicateOf: null,
    });

    const agent = await env.DB.prepare(
      `SELECT id, name, status, daily_quota, pending_quota, games_json
       FROM word_submission_agents WHERE id = ?`,
    )
      .bind(SUPPLY_AGENT_ID)
      .first<{
        id: string;
        name: string;
        status: string;
        daily_quota: number;
        pending_quota: number;
        games_json: string;
      }>();
    expect(agent).toMatchObject({
      id: SUPPLY_AGENT_ID,
      name: SUPPLY_AGENT_NAME,
      status: 'active',
      daily_quota: 1000,
      pending_quota: 1000,
    });
    expect(JSON.parse(agent?.games_json ?? '[]')).toEqual(['fibking', 'undercover', 'drawguess']);
    const credential = await env.DB.prepare(
      `SELECT prefix, revoked_at, expires_at FROM word_submission_credentials
       WHERE agent_id = ?`,
    )
      .bind(SUPPLY_AGENT_ID)
      .first<{ prefix: string; revoked_at: string | null; expires_at: string }>();
    expect(credential?.prefix).toBe('supply');
    expect(credential?.revoked_at).toBeNull();

    // A second run ensures the same agent row instead of duplicating it.
    await storeSupplySubmissions(env.DB, 'fibking', crypto.randomUUID(), [
      {
        clientItemId: 'pack-2:0',
        content: { ...fibWord, word: '芙蕖' },
      },
    ]);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM word_submission_agents WHERE id = ?')
        .bind(SUPPLY_AGENT_ID)
        .first(),
    ).toEqual({ count: 1 });
  });

  it('marks a regenerated duplicate as duplicate, not pending', async () => {
    await storeSupplySubmissions(env.DB, 'fibking', crypto.randomUUID(), [
      { clientItemId: 'pack-1:0', content: fibWord },
    ]);
    const second = await storeSupplySubmissions(env.DB, 'fibking', crypto.randomUUID(), [
      { clientItemId: 'pack-2:0', content: fibWord },
    ]);
    expect(second.items).toHaveLength(1);
    expect(second.items[0]).toMatchObject({ title: '菡萏', status: 'duplicate' });
    expect(second.items[0]?.duplicateOf).not.toBeNull();
    expect(
      (
        await env.DB.prepare(
          'SELECT status, COUNT(*) AS count FROM word_submission_items GROUP BY status ORDER BY status',
        ).all()
      ).results,
    ).toEqual([
      { status: 'duplicate', count: 1 },
      { status: 'pending', count: 1 },
    ]);
  });

  it('stores an undercover pair as a pending submission with its pair identity', async () => {
    const batch = await storeSupplySubmissions(env.DB, 'undercover', crypto.randomUUID(), [
      {
        clientItemId: 'pack-1:0',
        content: {
          wordA: '熬夜',
          wordB: '赖床',
          category: 'dailyLife',
          commonTraits: ['作息习惯', '感觉困倦'],
          differences: ['发生时间', '是否入睡'],
          potentialIssues: [],
        },
      },
    ]);
    expect(batch.items).toHaveLength(1);
    expect(batch.items[0]).toMatchObject({ title: '熬夜 / 赖床', status: 'pending' });
  });

  it('fails loudly on an invalid generated item instead of dropping it', async () => {
    await expect(
      storeSupplySubmissions(env.DB, 'fibking', crypto.randomUUID(), [
        // No definition: the submission schema rejects it.
        { clientItemId: 'pack-1:0', content: { word: '菡萏', category: 'literary' } },
      ]),
    ).rejects.toThrow('Supply submission failed validation');
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM word_submission_items').first(),
    ).toEqual({ count: 0 });
  });
});
