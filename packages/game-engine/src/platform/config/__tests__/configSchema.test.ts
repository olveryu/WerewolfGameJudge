import { describe, expect, it } from 'vitest';

import {
  type ConfigValidationIssue,
  type GameConfigSchema,
  isValidConfig,
  validateConfig,
} from '../configSchema';

interface SampleConfig {
  readonly numberOfPlayers: number;
  readonly hasBlank: boolean;
  readonly mode: 'public' | 'secret';
  readonly timerSeconds: 30 | 60 | null;
  readonly rounds: 2;
}

const SAMPLE_SCHEMA: GameConfigSchema<SampleConfig> = {
  fields: {
    numberOfPlayers: { kind: 'count', label: '玩家人数', min: 4, max: 12 },
    hasBlank: { kind: 'toggle', label: '白板' },
    mode: {
      kind: 'choice',
      label: '投票模式',
      options: [
        { value: 'public', label: '公投' },
        { value: 'secret', label: '暗投' },
      ],
    },
    timerSeconds: { kind: 'duration', label: '计时', values: [30, 60, null], nullLabel: '不限' },
    rounds: { kind: 'fixed', value: 2 },
  },
  defaults: {
    numberOfPlayers: 6,
    hasBlank: false,
    mode: 'public',
    timerSeconds: 60,
    rounds: 2,
  },
  validate: (config) =>
    config.hasBlank && config.numberOfPlayers < 6
      ? { field: 'hasBlank', message: '启用白板至少需要 6 人' }
      : null,
};

/** Builds an invalid runtime value while keeping the compile-time config shape. */
function withField<K extends keyof SampleConfig>(key: K, value: unknown): SampleConfig {
  const patch: Record<string, unknown> = { [key]: value };
  return { ...SAMPLE_SCHEMA.defaults, ...patch };
}

describe('validateConfig', () => {
  it('accepts the declared defaults', () => {
    expect(validateConfig(SAMPLE_SCHEMA, SAMPLE_SCHEMA.defaults)).toBeNull();
    expect(isValidConfig(SAMPLE_SCHEMA, SAMPLE_SCHEMA.defaults)).toBe(true);
  });

  it('accepts count values on both inclusive bounds', () => {
    expect(validateConfig(SAMPLE_SCHEMA, withField('numberOfPlayers', 4))).toBeNull();
    expect(validateConfig(SAMPLE_SCHEMA, withField('numberOfPlayers', 12))).toBeNull();
  });

  it.each([3, 13, 6.5, Number.NaN, Number.POSITIVE_INFINITY, '6'])(
    'rejects count value %p with the field name',
    (value) => {
      const issue: ConfigValidationIssue<SampleConfig> | null = validateConfig(
        SAMPLE_SCHEMA,
        withField('numberOfPlayers', value),
      );
      expect(issue).toEqual({ field: 'numberOfPlayers', message: '玩家人数需为 4 至 12 的整数' });
    },
  );

  it('rejects a non-boolean toggle', () => {
    expect(validateConfig(SAMPLE_SCHEMA, withField('hasBlank', 'yes'))).toEqual({
      field: 'hasBlank',
      message: '白板设置无效',
    });
  });

  it('rejects a choice outside the declared options', () => {
    expect(validateConfig(SAMPLE_SCHEMA, withField('mode', 'hidden'))).toEqual({
      field: 'mode',
      message: '投票模式不在可选范围内',
    });
  });

  it('accepts null as a duration only when declared', () => {
    expect(validateConfig(SAMPLE_SCHEMA, withField('timerSeconds', null))).toBeNull();
    expect(validateConfig(SAMPLE_SCHEMA, withField('timerSeconds', 45))).toEqual({
      field: 'timerSeconds',
      message: '计时不在可选范围内',
    });
  });

  it('rejects a fixed field that drifts from its declared value', () => {
    expect(validateConfig(SAMPLE_SCHEMA, withField('rounds', 3))).toEqual({
      field: 'rounds',
      message: '该设置不可修改',
    });
  });

  it('runs the cross-field hook only after every field passes', () => {
    expect(
      validateConfig(SAMPLE_SCHEMA, {
        ...SAMPLE_SCHEMA.defaults,
        hasBlank: true,
        numberOfPlayers: 5,
      }),
    ).toEqual({ field: 'hasBlank', message: '启用白板至少需要 6 人' });
    expect(
      validateConfig(SAMPLE_SCHEMA, {
        ...SAMPLE_SCHEMA.defaults,
        hasBlank: true,
        numberOfPlayers: 6,
      }),
    ).toBeNull();
    // Field-level failure wins over the hook even when the hook would also fail.
    expect(
      validateConfig(SAMPLE_SCHEMA, {
        ...SAMPLE_SCHEMA.defaults,
        hasBlank: true,
        numberOfPlayers: 3,
      }),
    ).toEqual({ field: 'numberOfPlayers', message: '玩家人数需为 4 至 12 的整数' });
  });
});
