import { GAME_WORD_GAMES } from '@game-judge/game-engine/product/wordSupply';
import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runScheduledCron } from '../../../app/scheduled';
import {
  readAutomaticWordSupply,
  writeAutomaticWordSupply,
} from '../../../platform/wordSupply/automaticSupply';
import { triggerGameWordSupply } from '../gameWords';
import { adminRoutes } from '../routes';

const endpoint = '/games/words/automatic-supply';
const headers = { 'X-Admin-Token': env.ADMIN_PASSWORD, 'Content-Type': 'application/json' };
const enabledEnvironment = {
  ...env,
  FIB_WORD_SUPPLY_ENABLED: 'true',
  UNDERCOVER_WORD_SUPPLY_ENABLED: 'true',
  DRAWGUESS_WORD_SUPPLY_ENABLED: 'true',
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    GAME_WORD_GAMES.map((game) => env.GAME_MEDIA.delete(`system/word-supply/${game}.json`)),
  );
});

describe('automatic word supply settings', () => {
  it('retains the existing default and persists independent game switches without touching D1', async () => {
    const database = vi.spyOn(env.DB, 'prepare').mockImplementation(() => {
      throw new Error('D1 unavailable');
    });
    for (const game of GAME_WORD_GAMES) {
      expect(await readAutomaticWordSupply(env, game)).toEqual({ enabled: true });
      const saved = await adminRoutes.request(
        endpoint,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ game, enabled: false }),
        },
        env,
      );
      expect(saved.status).toBe(200);
      expect(await saved.json()).toEqual({ game, enabled: false });
      const response = await adminRoutes.request(`${endpoint}?game=${game}`, { headers }, env);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toEqual({ game, enabled: false });
    }
    await writeAutomaticWordSupply(env, 'fibking', true);
    expect(await readAutomaticWordSupply(env, 'fibking')).toEqual({ enabled: true });
    expect(await readAutomaticWordSupply(env, 'undercover')).toEqual({ enabled: false });
    expect(database).not.toHaveBeenCalled();
  });

  it.each(GAME_WORD_GAMES)(
    'actually pauses and resumes scheduled %s jobs without disabling manual jobs',
    async (game) => {
      const workflows = {
        fibking: vi.spyOn(env.FIB_WORD_SUPPLY, 'createBatch').mockResolvedValue([]),
        undercover: vi.spyOn(env.UNDERCOVER_WORD_SUPPLY, 'createBatch').mockResolvedValue([]),
        drawguess: vi.spyOn(env.DRAWGUESS_WORD_SUPPLY, 'createBatch').mockResolvedValue([]),
      };
      await writeAutomaticWordSupply(env, game, false);
      await runScheduledCron(enabledEnvironment, '0 4 * * *', Date.parse('2026-11-12T04:00:00Z'));
      for (const candidate of GAME_WORD_GAMES)
        expect(workflows[candidate]).toHaveBeenCalledTimes(candidate === game ? 0 : 1);
      const manual = await triggerGameWordSupply(enabledEnvironment, { game, force: false });
      const manualRequest = workflows[game].mock.calls.at(-1)?.[0][0];
      expect(manualRequest?.id).toBe(manual.workflowId);
      expect(manualRequest?.params?.force).toBe(false);
      await writeAutomaticWordSupply(env, game, true);
      await runScheduledCron(enabledEnvironment, '0 4 * * *', Date.parse('2026-11-13T04:00:00Z'));
      for (const candidate of GAME_WORD_GAMES)
        expect(workflows[candidate]).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['GET', 'POST'])('requires administrator authentication for %s', async (method) => {
    expect((await adminRoutes.request(`${endpoint}?game=fibking`, { method }, env)).status).toBe(
      401,
    );
  });

  it.each([
    { game: 'other', enabled: false },
    { game: 'fibking', enabled: 'false' },
    { game: 'fibking', enabled: false, extra: true },
  ])('rejects invalid changes without replacing the saved setting', async (input) => {
    await writeAutomaticWordSupply(env, 'fibking', true);
    const response = await adminRoutes.request(
      endpoint,
      { method: 'POST', headers, body: JSON.stringify(input) },
      env,
    );
    expect(response.status).toBe(400);
    expect(await readAutomaticWordSupply(env, 'fibking')).toEqual({ enabled: true });
  });

  it('fails closed on corrupt settings instead of silently resuming generation', async () => {
    const workflow = vi.spyOn(env.FIB_WORD_SUPPLY, 'createBatch').mockResolvedValue([]);
    await env.GAME_MEDIA.put('system/word-supply/fibking.json', '{"enabled":"false"}');
    await expect(runScheduledCron(enabledEnvironment, '0 4 * * *', Date.now())).rejects.toThrow();
    expect(workflow).not.toHaveBeenCalled();
    expect((await adminRoutes.request(`${endpoint}?game=fibking`, { headers }, env)).status).toBe(
      500,
    );
  });

  it('reports a failed write without claiming the setting was saved', async () => {
    vi.spyOn(env.GAME_MEDIA, 'put').mockRejectedValue(new Error('R2 unavailable'));
    const response = await adminRoutes.request(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ game: 'fibking', enabled: false }),
      },
      env,
    );
    expect(response.status).toBe(500);
    expect(await readAutomaticWordSupply(env, 'fibking')).toEqual({ enabled: true });
  });
});
