import { GAME_WORD_GAMES, type GameWordGame } from '@game-judge/game-engine/product/wordSupply';
import { z } from 'zod';

import type { Env } from '../../env';

const settingsSchema = z.strictObject({ enabled: z.boolean() });
export const automaticSupplyUpdateSchema = settingsSchema.extend({ game: z.enum(GAME_WORD_GAMES) });

function storageKey(game: GameWordGame): string {
  return `system/word-supply/${game}.json`;
}

/** Unconfigured games retain the existing deployment-gated daily schedule. */
export async function readAutomaticWordSupply(env: Env, game: GameWordGame) {
  const object = await env.GAME_MEDIA.get(storageKey(game));
  return object === null ? { enabled: true } : settingsSchema.parse(await object.json());
}

/** Persist each game's automatic scheduling policy without reading or writing D1. */
export async function writeAutomaticWordSupply(env: Env, game: GameWordGame, enabled: boolean) {
  await env.GAME_MEDIA.put(storageKey(game), JSON.stringify({ enabled }), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
  });
}
