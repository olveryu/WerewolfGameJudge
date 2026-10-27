/** configSchemaToZod delegates every rule to the engine schema; zod only carries the verdict. */

import type { GameConfigSchema } from '@game-judge/game-engine/platform/config/configSchema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { configSchemaToZod } from '../configSchemaZod';

interface SampleConfig {
  readonly numberOfPlayers: number;
  readonly hasBlank: boolean;
  readonly mode: 'public' | 'secret';
}

const SAMPLE_SCHEMA: GameConfigSchema<SampleConfig> = {
  fields: {
    numberOfPlayers: { kind: 'count', label: '玩家人数', min: 4, max: 12 },
    hasBlank: { kind: 'toggle', label: '白板' },
    mode: {
      kind: 'choice',
      label: '模式',
      options: [
        { value: 'public', label: '公开' },
        { value: 'secret', label: '隐藏' },
      ],
    },
  },
  defaults: { numberOfPlayers: 6, hasBlank: false, mode: 'public' },
  validate: (config) =>
    config.hasBlank && config.numberOfPlayers < 6
      ? { field: 'hasBlank', message: '启用白板至少需要 6 人' }
      : null,
};

const sampleZod = configSchemaToZod(SAMPLE_SCHEMA);

describe('configSchemaToZod', () => {
  it('parses a valid config to the same object', () => {
    const parsed: SampleConfig = sampleZod.parse(SAMPLE_SCHEMA.defaults);
    expect(parsed).toEqual(SAMPLE_SCHEMA.defaults);
  });

  it.each([
    ['below min', { numberOfPlayers: 3, hasBlank: false, mode: 'public' }],
    ['above max', { numberOfPlayers: 13, hasBlank: false, mode: 'public' }],
    ['non-integer', { numberOfPlayers: 6.5, hasBlank: false, mode: 'public' }],
    ['wrong type', { numberOfPlayers: '6', hasBlank: false, mode: 'public' }],
    ['unknown choice', { numberOfPlayers: 6, hasBlank: false, mode: 'hidden' }],
    ['missing field', { numberOfPlayers: 6, hasBlank: false }],
    ['extra field', { numberOfPlayers: 6, hasBlank: false, mode: 'public', extra: 1 }],
    ['cross-field', { numberOfPlayers: 5, hasBlank: true, mode: 'public' }],
    ['not an object', 6],
  ])('rejects %s', (_label, value) => {
    expect(sampleZod.safeParse(value).success).toBe(false);
  });

  it('composes inside a strict discriminated union as a command payload', () => {
    const command = z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('sample.config.update'), config: sampleZod }),
    ]);
    expect(
      command.safeParse({ type: 'sample.config.update', config: SAMPLE_SCHEMA.defaults }).success,
    ).toBe(true);
    expect(
      command.safeParse({ type: 'sample.config.update', config: { numberOfPlayers: 6 } }).success,
    ).toBe(false);
  });
});
