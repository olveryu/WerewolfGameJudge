import { GAME_WORD_GAMES } from '@game-judge/game-engine/product/wordSupply';
import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runScheduledCron } from '../../../app/scheduled';
import { writeAutomaticWordSupply } from '../../../platform/wordSupply/automaticSupply';
import { triggerGameWordSupply } from '../gameWords';

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

  it('fails closed on corrupt settings instead of silently resuming generation', async () => {
    const workflow = vi.spyOn(env.FIB_WORD_SUPPLY, 'createBatch').mockResolvedValue([]);
    await env.GAME_MEDIA.put('system/word-supply/fibking.json', '{"enabled":"false"}');
    await expect(runScheduledCron(enabledEnvironment, '0 4 * * *', Date.now())).rejects.toThrow();
    expect(workflow).not.toHaveBeenCalled();
  });
});
