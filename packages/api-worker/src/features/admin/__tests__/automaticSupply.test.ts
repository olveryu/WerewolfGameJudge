import { GAME_WORD_GAMES } from '@game-judge/game-engine/product/wordSupply';
import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';

import {
  readAutomaticWordSupply,
  writeAutomaticWordSupply,
} from '../../../platform/wordSupply/automaticSupply';

afterEach(async () => {
  await Promise.all(
    GAME_WORD_GAMES.map((game) => env.GAME_MEDIA.delete(`system/word-supply/${game}.json`)),
  );
});

describe('automatic word supply settings storage', () => {
  it.each(GAME_WORD_GAMES)('round-trips the stored enabled flag for %s', async (game) => {
    await writeAutomaticWordSupply(env, game, false);
    await expect(readAutomaticWordSupply(env, game)).resolves.toEqual({ enabled: false });
    await writeAutomaticWordSupply(env, game, true);
    await expect(readAutomaticWordSupply(env, game)).resolves.toEqual({ enabled: true });
  });

  it('defaults to enabled when no setting is stored', async () => {
    await expect(readAutomaticWordSupply(env, 'fibking')).resolves.toEqual({ enabled: true });
  });

  it('fails closed on corrupt settings instead of silently enabling', async () => {
    await env.GAME_MEDIA.put('system/word-supply/fibking.json', '{"enabled":"false"}');
    await expect(readAutomaticWordSupply(env, 'fibking')).rejects.toThrow();
  });
});
