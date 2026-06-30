/**
 * CREATE_CONFIG_SCHEMAS — per-gameType create-config validators (boundary validation).
 *
 * Kept at the api-worker boundary (not in the pure game-engine, which is zod-free).
 * The generic /room/create handler validates `config` against the schema for the
 * requested gameType before calling that engine's createInitialState.
 */

import { FIB_GAME_TYPE } from '@werewolf/game-engine/fibking/types';
import type { z } from 'zod';

import { fibCreateConfigSchema } from './fib';

export const CREATE_CONFIG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  [FIB_GAME_TYPE]: fibCreateConfigSchema,
};
