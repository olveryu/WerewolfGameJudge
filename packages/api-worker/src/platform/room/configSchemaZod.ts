/**
 * Bridge from the engine's GameConfigSchema to a zod boundary schema.
 *
 * The engine owns every lobby-config rule (field ranges, exact key set,
 * cross-field invariants) through `isConfig`; this adapter only lets that guard
 * participate in the Worker's zod command and create-config schemas. Worker
 * modules must not restate a limit that lives in the engine schema.
 */

import {
  type GameConfigSchema,
  isConfig,
} from '@game-judge/game-engine/platform/config/configSchema';
import { z } from 'zod';

export function configSchemaToZod<TConfig extends object>(
  schema: GameConfigSchema<TConfig>,
): z.ZodType<TConfig> {
  return z.custom<TConfig>((value) => isConfig(schema, value), 'Invalid game config');
}
